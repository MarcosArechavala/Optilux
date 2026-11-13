/**
 * Catálogo de cristales compartido cliente/servidor.
 * El servidor RECALCULA todos los precios a partir de estos IDs:
 * el cliente nunca envía montos que se acepten a ciegas.
 */
export const LENS_DESIGNS = [
  { id: "mono-dig", name: "Monofocal Digital Asférico HD", price: 115000, desc: "Visión simple optimizada punto por punto", days: 3 },
  { id: "bifocal-krip", name: "Bifocal Invisible / Kriptok", price: 165000, desc: "Doble foco lejos y lectura", days: 4 },
  { id: "multi-freeform", name: "Multifocal Progresivo FreeForm Varilux", price: 340000, desc: "Corredor amplio sin salto de imagen", days: 6 },
  { id: "ocupacional-pc", name: "Ocupacional Degresivo Shamir Office", price: 210000, desc: "Escritorio y pantallas (40 cm a 4 m)", days: 5 },
] as const;

export const LENS_MATERIALS = [
  { id: "org-156", name: "Orgánico CR-39 1.56", price: 0 },
  { id: "poly-159", name: "Policarbonato 1.59", price: 48000 },
  { id: "hi-167", name: "Alto Índice 1.67", price: 110000 },
  { id: "hi-174", name: "Alto Índice 1.74", price: 185000 },
] as const;

export const LENS_TREATMENTS = [
  { id: "ar-crizal", name: "Antirreflejo Crizal Sapphire HR", price: 58000 },
  { id: "blue-block", name: "Filtro Luz Azul BlueGuard", price: 42000 },
  { id: "photo-trans", name: "Fotocromático Transitions Gen S", price: 125000 },
  { id: "hard-coat", name: "Antirayas Cuarzo + UV400", price: 24000 },
] as const;

export const ACCESSORY_KIT = { id: "kit-zeiss", name: "Kit Limpieza Zeiss 60ml + Microfibra", price: 18500 };

/** Descuento máximo por rol (%). */
export const MAX_DISCOUNT: Record<string, number> = {
  ADMIN: 50,
  VENDEDOR: 15,
  TECNICO_LAB: 0,
};

export const PAYMENT_METHODS = [
  { id: "EFECTIVO", label: "Efectivo ARS", currency: "ARS" },
  { id: "TARJETA_CREDITO", label: "Tarjeta de crédito", currency: "ARS" },
  { id: "TARJETA_DEBITO", label: "Tarjeta de débito", currency: "ARS" },
  { id: "TRANSFERENCIA", label: "Transferencia bancaria", currency: "ARS" },
  { id: "MERCADOPAGO_QR", label: "MercadoPago / Billetera QR", currency: "ARS" },
  { id: "USD_BILLETE", label: "Dólar billete (USD)", currency: "USD" },
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

export const paymentLabel = (id: string) =>
  PAYMENT_METHODS.find((p) => p.id === id)?.label ?? id;

export const SHIFT_NAMES = ["Turno Mañana", "Turno Tarde", "Turno Sábado"] as const;

export const KANBAN_COLUMNS = [
  { id: "RECEPCION", title: "Recepción y Seña", short: "Recepción", step: 1, tone: "blue" },
  { id: "ENVIADO_LAB", title: "Enviado a Laboratorio", short: "Enviado", step: 2, tone: "violet" },
  { id: "TALLADO", title: "En Tallado / Biselado", short: "Tallado", step: 3, tone: "amber" },
  { id: "CONTROL_CALIDAD", title: "Control de Calidad", short: "Calidad", step: 4, tone: "cyan" },
  { id: "LISTO_SUCURSAL", title: "Listo en Sucursal", short: "Listo", step: 5, tone: "emerald" },
  { id: "ENTREGADO", title: "Entregado", short: "Entregado", step: 6, tone: "slate" },
] as const;

export type KanbanStatus = (typeof KANBAN_COLUMNS)[number]["id"];
export const KANBAN_STATUSES = KANBAN_COLUMNS.map((c) => c.id) as [KanbanStatus, ...KanbanStatus[]];

export const INVENTORY_CATEGORIES = [
  { id: "ARMAZON_RECETA", label: "Armazones recetados" },
  { id: "LENTE_SOL", label: "Lentes de sol" },
  { id: "LENTE_CONTACTO", label: "Lentes de contacto" },
  { id: "ACCESORIO", label: "Accesorios y líquidos" },
] as const;

export const HEALTH_INSURANCES = [
  "Particular",
  "OSDE 310",
  "OSDE 410",
  "Swiss Medical SMG50",
  "Galeno Oro",
  "Omint Premium",
  "Medifé",
  "IOMA",
] as const;

