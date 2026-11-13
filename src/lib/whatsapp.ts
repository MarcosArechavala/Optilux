import { formatARS } from "./utils";

/** Construye un enlace wa.me con el texto correctamente codificado (acentos, &, #, *). */
export function buildWhatsAppUrl(phone: string, text: string): string {
  const clean = phone.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

export function pickupMessage(o: { patientName: string; orderNumber: string; lensType: string; balanceDue: number }) {
  return [
    `Hola *${o.patientName}*! Te escribimos de *OptiLux Boutique Óptica*.`,
    ``,
    `Tu pedido *${o.orderNumber}* (${o.lensType}) superó el control de calidad y está *listo para retirar*.`,
    ``,
    `• Saldo pendiente: ${formatARS(o.balanceDue)}`,
    `• Horario: lunes a sábados de 9:30 a 20:00 hs.`,
  ].join("\n");
}

export function receiptMessage(o: {
  patientName: string;
  orderNumber: string;
  frame: string;
  lenses: string;
  total: number;
  deposit: number;
  balance: number;
}) {
  return [
    `Hola *${o.patientName}*! Este es tu comprobante de *OptiLux Boutique Óptica* (${o.orderNumber}):`,
    ``,
    `• Armazón: ${o.frame}`,
    `• Cristales: ${o.lenses}`,
    `• Total: ${formatARS(o.total)}`,
    `• Seña abonada: ${formatARS(o.deposit)}`,
    `• Saldo al retirar: ${formatARS(o.balance)}`,
    ``,
    `Te avisamos por acá cuando esté listo.`,
  ].join("\n");
}

