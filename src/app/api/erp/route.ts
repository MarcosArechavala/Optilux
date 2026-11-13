import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ACCESSORY_KIT,
  LENS_DESIGNS,
  LENS_MATERIALS,
  LENS_TREATMENTS,
  MAX_DISCOUNT,
  PAYMENT_METHODS,
} from "@/lib/catalog";
import { internalEan } from "@/lib/ean";
import {
  cashTxSchema,
  inventorySchema,
  labSchema,
  orderStatusSchema,
  patientSchema,
  posOrderSchema,
  prescriptionSchema,
  settingsSchema,
  shiftSchema,
  stockAdjustSchema,
} from "@/lib/validation";
import {
  ApiError,
  parseBody,
  readJson,
  requirePermission,
  route,
} from "@/server/api";
import { buildErpState } from "@/server/queries";

export const GET = route(async () => {
  await requirePermission("dashboard:read");
  const state = await buildErpState();
  return NextResponse.json(state);
});

export const POST = route(async (request) => {
  const body = (await readJson(request)) as {
    action?: string;
    payload?: unknown;
  };
  const { action, payload } = body;

  // ─── 1. Alta de Paciente ───────────────────────────────────
  if (action === "CREATE_PATIENT") {
    await requirePermission("patients:write");
    const data = parseBody(patientSchema, payload);
    const patient = await prisma.patient.create({
      data: {
        fullName: data.fullName,
        dni: data.dni,
        phone: data.phone,
        email: data.email || null,
        healthInsurance: data.healthInsurance,
        memberNumber: data.memberNumber || "-",
        notes: data.notes || "",
        balance: 0,
      },
    });
    return NextResponse.json({ ok: true, patient });
  }

  // ─── 2. Alta de Receta Oftalmológica Validada ──────────────
  if (action === "CREATE_PRESCRIPTION") {
    await requirePermission("rx:write");
    const raw = payload as Record<string, unknown>;
    const patientId = String(raw?.patientId ?? "");
    if (!patientId) throw new ApiError(400, "Paciente requerido");

    const data = parseBody(prescriptionSchema, raw);
    const expiryDate = new Date(data.issueDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const prescription = await prisma.prescription.create({
      data: {
        patientId,
        doctorName: data.doctorName,
        issueDate: data.issueDate,
        expiryDate,
        odSph: data.od.sph,
        odCyl: data.od.cyl,
        odAxis: data.od.axis,
        odAdd: data.od.add,
        odDp: data.od.dp,
        odHeight: data.od.height,
        oiSph: data.oi.sph,
        oiCyl: data.oi.cyl,
        oiAxis: data.oi.axis,
        oiAdd: data.oi.add,
        oiDp: data.oi.dp,
        oiHeight: data.oi.height,
        lensUsage: data.lensUsage,
        attachmentName: data.attachmentName ?? null,
        attachmentPath: data.attachmentPath ?? null,
        attachmentMime: data.attachmentMime ?? null,
        observations: data.observations ?? "",
      },
    });
    return NextResponse.json({ ok: true, prescription });
  }

  // ─── 3. Emitir Orden POS (Transacción Atómica) ─────────────
  if (action === "CREATE_POS_ORDER") {
    const user = await requirePermission("pos:create");
    const data = parseBody(posOrderSchema, payload);

    const maxDisc = MAX_DISCOUNT[user.role] ?? 0;
    if (data.discountPct > maxDisc) {
      throw new ApiError(
        403,
        `Tu rol (${user.role}) permite hasta ${maxDisc}% de descuento.`
      );
    }

    const design = LENS_DESIGNS.find((d) => d.id === data.designId);
    const material = LENS_MATERIALS.find((m) => m.id === data.materialId);
    if (!design || !material) {
      throw new ApiError(400, "Diseño o material de cristal inválido");
    }

    const selectedTreatments = LENS_TREATMENTS.filter((t) =>
      data.treatmentIds.includes(t.id)
    );

    const order = await prisma.$transaction(async (tx) => {
      // Si hay seña > 0, exigir turno de caja abierto
      const openShift = await tx.cashShift.findFirst({
        where: { status: "OPEN" },
      });
      if (data.depositPaid > 0 && !openShift) {
        throw new ApiError(
          409,
          "La caja está cerrada. Abrí un turno de caja antes de cobrar una seña."
        );
      }

      const [patient, lab] = await Promise.all([
        tx.patient.findUnique({ where: { id: data.patientId } }),
        tx.lab.findUnique({ where: { id: data.labId } }),
      ]);
      if (!patient) throw new ApiError(404, "Paciente no encontrado");
      if (!lab) throw new ApiError(404, "Laboratorio no encontrado");

      // Verificar y descontar stock de armazón de forma segura
      let framePrice = 0;
      if (data.frameId) {
        const frame = await tx.inventoryItem.findUnique({
          where: { id: data.frameId },
        });
        if (!frame) throw new ApiError(404, "Armazón no encontrado");
        if (frame.stock <= 0) {
          throw new ApiError(
            409,
            `Sin stock disponible para ${frame.brand} ${frame.model}.`
          );
        }
        await tx.inventoryItem.update({
          where: { id: frame.id },
          data: { stock: { decrement: 1 } },
        });
        framePrice = frame.retailPrice;
      }

      // Recalcular precios en el servidor (autoridad de precios)
      const lensPrice = design.price + material.price;
      const treatmentsPrice = selectedTreatments.reduce(
        (sum, t) => sum + t.price,
        0
      );
      const accessoriesPrice = data.includeAccessoryKit
        ? ACCESSORY_KIT.price
        : 0;
      const subtotal =
        framePrice + lensPrice + treatmentsPrice + accessoriesPrice;
      const discount = Math.round((subtotal * data.discountPct) / 100);
      const totalAmount = Math.max(
        subtotal - discount - data.insuranceCovered,
        0
      );
      const depositPaid = Math.min(data.depositPaid, totalAmount);
      const balanceDue = Math.max(totalAmount - depositPaid, 0);

      // Secuencia atómica para el número de OT
      const seq = await tx.counter.upsert({
        where: { id: "order" },
        update: { value: { increment: 1 } },
        create: { id: "order", value: 846 },
      });
      const orderNumber = `OT-2026-${String(seq.value).padStart(4, "0")}`;

      const promisedDate = new Date();
      promisedDate.setDate(
        promisedDate.getDate() + Math.ceil(lab.slaDays || design.days)
      );

      const createdOrder = await tx.labOrder.create({
        data: {
          orderNumber,
          patientId: patient.id,
          prescriptionId: data.prescriptionId || null,
          frameId: data.frameId || null,
          labId: lab.id,
          lensType: design.name,
          lensMaterial: material.name,
          treatments:
            selectedTreatments.map((t) => t.name).join(", ") || "Estándar UV",
          accessories: data.includeAccessoryKit
            ? ACCESSORY_KIT.name
            : "Estuche Rígido Boutique",
          labCost: Math.round((lensPrice + treatmentsPrice) * lab.costFactor),
          status: "RECEPCION",
          promisedDate,
          framePrice,
          lensPrice,
          treatmentsPrice,
          accessoriesPrice,
          subtotal,
          discount,
          insuranceCovered: data.insuranceCovered,
          totalAmount,
          depositPaid,
          balanceDue,
          sellerName: user.name,
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: createdOrder.id,
          fromStatus: null,
          toStatus: "RECEPCION",
          userName: user.name,
        },
      });

      if (balanceDue > 0) {
        await tx.patient.update({
          where: { id: patient.id },
          data: { balance: { increment: balanceDue } },
        });
      }

      if (depositPaid > 0 && openShift) {
        const usdSetting = await tx.setting.findUnique({
          where: { key: "usdRate" },
        });
        const usdRate = Number(usdSetting?.value ?? 1565);
        const methodObj = PAYMENT_METHODS.find(
          (m) => m.id === data.paymentMethod
        );
        const isUsd = methodObj?.currency === "USD";
        const rawAmount = isUsd
          ? Number((depositPaid / usdRate).toFixed(2))
          : depositPaid;

        await tx.cashTransaction.create({
          data: {
            shiftId: openShift.id,
            type: "INGRESO",
            category: "SENA_POS",
            paymentMethod: data.paymentMethod,
            currency: isUsd ? "USD" : "ARS",
            amount: rawAmount,
            exchangeRate: isUsd ? usdRate : 1,
            amountArs: depositPaid,
            reference: `Seña ${orderNumber} (${patient.fullName})`,
            operatorName: user.name,
          },
        });
      }

      return createdOrder;
    });

    return NextResponse.json({ ok: true, order });
  }

  // ─── 4. Mover Orden en Kanban + Historial + Cobro en Entrega ─
  if (action === "UPDATE_ORDER_STATUS") {
    const raw = payload as Record<string, unknown>;
    const orderId = String(raw?.orderId ?? "");
    const parsed = parseBody(orderStatusSchema, raw);

    // Entregar requiere permiso de ventas/admin
    const user =
      parsed.status === "ENTREGADO"
        ? await requirePermission("orders:deliver")
        : await requirePermission("orders:move");

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.labOrder.findUnique({
        where: { id: orderId },
        include: { patient: true },
      });
      if (!existing) throw new ApiError(404, "Orden no encontrada");

      if (existing.status === parsed.status) return existing;

      // Si pasa a ENTREGADO y tiene saldo pendiente, exigir medio de pago y caja abierta
      if (parsed.status === "ENTREGADO" && existing.balanceDue > 0) {
        if (!parsed.payment) {
          throw new ApiError(
            400,
            "Seleccioná el medio de pago para cobrar el saldo pendiente al entregar."
          );
        }
        const openShift = await tx.cashShift.findFirst({
          where: { status: "OPEN" },
        });
        if (!openShift) {
          throw new ApiError(
            409,
            "La caja está cerrada. Abrí un turno de caja para cobrar el saldo de entrega."
          );
        }

        const usdSetting = await tx.setting.findUnique({
          where: { key: "usdRate" },
        });
        const usdRate = Number(usdSetting?.value ?? 1565);
        const isUsd = parsed.payment.method === "USD_BILLETE";
        const rawAmount = isUsd
          ? Number((existing.balanceDue / usdRate).toFixed(2))
          : existing.balanceDue;

        await tx.cashTransaction.create({
          data: {
            shiftId: openShift.id,
            type: "INGRESO",
            category: "SALDO_ENTREGA",
            paymentMethod: parsed.payment.method,
            currency: isUsd ? "USD" : "ARS",
            amount: rawAmount,
            exchangeRate: isUsd ? usdRate : 1,
            amountArs: existing.balanceDue,
            reference: `Saldo Entrega ${existing.orderNumber} (${existing.patient.fullName})`,
            operatorName: user.name,
          },
        });

        await tx.patient.update({
          where: { id: existing.patientId },
          data: {
            balance: Math.max(existing.patient.balance - existing.balanceDue, 0),
          },
        });
      }

      const nextOrder = await tx.labOrder.update({
        where: { id: orderId },
        data: {
          status: parsed.status,
          deliveredAt:
            parsed.status === "ENTREGADO" ? new Date() : existing.deliveredAt,
          depositPaid:
            parsed.status === "ENTREGADO"
              ? existing.totalAmount
              : existing.depositPaid,
          balanceDue:
            parsed.status === "ENTREGADO" ? 0 : existing.balanceDue,
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: existing.id,
          fromStatus: existing.status,
          toStatus: parsed.status,
          userName: user.name,
        },
      });

      return nextOrder;
    });

    return NextResponse.json({ ok: true, order: updated });
  }

  // ─── 5. Crear Producto de Inventario con EAN-13 Real ───────
  if (action === "CREATE_INVENTORY_ITEM") {
    await requirePermission("inventory:write");
    const data = parseBody(inventorySchema, payload);

    const item = await prisma.$transaction(async (tx) => {
      let barcode = data.barcode;
      if (!barcode) {
        const seq = await tx.counter.upsert({
          where: { id: "ean" },
          update: { value: { increment: 1 } },
          create: { id: "ean", value: 1002 },
        });
        barcode = internalEan(seq.value);
      }

      return tx.inventoryItem.create({
        data: {
          ...data,
          barcode,
        },
      });
    });

    return NextResponse.json({ ok: true, item });
  }

  // ─── 6. Ajuste Seguro de Stock (Impide Stock Negativo) ─────
  if (action === "ADJUST_STOCK") {
    await requirePermission("inventory:adjust");
    const raw = payload as Record<string, unknown>;
    const itemId = String(raw?.itemId ?? "");
    const { delta } = parseBody(stockAdjustSchema, raw);

    const item = await prisma.$transaction(async (tx) => {
      const current = await tx.inventoryItem.findUnique({
        where: { id: itemId },
      });
      if (!current) throw new ApiError(404, "Producto no encontrado");
      if (current.stock + delta < 0) {
        throw new ApiError(
          409,
          `El stock de ${current.brand} ${current.model} no puede quedar en negativo.`
        );
      }
      return tx.inventoryItem.update({
        where: { id: itemId },
        data: { stock: { increment: delta } },
      });
    });

    return NextResponse.json({ ok: true, item });
  }

  // ─── 7. Apertura y Cierre Persistente de Turno de Caja ─────
  if (action === "MANAGE_SHIFT") {
    const user = await requirePermission("cash:write");
    const data = parseBody(shiftSchema, payload);

    if (data.action === "open") {
      const existing = await prisma.cashShift.findFirst({
        where: { status: "OPEN" },
      });
      if (existing) {
        throw new ApiError(409, `Ya hay un turno abierto (${existing.name}).`);
      }
      const shift = await prisma.cashShift.create({
        data: {
          name: data.name,
          status: "OPEN",
          openedByName: user.name,
          openingAmount: data.openingAmount,
        },
      });
      return NextResponse.json({ ok: true, shift });
    } else {
      const openShift = await prisma.cashShift.findFirst({
        where: { status: "OPEN" },
        include: { transactions: true },
      });
      if (!openShift) {
        throw new ApiError(409, "No hay ningún turno abierto para cerrar.");
      }

      const cashIn = openShift.transactions
        .filter(
          (t) =>
            t.type === "INGRESO" &&
            t.paymentMethod === "EFECTIVO" &&
            t.currency === "ARS"
        )
        .reduce((a, b) => a + b.amount, 0);
      const cashOut = openShift.transactions
        .filter(
          (t) =>
            t.type === "EGRESO" &&
            t.paymentMethod === "EFECTIVO" &&
            t.currency === "ARS"
        )
        .reduce((a, b) => a + b.amount, 0);

      const expectedCash = openShift.openingAmount + cashIn - cashOut;
      const difference = data.declaredCash - expectedCash;

      const expectedUsd = openShift.transactions
        .filter((t) => t.currency === "USD")
        .reduce((a, b) => a + (b.type === "INGRESO" ? b.amount : -b.amount), 0);
      const differenceUsd = data.declaredUsd - expectedUsd;

      const closed = await prisma.cashShift.update({
        where: { id: openShift.id },
        data: {
          status: "CLOSED",
          closedByName: user.name,
          closedAt: new Date(),
          expectedCash,
          declaredCash: data.declaredCash,
          difference,
          expectedUsd,
          declaredUsd: data.declaredUsd,
          differenceUsd,
        },
      });
      return NextResponse.json({ ok: true, shift: closed });
    }
  }

  // ─── 8. Registrar Movimiento Manual de Caja ────────────────
  if (action === "CREATE_CASH_TRANSACTION") {
    const user = await requirePermission("cash:write");
    const data = parseBody(cashTxSchema, payload);

    const openShift = await prisma.cashShift.findFirst({
      where: { status: "OPEN" },
    });
    if (!openShift) {
      throw new ApiError(
        409,
        "La caja está cerrada. Abrí un turno antes de registrar movimientos."
      );
    }

    const usdSetting = await prisma.setting.findUnique({
      where: { key: "usdRate" },
    });
    const usdRate = Number(usdSetting?.value ?? 1565);
    const isUsd = data.paymentMethod === "USD_BILLETE";
    const amountArs = isUsd ? Math.round(data.amount * usdRate) : data.amount;

    const tx = await prisma.cashTransaction.create({
      data: {
        shiftId: openShift.id,
        type: data.type,
        category: data.category,
        paymentMethod: data.paymentMethod,
        currency: isUsd ? "USD" : "ARS",
        amount: data.amount,
        exchangeRate: isUsd ? usdRate : 1,
        amountArs,
        reference: data.reference,
        operatorName: user.name,
      },
    });
    return NextResponse.json({ ok: true, transaction: tx });
  }

  // ─── 9. ABM de Laboratorios Ópticos ────────────────────────
  if (action === "SAVE_LAB") {
    await requirePermission("labs:write");
    const raw = payload as Record<string, unknown>;
    const id = raw?.id ? String(raw.id) : undefined;
    const data = parseBody(labSchema, raw);

    const lab = id
      ? await prisma.lab.update({ where: { id }, data })
      : await prisma.lab.create({ data });

    return NextResponse.json({ ok: true, lab });
  }

  // ─── 10. Actualizar Cotización USD y Meta Diaria ───────────
  if (action === "UPDATE_SETTINGS") {
    await requirePermission("settings:write");
    const data = parseBody(settingsSchema, payload);

    await prisma.$transaction([
      prisma.setting.upsert({
        where: { key: "usdRate" },
        update: { value: String(data.usdRate) },
        create: { key: "usdRate", value: String(data.usdRate) },
      }),
      prisma.setting.upsert({
        where: { key: "dailyTarget" },
        update: { value: String(data.dailyTarget) },
        create: { key: "dailyTarget", value: String(data.dailyTarget) },
      }),
    ]);

    return NextResponse.json({ ok: true });
  }

  throw new ApiError(400, "Acción desconocida");
});
