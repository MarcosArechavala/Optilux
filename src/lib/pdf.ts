import { jsPDF } from "jspdf";
import { formatARS, formatDate, formatDiopter } from "./utils";
import type { PrescriptionDTO } from "@/types/erp";

export interface PdfOrderData {
  orderNumber: string;
  issueDate?: string;
  promisedDate: string;
  patientName: string;
  patientDni: string;
  patientPhone: string;
  healthInsurance: string;
  sellerName: string;
  labName: string;
  frameName: string;
  lensType: string;
  lensMaterial: string;
  treatments: string;
  accessories: string;
  subtotal: number;
  discount: number;
  insuranceCovered: number;
  totalAmount: number;
  depositPaid: number;
  balanceDue: number;
  rx?: PrescriptionDTO | null;
}

export function downloadOrderPdf(data: PdfOrderData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Encabezado Clínico
  doc.setFillColor(11, 132, 196);
  doc.rect(0, 0, 210, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("OPTILUX PRO — ORDEN DE TRABAJO & COMPROBANTE", 14, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Av. Alvear 1840, CABA · Gabinete & Taller CNC · Orden N°: ${data.orderNumber}`,
    14,
    21
  );

  // Datos del Paciente y Laboratorio
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("1. DATOS DEL PACIENTE Y DERIVACIÓN", 14, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Paciente: ${data.patientName} (DNI: ${data.patientDni})`, 14, 47);
  doc.text(`Obra Social / Prepaga: ${data.healthInsurance}`, 14, 53);
  doc.text(`Teléfono: ${data.patientPhone}`, 14, 59);

  doc.text(`Laboratorio Asignado: ${data.labName}`, 115, 47);
  doc.text(`Entrega Prometida: ${formatDate(data.promisedDate)}`, 115, 53);
  doc.text(`Asesor Óptico: ${data.sellerName}`, 115, 59);

  // Receta Dióptrica OD / OI
  let y = 70;
  if (data.rx) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("2. PRESCRIPCIÓN OFTALMOLÓGICA (OD / OI)", 14, y);
    y += 6;

    doc.setFont("courier", "bold");
    doc.setFontSize(9.5);
    doc.text(
      `OD: SPH ${formatDiopter(data.rx.odSph)} | CYL ${formatDiopter(data.rx.odCyl)} x ${data.rx.odAxis}° | ADD ${formatDiopter(data.rx.odAdd)} | DP ${data.rx.odDp}mm | ALT ${data.rx.odHeight}mm`,
      14,
      y
    );
    y += 6;
    doc.text(
      `OI: SPH ${formatDiopter(data.rx.oiSph)} | CYL ${formatDiopter(data.rx.oiCyl)} x ${data.rx.oiAxis}° | ADD ${formatDiopter(data.rx.oiAdd)} | DP ${data.rx.oiDp}mm | ALT ${data.rx.oiHeight}mm`,
      14,
      y
    );
    y += 10;
  }

  // Especificación de Armazón y Cristales
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("3. CONFIGURACIÓN TÉCNICA ÓPTICA", 14, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`• Armazón seleccionado: ${data.frameName}`, 14, y);
  y += 6;
  doc.text(
    `• Cristales oftálmicos: ${data.lensType} (${data.lensMaterial})`,
    14,
    y
  );
  y += 6;
  doc.text(`• Tratamientos: ${data.treatments}`, 14, y);
  y += 6;
  doc.text(`• Accesorios incluidos: ${data.accessories}`, 14, y);
  y += 12;

  // Liquidación Financiera
  doc.setDrawColor(200, 210, 225);
  doc.line(14, y, 196, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("4. LIQUIDACIÓN Y SALDOS", 14, y);
  y += 7;

  doc.setFont("courier", "normal");
  doc.setFontSize(10);
  doc.text(`Subtotal Bruto:          ${formatARS(data.subtotal)}`, 14, y);
  y += 6;
  doc.text(
    `Descuento + Obra Social: -${formatARS(data.discount + data.insuranceCovered)}`,
    14,
    y
  );
  y += 6;
  doc.setFont("courier", "bold");
  doc.text(`TOTAL NETO ORDEN:        ${formatARS(data.totalAmount)}`, 14, y);
  y += 6;
  doc.text(`Seña Abonada:            ${formatARS(data.depositPaid)}`, 14, y);
  y += 6;
  doc.text(`SALDO AL RETIRAR:        ${formatARS(data.balanceDue)}`, 14, y);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.text(
    "Documento emitido digitalmente por OptiLux PRO ERP. Garantía de adaptación clínica de 30 días.",
    14,
    280
  );

  doc.save(`${data.orderNumber}.pdf`);
}

