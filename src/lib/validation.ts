import { z } from "zod";
import { KANBAN_STATUSES, LENS_DESIGNS, LENS_MATERIALS, LENS_TREATMENTS, PAYMENT_METHODS, SHIFT_NAMES, INVENTORY_CATEGORIES } from "./catalog";
import { isValidEan13 } from "./ean";
import { parseMoneyARS } from "./utils";

/** Paso de 0.25 D sin errores de coma flotante. */
export const isQuarterStep = (v: number) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-6;
const isHalfStep = (v: number) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-6;

const num = (msg = "Debe ser un número") =>
  z.coerce.number({ error: msg }).refine((v) => Number.isFinite(v), msg);

const moneyArs = (msg = "Monto inválido") =>
  z.preprocess((val) => (typeof val === "string" ? parseMoneyARS(val) : val), num(msg));

const diopter = (label: string, min: number, max: number) =>
  num(`${label}: número inválido`)
    .refine((v) => v >= min && v <= max, `${label} fuera de rango (${min} a ${max})`)
    .refine(isQuarterStep, `${label} debe ir en pasos de 0.25 D`);

const eyeSchema = (eye: "OD" | "OI") =>
  z.object({
    sph: diopter(`${eye} Esfera`, -30, 30),
    cyl: diopter(`${eye} Cilindro`, -10, 10),
    axis: z.coerce
      .number({ error: `${eye} Eje inválido` })
      .int(`${eye} Eje debe ser entero`)
      .min(0, `${eye} Eje: 0° a 180°`)
      .max(180, `${eye} Eje: 0° a 180°`),
    add: diopter(`${eye} Adición`, 0, 4),
    dp: num(`${eye} DP inválida`)
      .refine((v) => v >= 20 && v <= 40, `${eye} DP fuera de rango (20–40 mm)`)
      .refine(isHalfStep, `${eye} DP en pasos de 0.5 mm`),
    height: num(`${eye} Altura inválida`).refine((v) => v >= 10 && v <= 35, `${eye} Altura fuera de rango (10–35 mm)`),
  });

export const prescriptionSchema = z
  .object({
    doctorName: z.string().trim().min(3, "Indicá el médico y su matrícula"),
    issueDate: z.coerce
      .date({ error: "Fecha inválida" })
      .refine((d) => d.getTime() <= Date.now() + 86_400_000, "La fecha no puede ser futura"),
    od: eyeSchema("OD"),
    oi: eyeSchema("OI"),
    lensUsage: z.string().min(2),
    observations: z.string().max(500).optional().default(""),
    attachmentName: z.string().max(200).optional().nullable(),
    attachmentPath: z
      .string()
      .regex(/^[a-z0-9]+\.(pdf|png|jpg|jpeg|webp)$/i, "Adjunto inválido")
      .optional()
      .nullable(),
    attachmentMime: z.string().max(100).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    (["od", "oi"] as const).forEach((eye) => {
      const e = v[eye];
      if (e.cyl !== 0 && e.axis === 0) {
        ctx.addIssue({
          code: "custom",
          path: [eye, "axis"],
          message: `${eye.toUpperCase()}: el Eje es obligatorio cuando hay Cilindro (use 180° en lugar de 0°)`,
        });
      }
    });
  });

export type PrescriptionInput = z.infer<typeof prescriptionSchema>;

export const patientSchema = z.object({
  fullName: z.string().trim().min(3, "Nombre demasiado corto"),
  dni: z.string().trim().regex(/^[\d.]{7,11}$/, "DNI inválido (solo números y puntos)"),
  phone: z.string().trim().regex(/^\+?\d{10,15}$/, "Teléfono inválido (formato +549…)"),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  healthInsurance: z.string().min(2),
  memberNumber: z.string().optional().default(""),
  notes: z.string().max(1000).optional().default(""),
});

const designIds = LENS_DESIGNS.map((d) => d.id) as [string, ...string[]];
const materialIds = LENS_MATERIALS.map((d) => d.id) as [string, ...string[]];
const treatmentIds = LENS_TREATMENTS.map((d) => d.id) as [string, ...string[]];
const paymentIds = PAYMENT_METHODS.map((p) => p.id) as [string, ...string[]];

export const posOrderSchema = z.object({
  patientId: z.string().min(1, "Seleccioná un paciente"),
  prescriptionId: z.string().nullable().optional(),
  frameId: z.string().nullable().optional(),
  designId: z.enum(designIds),
  materialId: z.enum(materialIds),
  treatmentIds: z.array(z.enum(treatmentIds)).max(4),
  includeAccessoryKit: z.boolean(),
  labId: z.string().min(1, "Seleccioná un laboratorio"),
  discountPct: num().refine((v) => v >= 0 && v <= 50, "Descuento entre 0 y 50%"),
  insuranceCovered: num().refine((v) => v >= 0, "Cobertura inválida"),
  depositPaid: num().refine((v) => v >= 0, "Seña inválida"),
  paymentMethod: z.enum(paymentIds),
});

export const paymentSchema = z.object({
  method: z.enum(paymentIds),
});

export const orderStatusSchema = z.object({
  status: z.enum(KANBAN_STATUSES),
  payment: paymentSchema.optional(),
});

export const cashTxSchema = z.object({
  type: z.enum(["INGRESO", "EGRESO"]),
  category: z.string().min(2),
  paymentMethod: z.enum(paymentIds),
  amount: num()
    .refine((v) => v > 0, "El monto debe ser mayor a 0")
    .refine((v) => v < 100_000_000, "Monto excesivo"),
  reference: z.string().trim().min(3, "Indicá un concepto"),
});

export const shiftSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("open"),
    name: z.enum(SHIFT_NAMES),
    openingAmount: num().refine((v) => v >= 0, "Fondo inicial inválido"),
  }),
  z.object({
    action: z.literal("close"),
    declaredCash: num().refine((v) => v >= 0, "Efectivo declarado inválido"),
    declaredUsd: num().refine((v) => v >= 0, "USD declarado inválido"),
  }),
]);

const categoryIds = INVENTORY_CATEGORIES.map((c) => c.id) as [string, ...string[]];

export const inventorySchema = z
  .object({
    sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,20}$/, "SKU: mayúsculas, números y guiones (4–20)"),
    barcode: z.string().trim().optional().default(""),
    brand: z.string().trim().min(2, "Marca requerida"),
    model: z.string().trim().min(2, "Modelo requerido"),
    category: z.enum(categoryIds),
    color: z.string().trim().min(2, "Color requerido"),
    material: z.string().trim().min(2, "Material requerido"),
    caliberLens: z.coerce.number().int().min(0).max(80),
    caliberBridge: z.coerce.number().int().min(0).max(30),
    caliberTemple: z.coerce.number().int().min(0).max(160),
    costPrice: num().refine((v) => v >= 0, "Costo inválido"),
    retailPrice: num().refine((v) => v > 0, "Precio requerido"),
    stock: z.coerce.number().int().min(0, "El stock no puede ser negativo"),
    minStock: z.coerce.number().int().min(0),
    location: z.string().trim().min(2, "Ubicación requerida"),
  })
  .refine((v) => v.barcode === "" || isValidEan13(v.barcode), {
    path: ["barcode"],
    message: "EAN-13 inválido (dígito verificador incorrecto). Dejalo vacío para generar uno interno.",
  })
  .refine((v) => v.retailPrice >= v.costPrice, { path: ["retailPrice"], message: "El PVP no puede ser menor al costo" });

export const stockAdjustSchema = z.object({
  delta: z.coerce.number().int().refine((v) => v !== 0 && Math.abs(v) <= 500, "Ajuste inválido"),
});

export const labSchema = z.object({
  name: z.string().trim().min(3, "Nombre requerido"),
  contactName: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  slaDays: num().refine((v) => v > 0 && v <= 60, "SLA entre 1 y 60 días"),
  costFactor: num().refine((v) => v >= 0 && v <= 1, "Factor entre 0 y 1"),
  notes: z.string().optional().default(""),
  active: z.boolean().optional().default(true),
});

export const settingsSchema = z.object({
  usdRate: moneyArs("Cotización inválida").refine((v) => v >= 100, "Ingresá la cotización completa en pesos (ej. 1565)"),
  dailyTarget: moneyArs("Meta inválida").refine((v) => v >= 0, "Meta inválida"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(6, "Contraseña demasiado corta"),
});

/** Convierte errores Zod en { campo: mensaje } para la UI. */
export function flattenIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
