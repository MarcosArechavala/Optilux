/** Utilidades EAN-13 (códigos de barras escaneables reales). */

export function ean13CheckDigit(first12: string): number {
  const digits = first12.split("").map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export function buildEan13(first12: string): string {
  if (!/^\d{12}$/.test(first12)) throw new Error("Se requieren 12 dígitos");
  return first12 + ean13CheckDigit(first12);
}

export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/** EAN interno de la tienda (prefijo 200-299 reservado para uso interno GS1). */
export function internalEan(sequence: number): string {
  return buildEan13("200" + String(sequence).padStart(9, "0"));
}

