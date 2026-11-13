import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatARS(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

/**
 * Convierte un monto en formato argentino ("1.565", "$ 1.565", "1.250.000")
 * o número plano ("1565") a entero/decimal real sin confundir el punto de miles con decimal.
 */
export function parseMoneyARS(raw: string | number): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const trimmed = String(raw).trim();
  if (!trimmed) return 0;
  // Si tiene coma decimal estilo es-AR (ej. "1.565,50"), quitar puntos de miles y pasar coma a punto
  if (trimmed.includes(",")) {
    const normalized = trimmed.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }
  // Si tiene puntos de miles con exactamente 3 dígitos detrás (ej. "1.565" o "1.250.000"), son miles
  if (/^\$?\s*\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    const digitsOnly = trimmed.replace(/\D/g, "");
    return Number(digitsOnly) || 0;
  }
  const n = Number(trimmed.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function formatThousandsARS(val: number | string): string {
  const n = typeof val === "number" ? val : parseMoneyARS(val);
  if (!n) return "";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);
}

export function formatUSD(amount: number): string {
  return `USD ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(amount)}`;
}

export function formatMoney(amount: number, currency: string) {
  return currency === "USD" ? formatUSD(amount) : formatARS(amount);
}

export function formatDiopter(val: number): string {
  if (!Number.isFinite(val) || val === 0) return "0.00";
  return `${val > 0 ? "+" : ""}${val.toFixed(2)}`;
}

export function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(d: string | Date) {
  return new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysBetween(a: Date | string, b: Date | string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

/** Días restantes hasta el vencimiento (negativo = vencida). Usa la fecha real. */
export function daysUntil(d: Date | string) {
  return Math.ceil(daysBetween(startOfDay(), d));
}

export type RxStatus = "VIGENTE" | "POR_VENCER" | "VENCIDA";
export function rxStatus(expiry: Date | string): RxStatus {
  const left = daysUntil(expiry);
  if (left < 0) return "VENCIDA";
  if (left <= 45) return "POR_VENCER";
  return "VIGENTE";
}
