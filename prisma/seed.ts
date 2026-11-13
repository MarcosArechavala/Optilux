import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildEan13 } from "../src/lib/ean";

const prisma = new PrismaClient();

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("🌱 Sembrando base de datos OptiLux PRO (Fases 1–4)...");

  await prisma.orderStatusLog.deleteMany();
  await prisma.cashTransaction.deleteMany();
  await prisma.cashShift.deleteMany();
  await prisma.labOrder.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.lab.deleteMany();
  await prisma.user.deleteMany();
  await prisma.counter.deleteMany();
  await prisma.setting.deleteMany();

  // 1. Usuarios con RBAC real
  const passwordHash = await bcrypt.hash("optilux123", 10);
  await prisma.user.createMany({
    data: [
      {
        name: "Dr. Alejandro Vance (Admin)",
        email: "admin@optilux.ar",
        passwordHash,
        role: "ADMIN",
      },
      {
        name: "Lucía Méndez (Asesora Óptica)",
        email: "ventas@optilux.ar",
        passwordHash,
        role: "VENDEDOR",
      },
      {
        name: "Marcos Quiroga (Lab & Biselado)",
        email: "taller@optilux.ar",
        passwordHash,
        role: "TECNICO_LAB",
      },
    ],
  });

  // 2. Configuración general (USD y Meta Diaria)
  await prisma.setting.createMany({
    data: [
      { key: "usdRate", value: "1565" },
      { key: "dailyTarget", value: "1250000" },
    ],
  });

  // 3. Laboratorios Ópticos con SLA y Factor de Costo
  const [labEssilor, labZeiss, labHoya, labPropio] = await Promise.all([
    prisma.lab.create({
      data: {
        name: "Essilor Lab Sur (Digital FreeForm)",
        contactName: "Ing. Darío Fraga",
        phone: "+5491143009100",
        email: "pedidos@essilorlabsur.com.ar",
        slaDays: 4,
        costFactor: 0.36,
        notes: "Tallado digital Varilux XR y Crizal Sapphire.",
      },
    }),
    prisma.lab.create({
      data: {
        name: "Zeiss Vision Lab Argentina",
        contactName: "Lic. Paula Soria",
        phone: "+5491148112200",
        email: "lab@zeissvision.com.ar",
        slaDays: 4.5,
        costFactor: 0.38,
        notes: "Especialistas en altos índices 1.67/1.74 y PhotoFusion.",
      },
    }),
    prisma.lab.create({
      data: {
        name: "Hoya Lab Argentina",
        contactName: "Hernán Toledo",
        phone: "+5491150123344",
        email: "opticas@hoyalab.com.ar",
        slaDays: 3.5,
        costFactor: 0.34,
        notes: "Polarizados y tratamientos BlueControl.",
      },
    }),
    prisma.lab.create({
      data: {
        name: "Taller Propio Biselado CNC",
        contactName: "Marcos Quiroga",
        phone: "+5491160001111",
        email: "taller@optilux.ar",
        slaDays: 1.5,
        costFactor: 0.22,
        notes: "Biselado en el día para monofocales de stock.",
      },
    }),
  ]);

  // 4. Inventario con códigos EAN-13 válidos con dígito verificador real
  const frames = await Promise.all([
    prisma.inventoryItem.create({
      data: {
        sku: "OPT-RB-5154",
        barcode: buildEan13("805289324454"),
        brand: "Ray-Ban",
        model: "Clubmaster Optics RX5154",
        category: "ARMAZON_RECETA",
        color: "Carey / Dorado Arista",
        material: "Acetato Italiano + Metal",
        caliberLens: 51,
        caliberBridge: 21,
        caliberTemple: 145,
        costPrice: 92000,
        retailPrice: 215000,
        stock: 8,
        minStock: 3,
        location: "Vitrina Central A1",
      },
    }),
    prisma.inventoryItem.create({
      data: {
        sku: "OPT-TF-5801",
        barcode: buildEan13("889214367812"),
        brand: "Tom Ford",
        model: "Blue Block Luxury FT5801",
        category: "ARMAZON_RECETA",
        color: "Negro Ónix / T Dorado",
        material: "Acetato Mazzucchelli",
        caliberLens: 54,
        caliberBridge: 18,
        caliberTemple: 145,
        costPrice: 185000,
        retailPrice: 420000,
        stock: 2,
        minStock: 3,
        location: "Boutique VIP B2",
      },
    }),
    prisma.inventoryItem.create({
      data: {
        sku: "OPT-SL-8022",
        barcode: buildEan13("405612984310"),
        brand: "Silhouette",
        model: "Titan Minimal Art Rimless",
        category: "ARMAZON_RECETA",
        color: "Gris Rutenio Satinado",
        material: "Titanio Puro Austria",
        caliberLens: 53,
        caliberBridge: 19,
        caliberTemple: 150,
        costPrice: 210000,
        retailPrice: 485000,
        stock: 4,
        minStock: 2,
        location: "Boutique VIP B1",
      },
    }),
    prisma.inventoryItem.create({
      data: {
        sku: "OPT-PO-3007",
        barcode: buildEan13("805367249811"),
        brand: "Persol",
        model: "Calligrapher Edition PO3007V",
        category: "ARMAZON_RECETA",
        color: "Havana Miel",
        material: "Acetato Hecho a Mano",
        caliberLens: 52,
        caliberBridge: 19,
        caliberTemple: 145,
        costPrice: 138000,
        retailPrice: 310000,
        stock: 1,
        minStock: 3,
        location: "Vitrina Central A3",
      },
    }),
    prisma.inventoryItem.create({
      data: {
        sku: "SUN-OK-9102",
        barcode: buildEan13("700285441923"),
        brand: "Oakley",
        model: "Holbrook Prizm Sapphire",
        category: "LENTE_SOL",
        color: "Negro Mate / Prizm Azul",
        material: "O-Matter Ultraligero",
        caliberLens: 57,
        caliberBridge: 18,
        caliberTemple: 137,
        costPrice: 98000,
        retailPrice: 235000,
        stock: 6,
        minStock: 3,
        location: "Exhibidor Solar S1",
      },
    }),
    prisma.inventoryItem.create({
      data: {
        sku: "CL-ACV-OASYS",
        barcode: buildEan13("334590118421"),
        brand: "Acuvue J&J",
        model: "Oasys Hydraluxe Astigmatismo (x6)",
        category: "LENTE_CONTACTO",
        color: "Transparente UV",
        material: "Hidrogel de Silicona",
        caliberLens: 14,
        caliberBridge: 8,
        caliberTemple: 0,
        costPrice: 38000,
        retailPrice: 84000,
        stock: 2,
        minStock: 5,
        location: "Contactología C4",
      },
    }),
    prisma.inventoryItem.create({
      data: {
        sku: "ACC-ZEISS-KIT",
        barcode: buildEan13("404786519002"),
        brand: "Carl Zeiss",
        model: "Kit Limpieza Spray 60ml + Microfibra",
        category: "ACCESORIO",
        color: "Blanco Clínico",
        material: "Solución Antiestática",
        caliberLens: 0,
        caliberBridge: 0,
        caliberTemple: 0,
        costPrice: 6500,
        retailPrice: 18500,
        stock: 24,
        minStock: 10,
        location: "Mostrador POS",
      },
    }),
  ]);

  // 5. Pacientes + Recetas con fechas dinámicas relativas a hoy
  const p1 = await prisma.patient.create({
    data: {
      fullName: "Dr. Martín Ignacio Echeverría",
      dni: "28.451.902",
      phone: "+5491158249102",
      email: "martin.echeverria@hospitalitaliano.org.ar",
      healthInsurance: "OSDE 410",
      memberNumber: "61-04928174-01",
      notes: "Cirujano cardiovascular. Prioriza lentes progresivos de campo amplio y monturas de titanio ultraliviano.",
      balance: 145000,
      prescriptions: {
        create: [
          {
            doctorName: "Dra. Valeria S. Kriger (MN 94.112)",
            issueDate: daysAgo(28),
            expiryDate: daysFromNow(337),
            odSph: -2.25,
            odCyl: -0.75,
            odAxis: 165,
            odAdd: 2.0,
            odDp: 32.0,
            odHeight: 19.5,
            oiSph: -2.5,
            oiCyl: -0.5,
            oiAxis: 15,
            oiAdd: 2.0,
            oiDp: 31.5,
            oiHeight: 19.5,
            lensUsage: "Multifocal FreeForm Digital",
            observations: "Verificar ángulo pantoscópico de 8° en gabinete.",
          },
        ],
      },
    },
    include: { prescriptions: true },
  });

  const p2 = await prisma.patient.create({
    data: {
      fullName: "Camila Valentina Benítez",
      dni: "39.104.882",
      phone: "+5491164193301",
      email: "camibenitez.ux@gmail.com",
      healthInsurance: "Swiss Medical SMG50",
      memberNumber: "800419283-00",
      notes: "Diseñadora digital, pasa +10hs frente a monitores OLED. Requiere bloqueo selectivo de luz azul-violeta.",
      balance: 0,
      prescriptions: {
        create: [
          {
            doctorName: "Dr. Esteban F. Halperin (MN 78.304)",
            issueDate: daysAgo(10),
            expiryDate: daysFromNow(355),
            odSph: -1.5,
            odCyl: -1.25,
            odAxis: 180,
            odAdd: 0,
            odDp: 30.0,
            odHeight: 17.0,
            oiSph: -1.25,
            oiCyl: -1.0,
            oiAxis: 175,
            oiAdd: 0,
            oiDp: 30.5,
            oiHeight: 17.0,
            lensUsage: "Lejos / Permanente Filtro Azul",
            observations: "Astigmatismo miópico compuesto. Recomendar Policarbonato 1.59.",
          },
        ],
      },
    },
    include: { prescriptions: true },
  });

  const p3 = await prisma.patient.create({
    data: {
      fullName: "Roberto Carlos Alzamendi",
      dni: "18.920.331",
      phone: "+5491140928177",
      email: "ralzamendi@estudioalzamendi.com",
      healthInsurance: "Galeno Oro",
      memberNumber: "4492019-2",
      notes: "Cliente frecuente. Sensibilidad a la luz solar en conducción diurna.",
      balance: 82000,
      prescriptions: {
        create: [
          {
            doctorName: "Dra. Claudia M. Rinaldi (MN 82.910)",
            issueDate: daysAgo(350),
            expiryDate: daysFromNow(15), // Por vencer (< 45 días)
            odSph: 1.75,
            odCyl: -0.5,
            odAxis: 90,
            odAdd: 2.25,
            odDp: 33.0,
            odHeight: 20.0,
            oiSph: 2.0,
            oiCyl: -0.5,
            oiAxis: 85,
            oiAdd: 2.25,
            oiDp: 33.0,
            oiHeight: 20.0,
            lensUsage: "Multifocal Fotocromático",
            observations: "Receta próxima a cumplir 12 meses.",
          },
        ],
      },
    },
    include: { prescriptions: true },
  });

  const p4 = await prisma.patient.create({
    data: {
      fullName: "Sofía Macarena Luján",
      dni: "42.881.109",
      phone: "+5491133910482",
      email: "sofilujan@arquitectura.uba.ar",
      healthInsurance: "Particular",
      memberNumber: "-",
      notes: "Usa lentes de contacto tóricos + anteojo de descanso nocturno.",
      balance: 55000,
      prescriptions: {
        create: [
          {
            doctorName: "Dr. Esteban F. Halperin (MN 78.304)",
            issueDate: daysAgo(3),
            expiryDate: daysFromNow(362),
            odSph: -3.75,
            odCyl: -1.75,
            odAxis: 10,
            odAdd: 0,
            odDp: 29.5,
            odHeight: 16.5,
            oiSph: -4.25,
            oiCyl: -1.5,
            oiAxis: 170,
            oiAdd: 0,
            oiDp: 29.5,
            oiHeight: 16.5,
            lensUsage: "Lejos / Alto Índice",
            observations: "Cotizar orgánico 1.67 asférico por espesor de borde.",
          },
        ],
      },
    },
    include: { prescriptions: true },
  });

  // 6. Órdenes en los 6 estados del Kanban con desglose real e historial de estados
  const ordersData = [
    {
      orderNumber: "OT-2026-0845",
      patientId: p4.id,
      prescriptionId: p4.prescriptions[0].id,
      frameId: frames[1].id,
      labId: labEssilor.id,
      lensType: "Monofocal Digital Asférico HD",
      lensMaterial: "Alto Índice 1.67",
      treatments: "Antirreflejo Crizal Sapphire HR, Filtro Luz Azul BlueGuard",
      accessories: "Kit Limpieza Zeiss 60ml + Microfibra",
      labCost: 118000,
      status: "RECEPCION",
      promisedDate: daysFromNow(4),
      framePrice: 420000,
      lensPrice: 225000,
      treatmentsPrice: 100000,
      accessoriesPrice: 18500,
      subtotal: 763500,
      discount: 38175,
      insuranceCovered: 75325,
      totalAmount: 650000,
      depositPaid: 595000,
      balanceDue: 55000,
      sellerName: "Lucía Méndez (Asesora Óptica)",
      createdAt: daysAgo(0),
    },
    {
      orderNumber: "OT-2026-0842",
      patientId: p1.id,
      prescriptionId: p1.prescriptions[0].id,
      frameId: frames[2].id,
      labId: labEssilor.id,
      lensType: "Multifocal Progresivo FreeForm Varilux",
      lensMaterial: "Policarbonato 1.59",
      treatments: "Antirreflejo Crizal Sapphire HR, Filtro Luz Azul BlueGuard",
      accessories: "Kit Limpieza Zeiss 60ml + Microfibra",
      labCost: 265000,
      status: "ENVIADO_LAB",
      promisedDate: daysFromNow(2),
      framePrice: 485000,
      lensPrice: 388000,
      treatmentsPrice: 100000,
      accessoriesPrice: 18500,
      subtotal: 991500,
      discount: 0,
      insuranceCovered: 56500,
      totalAmount: 935000,
      depositPaid: 790000,
      balanceDue: 145000,
      sellerName: "Lucía Méndez (Asesora Óptica)",
      createdAt: daysAgo(2),
    },
    {
      orderNumber: "OT-2026-0839",
      patientId: p3.id,
      prescriptionId: p3.prescriptions[0].id,
      frameId: frames[3].id,
      labId: labZeiss.id,
      lensType: "Multifocal Progresivo FreeForm Varilux",
      lensMaterial: "Alto Índice 1.67",
      treatments: "Fotocromático Transitions Gen S, Antirreflejo Crizal Sapphire HR",
      accessories: "-",
      labCost: 230000,
      status: "TALLADO",
      promisedDate: daysAgo(2), // Vencida -> se calcula como demorada automáticamente
      framePrice: 310000,
      lensPrice: 450000,
      treatmentsPrice: 183000,
      accessoriesPrice: 0,
      subtotal: 943000,
      discount: 93000,
      insuranceCovered: 120000,
      totalAmount: 730000,
      depositPaid: 648000,
      balanceDue: 82000,
      sellerName: "Lucía Méndez (Asesora Óptica)",
      createdAt: daysAgo(6),
    },
    {
      orderNumber: "OT-2026-0840",
      patientId: p2.id,
      prescriptionId: p2.prescriptions[0].id,
      frameId: frames[0].id,
      labId: labPropio.id,
      lensType: "Monofocal Digital Asférico HD",
      lensMaterial: "Policarbonato 1.59",
      treatments: "Filtro Luz Azul BlueGuard, Antirayas Cuarzo + UV400",
      accessories: "Kit Limpieza Zeiss 60ml + Microfibra",
      labCost: 64000,
      status: "CONTROL_CALIDAD",
      promisedDate: daysFromNow(1),
      framePrice: 215000,
      lensPrice: 163000,
      treatmentsPrice: 66000,
      accessoriesPrice: 18500,
      subtotal: 462500,
      discount: 72500,
      insuranceCovered: 95000,
      totalAmount: 295000,
      depositPaid: 295000,
      balanceDue: 0,
      sellerName: "Lucía Méndez (Asesora Óptica)",
      createdAt: daysAgo(1),
    },
    {
      orderNumber: "OT-2026-0836",
      patientId: p2.id,
      prescriptionId: p2.prescriptions[0].id,
      frameId: frames[4].id,
      labId: labHoya.id,
      lensType: "Monofocal Digital Asférico HD",
      lensMaterial: "Orgánico CR-39 1.56",
      treatments: "Fotocromático Transitions Gen S, Antirreflejo Crizal Sapphire HR",
      accessories: "Kit Limpieza Zeiss 60ml + Microfibra",
      labCost: 85000,
      status: "LISTO_SUCURSAL",
      promisedDate: daysFromNow(0),
      framePrice: 235000,
      lensPrice: 115000,
      treatmentsPrice: 183000,
      accessoriesPrice: 18500,
      subtotal: 551500,
      discount: 51500,
      insuranceCovered: 120000,
      totalAmount: 380000,
      depositPaid: 380000,
      balanceDue: 0,
      sellerName: "Lucía Méndez (Asesora Óptica)",
      createdAt: daysAgo(3),
    },
    {
      orderNumber: "OT-2026-0831",
      patientId: p1.id,
      prescriptionId: p1.prescriptions[0].id,
      frameId: frames[0].id,
      labId: labPropio.id,
      lensType: "Ocupacional Degresivo Shamir Office",
      lensMaterial: "Orgánico CR-39 1.56",
      treatments: "Filtro Luz Azul BlueGuard",
      accessories: "-",
      labCost: 52000,
      status: "ENTREGADO",
      promisedDate: daysAgo(3),
      deliveredAt: daysAgo(3),
      framePrice: 215000,
      lensPrice: 210000,
      treatmentsPrice: 42000,
      accessoriesPrice: 0,
      subtotal: 467000,
      discount: 47000,
      insuranceCovered: 150000,
      totalAmount: 270000,
      depositPaid: 270000,
      balanceDue: 0,
      sellerName: "Lucía Méndez (Asesora Óptica)",
      createdAt: daysAgo(5),
    },
  ];

  for (const od of ordersData) {
    const created = await prisma.labOrder.create({ data: od });
    await prisma.orderStatusLog.create({
      data: {
        orderId: created.id,
        fromStatus: null,
        toStatus: created.status,
        userName: created.sellerName,
        createdAt: created.createdAt,
      },
    });
  }

  // Inicializar secuencias atómicas
  await prisma.counter.createMany({
    data: [
      { id: "order", value: 846 },
      { id: "ean", value: 1001 },
    ],
  });

  // 7. Turno de Caja Abierto Persistente + Movimientos Multi-Día Reales
  const openShift = await prisma.cashShift.create({
    data: {
      name: "Turno Mañana",
      status: "OPEN",
      openedByName: "Lucía Méndez (Asesora Óptica)",
      openedAt: daysAgo(0),
      openingAmount: 150000,
    },
  });

  await prisma.cashTransaction.createMany({
    data: [
      {
        shiftId: openShift.id,
        type: "INGRESO",
        category: "SENA_POS",
        paymentMethod: "TARJETA_CREDITO",
        currency: "ARS",
        amount: 595000,
        exchangeRate: 1,
        amountArs: 595000,
        reference: "Seña OT-2026-0845 (Sofía Luján - 3 cuotas)",
        operatorName: "Lucía Méndez",
        createdAt: daysAgo(0),
      },
      {
        shiftId: openShift.id,
        type: "INGRESO",
        category: "VENTA_DIRECTA",
        paymentMethod: "MERCADOPAGO_QR",
        currency: "ARS",
        amount: 235000,
        exchangeRate: 1,
        amountArs: 235000,
        reference: "Venta Solar Oakley Holbrook Prizm",
        operatorName: "Lucía Méndez",
        createdAt: daysAgo(0),
      },
      {
        shiftId: openShift.id,
        type: "INGRESO",
        category: "SALDO_ENTREGA",
        paymentMethod: "USD_BILLETE",
        currency: "USD",
        amount: 320,
        exchangeRate: 1565,
        amountArs: 320 * 1565,
        reference: "Cancelación Saldo OT-2026-0836 (USD 320 @ $1.565)",
        operatorName: "Lucía Méndez",
        createdAt: daysAgo(0),
      },
      {
        shiftId: openShift.id,
        type: "EGRESO",
        category: "PAGO_LABORATORIO",
        paymentMethod: "TRANSFERENCIA",
        currency: "ARS",
        amount: 185000,
        exchangeRate: 1,
        amountArs: 185000,
        reference: "Liquidación Quincenal Essilor Lab Sur #FAC-9921",
        operatorName: "Dr. Alejandro Vance (Admin)",
        createdAt: daysAgo(0),
      },
      // Movimientos de los últimos 5 días para alimentar el gráfico semanal real
      {
        type: "INGRESO",
        category: "SENA_POS",
        paymentMethod: "TRANSFERENCIA",
        currency: "ARS",
        amount: 790000,
        exchangeRate: 1,
        amountArs: 790000,
        reference: "Anticipo OT-2026-0842 (Dr. Martín Echeverría)",
        operatorName: "Lucía Méndez",
        createdAt: daysAgo(1),
      },
      {
        type: "INGRESO",
        category: "SENA_POS",
        paymentMethod: "TARJETA_CREDITO",
        currency: "ARS",
        amount: 648000,
        exchangeRate: 1,
        amountArs: 648000,
        reference: "Seña OT-2026-0839 (Roberto Alzamendi)",
        operatorName: "Lucía Méndez",
        createdAt: daysAgo(2),
      },
      {
        type: "INGRESO",
        category: "SENA_POS",
        paymentMethod: "EFECTIVO",
        currency: "ARS",
        amount: 380000,
        exchangeRate: 1,
        amountArs: 380000,
        reference: "Pago total OT-2026-0836 (Camila Benítez)",
        operatorName: "Lucía Méndez",
        createdAt: daysAgo(3),
      },
      {
        type: "INGRESO",
        category: "SALDO_ENTREGA",
        paymentMethod: "TARJETA_DEBITO",
        currency: "ARS",
        amount: 565000,
        exchangeRate: 1,
        amountArs: 565000,
        reference: "Entregas varias turno tarde",
        operatorName: "Lucía Méndez",
        createdAt: daysAgo(4),
      },
    ],
  });

  console.log("✅ Base de datos OptiLux PRO sembrada exitosamente.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
