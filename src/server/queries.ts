import { prisma } from "@/lib/prisma";
import { startOfDay, daysBetween } from "@/lib/utils";
import type { ERPState, DashboardMetricsDTO } from "@/types/erp";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export async function buildErpState(): Promise<ERPState> {
  const [
    patients,
    inventory,
    labs,
    rawOrders,
    activeShift,
    recentShifts,
    transactions,
    settingsRows,
  ] = await Promise.all([
    prisma.patient.findMany({
      include: {
        prescriptions: { orderBy: { issueDate: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inventoryItem.findMany({
      orderBy: { brand: "asc" },
    }),
    prisma.lab.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.labOrder.findMany({
      include: {
        patient: { include: { prescriptions: true } },
        prescription: true,
        frame: true,
        lab: true,
        statusLogs: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.cashShift.findFirst({
      where: { status: "OPEN" },
      orderBy: { openedAt: "desc" },
    }),
    prisma.cashShift.findMany({
      orderBy: { openedAt: "desc" },
      take: 8,
    }),
    prisma.cashTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.setting.findMany(),
  ]);

  const settings = Object.fromEntries(settingsRows.map((s) => [s.key, s.value]));
  const usdRate = Number(settings.usdRate ?? 1565);
  const dailyTarget = Number(settings.dailyTarget ?? 1250000);

  const today = startOfDay();

  // Cálculo dinámico de isDelayed en el servidor (promisedDate < hoy && no listo/entregado)
  const orders = rawOrders.map((o) => {
    const isFinished =
      o.status === "LISTO_SUCURSAL" || o.status === "ENTREGADO";
    const isDelayed = !isFinished && new Date(o.promisedDate) < today;
    return {
      ...o,
      isDelayed,
    };
  });

  // ─── KPIs en Tiempo Real ────────────────────────────────────
  const todayTxs = transactions.filter(
    (t) => new Date(t.createdAt) >= today && t.type === "INGRESO"
  );
  const salesTodayArs = todayTxs
    .filter((t) => t.currency === "ARS")
    .reduce((acc, t) => acc + t.amount, 0);
  const salesTodayUsd = todayTxs
    .filter((t) => t.currency === "USD")
    .reduce((acc, t) => acc + t.amount, 0);
  const consolidatedTodayArs = salesTodayArs + salesTodayUsd * usdRate;

  const activeLabCount = orders.filter(
    (o) => o.status !== "LISTO_SUCURSAL" && o.status !== "ENTREGADO"
  ).length;
  const delayedCount = orders.filter((o) => o.isDelayed).length;
  const readyCount = orders.filter((o) => o.status === "LISTO_SUCURSAL").length;
  const lowStockCount = inventory.filter((i) => i.stock <= i.minStock).length;

  // ─── Serie de Facturación últimos 6 días ────────────────────
  const weeklySeries: DashboardMetricsDTO["weeklySeries"] = [];
  for (let i = 5; i >= 0; i--) {
    const dayStart = startOfDay(new Date(Date.now() - i * 86_400_000));
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const sumArs = transactions
      .filter(
        (t) =>
          t.type === "INGRESO" &&
          new Date(t.createdAt) >= dayStart &&
          new Date(t.createdAt) < dayEnd
      )
      .reduce((acc, t) => acc + t.amountArs, 0);

    weeklySeries.push({
      label: DAY_NAMES[dayStart.getDay()],
      date: dayStart.toISOString().slice(0, 10),
      amountArs: sumArs,
      target: dailyTarget,
    });
  }

  // ─── Mix de Ventas Real desde Desglose de Órdenes ───────────
  const totalLenses = orders.reduce(
    (acc, o) => acc + o.lensPrice + o.treatmentsPrice,
    0
  );
  const totalFrames = orders.reduce((acc, o) => acc + o.framePrice, 0);
  const totalAcc = orders.reduce((acc, o) => acc + o.accessoriesPrice, 0);
  const grandTotalMix = Math.max(totalLenses + totalFrames + totalAcc, 1);

  const lensPct = Math.round((totalLenses / grandTotalMix) * 100);
  const framePct = Math.round((totalFrames / grandTotalMix) * 100);
  const accPct = Math.max(100 - lensPct - framePct, 0);

  const salesMix = [
    {
      label: "Cristales Oftálmicos & Tratamientos",
      amount: totalLenses,
      pct: lensPct,
      color: "bg-primary",
    },
    {
      label: "Armazones Recetados & Solares",
      amount: totalFrames,
      pct: framePct,
      color: "bg-accent",
    },
    {
      label: "Accesorios, Líquidos & Servicios",
      amount: totalAcc,
      pct: accPct,
      color: "bg-sky-400",
    },
  ];

  // ─── Performance y Demora Real por Laboratorio ──────────────
  const labBenchmarks = labs.map((lab) => {
    const labOrders = orders.filter((o) => o.labId === lab.id);
    const activeOrders = labOrders.filter(
      (o) => o.status !== "LISTO_SUCURSAL" && o.status !== "ENTREGADO"
    );
    const delayedLabOrders = labOrders.filter((o) => o.isDelayed);

    const durations = labOrders.map((o) => {
      const end = o.deliveredAt ? new Date(o.deliveredAt) : new Date();
      return Math.max(daysBetween(o.createdAt, end), 0.5);
    });
    const avgDays =
      durations.length > 0
        ? Number(
            (
              durations.reduce((a, b) => a + b, 0) / durations.length
            ).toFixed(1)
          )
        : Number((lab.slaDays * 0.8).toFixed(1));

    return {
      id: lab.id,
      name: lab.name,
      slaDays: lab.slaDays,
      avgDays,
      activeCount: activeOrders.length,
      delayedCount: delayedLabOrders.length,
    };
  });

  const metrics: DashboardMetricsDTO = {
    salesTodayArs,
    salesTodayUsd,
    consolidatedTodayArs,
    activeLabCount,
    delayedCount,
    readyCount,
    lowStockCount,
    usdRate,
    dailyTarget,
    weeklySeries,
    salesMix,
    labBenchmarks,
  };

  return JSON.parse(
    JSON.stringify({
      patients,
      inventory,
      labs,
      orders,
      activeShift,
      recentShifts,
      transactions,
      metrics,
    })
  );
}

