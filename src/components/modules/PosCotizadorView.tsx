"use client";

import React, { useEffect, useState } from "react";
import {
  Glasses,
  Sparkles,
  ScanBarcode,
  CheckCircle2,
  Share2,
  Printer,
  ShieldCheck,
  Layers,
  CreditCard,
  UserCheck,
  FileDown,
  Camera,
} from "lucide-react";
import { ERPState, UserRole } from "@/types/erp";
import { formatARS, formatDiopter } from "@/lib/utils";
import {
  ACCESSORY_KIT,
  LENS_DESIGNS,
  LENS_MATERIALS,
  LENS_TREATMENTS,
  MAX_DISCOUNT,
  PAYMENT_METHODS,
} from "@/lib/catalog";
import { buildWhatsAppUrl, receiptMessage } from "@/lib/whatsapp";
import { downloadOrderPdf } from "@/lib/pdf";
import { CameraScannerModal } from "@/components/ui/CameraScannerModal";

interface PosCotizadorViewProps {
  data: ERPState;
  role: UserRole;
  preselectedPatientId?: string;
  preselectedRxId?: string;
  preselectedFrameId?: string;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: "success" | "warning" | "error") => void;
}

export function PosCotizadorView({
  data,
  role,
  preselectedPatientId,
  preselectedRxId,
  preselectedFrameId,
  onRefresh,
  onToast,
}: PosCotizadorViewProps) {
  const { patients, inventory, labs, activeShift } = data;
  const maxDiscountForRole = MAX_DISCOUNT[role] ?? 15;

  const [patientId, setPatientId] = useState<string>(
    preselectedPatientId || patients[0]?.id || ""
  );
  const selectedPatient =
    patients.find((p) => p.id === patientId) || patients[0];

  const [prescriptionId, setPrescriptionId] = useState<string>(
    preselectedRxId || selectedPatient?.prescriptions[0]?.id || ""
  );
  const selectedRx =
    selectedPatient?.prescriptions.find((r) => r.id === prescriptionId) ||
    selectedPatient?.prescriptions[0];

  const availableFrames = inventory.filter(
    (i) => i.category === "ARMAZON_RECETA" || i.category === "LENTE_SOL"
  );
  const [frameId, setFrameId] = useState<string>(
    preselectedFrameId ||
      availableFrames.find((f) => f.stock > 0)?.id ||
      availableFrames[0]?.id ||
      ""
  );
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  useEffect(() => {
    if (preselectedFrameId) setFrameId(preselectedFrameId);
  }, [preselectedFrameId]);

  const [selectedLensDesign, setSelectedLensDesign] = useState<
    (typeof LENS_DESIGNS)[number]
  >(LENS_DESIGNS[0]);
  const [selectedMaterial, setSelectedMaterial] = useState<
    (typeof LENS_MATERIALS)[number]
  >(LENS_MATERIALS[1]);
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([
    "ar-crizal",
    "blue-block",
  ]);
  const [includeAccessoryKit, setIncludeAccessoryKit] = useState(true);
  const [labId, setLabId] = useState<string>(labs[0]?.id || "");

  const [discountPct, setDiscountPct] = useState<number>(5);
  const [insuranceCoverage, setInsuranceCoverage] = useState<number>(65000);
  const [depositPaid, setDepositPaid] = useState<number>(250000);
  const [paymentMethod, setPaymentMethod] = useState("TARJETA_CREDITO");
  const [submitting, setSubmitting] = useState(false);
  const [createdOrderNum, setCreatedOrderNum] = useState<string | null>(null);

  const selectedFrame = availableFrames.find((f) => f.id === frameId);
  const selectedLab = labs.find((l) => l.id === labId) || labs[0];

  const handleBarcodeLookup = (code: string) => {
    setBarcodeSearch(code);
    const clean = code.trim();
    if (!clean) return;
    const match = availableFrames.find(
      (f) =>
        f.barcode.includes(clean) ||
        f.sku.toLowerCase().includes(clean.toLowerCase())
    );
    if (match) {
      if (match.stock <= 0) {
        onToast(
          `El armazón ${match.brand} ${match.model} no tiene stock disponible.`,
          "warning"
        );
        return;
      }
      setFrameId(match.id);
      onToast(`Armazón seleccionado: ${match.brand} ${match.model}`, "success");
    }
  };

  const toggleTreatment = (id: string) => {
    setSelectedTreatments((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Precios calculados con el catálogo oficial
  const framePrice = selectedFrame?.retailPrice || 0;
  const lensBasePrice = selectedLensDesign.price + selectedMaterial.price;
  const treatmentsPrice = LENS_TREATMENTS.filter((t) =>
    selectedTreatments.includes(t.id)
  ).reduce((sum, t) => sum + t.price, 0);
  const accessoryPrice = includeAccessoryKit ? ACCESSORY_KIT.price : 0;

  const subtotal =
    framePrice + lensBasePrice + treatmentsPrice + accessoryPrice;
  const safeDiscountPct = Math.min(Math.max(discountPct, 0), maxDiscountForRole);
  const discountAmount = Math.round((subtotal * safeDiscountPct) / 100);
  const totalAmount = Math.max(
    subtotal - discountAmount - insuranceCoverage,
    0
  );
  const safeDeposit = Math.min(Math.max(depositPaid, 0), totalAmount);
  const balanceDue = Math.max(totalAmount - safeDeposit, 0);

  const handleConfirmOrder = async () => {
    if (!selectedPatient) return;
    if (selectedFrame && selectedFrame.stock <= 0) {
      onToast("El armazón elegido no tiene stock disponible.", "error");
      return;
    }
    if (safeDeposit > 0 && !activeShift) {
      onToast(
        "La caja está cerrada. Abrí un turno en el módulo Caja antes de cobrar una seña.",
        "warning"
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_POS_ORDER",
          payload: {
            patientId: selectedPatient.id,
            prescriptionId: selectedRx?.id || null,
            frameId: selectedFrame?.id || null,
            designId: selectedLensDesign.id,
            materialId: selectedMaterial.id,
            treatmentIds: selectedTreatments,
            includeAccessoryKit,
            labId: selectedLab?.id,
            discountPct: safeDiscountPct,
            insuranceCovered: insuranceCoverage,
            depositPaid: safeDeposit,
            paymentMethod,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onToast(json.error || "Error al emitir la orden", "error");
        return;
      }
      setCreatedOrderNum(json.order.orderNumber);
      await onRefresh();
      onToast(
        `Orden ${json.order.orderNumber} emitida en transacción atómica y enviada al Kanban.`,
        "success"
      );
    } catch {
      onToast("Error de red al emitir la orden de trabajo.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const whatsappUrl = selectedPatient
    ? buildWhatsAppUrl(
        selectedPatient.phone,
        receiptMessage({
          patientName: selectedPatient.fullName,
          orderNumber: createdOrderNum || "COTIZACION-OPTILUX",
          frame: selectedFrame
            ? `${selectedFrame.brand} ${selectedFrame.model}`
            : "Armazón propio del paciente",
          lenses: `${selectedLensDesign.name} (${selectedMaterial.name})`,
          total: totalAmount,
          deposit: safeDeposit,
          balance: balanceDue,
        })
      )
    : "#";

  const handleDownloadPdf = () => {
    if (!selectedPatient) return;
    const treatmentNames = LENS_TREATMENTS.filter((t) =>
      selectedTreatments.includes(t.id)
    )
      .map((t) => t.name)
      .join(", ");

    downloadOrderPdf({
      orderNumber: createdOrderNum || "COT-PREVIA",
      promisedDate: new Date(
        Date.now() + (selectedLab?.slaDays || 4) * 86_400_000
      ).toISOString(),
      patientName: selectedPatient.fullName,
      patientDni: selectedPatient.dni,
      patientPhone: selectedPatient.phone,
      healthInsurance: selectedPatient.healthInsurance,
      sellerName: "Asesor Óptico OptiLux",
      labName: selectedLab?.name || "Essilor Lab Sur",
      frameName: selectedFrame
        ? `${selectedFrame.brand} ${selectedFrame.model} (${selectedFrame.sku})`
        : "Propio del paciente",
      lensType: selectedLensDesign.name,
      lensMaterial: selectedMaterial.name,
      treatments: treatmentNames || "Estándar UV",
      accessories: includeAccessoryKit
        ? ACCESSORY_KIT.name
        : "Estuche Rígido Boutique",
      subtotal,
      discount: discountAmount,
      insuranceCovered: insuranceCoverage,
      totalAmount,
      depositPaid: safeDeposit,
      balanceDue,
      rx: selectedRx,
    });
    onToast("Comprobante PDF descargado.", "success");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Punto de Venta (POS) & Cotizador Óptico
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Autoridad de precios en servidor, transacción atómica, comprobante PDF y envío codificado por WhatsApp.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-xs font-mono font-semibold">
          <Sparkles className="w-4 h-4" />
          Dto. máx. rol ({role}): {maxDiscountForRole}%
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-5">
          {/* PASO 1 */}
          <div className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                Selección de Paciente y Receta Oftalmológica
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Paciente Titular
                </label>
                <select
                  value={patientId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setPatientId(newId);
                    const p = patients.find((pat) => pat.id === newId);
                    setPrescriptionId(p?.prescriptions[0]?.id || "");
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm font-medium"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.healthInsurance})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Receta Vigente Asociada
                </label>
                <select
                  value={prescriptionId}
                  onChange={(e) => setPrescriptionId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm font-medium"
                >
                  {selectedPatient?.prescriptions.map((rx) => (
                    <option key={rx.id} value={rx.id}>
                      {rx.lensUsage} — {rx.doctorName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedRx && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border border-border/70 font-mono text-xs tabular-clinical">
                <div>
                  <span className="font-bold text-primary">OD: </span>
                  SPH {formatDiopter(selectedRx.odSph)} · CYL{" "}
                  {formatDiopter(selectedRx.odCyl)} × {selectedRx.odAxis}° · ADD{" "}
                  {formatDiopter(selectedRx.odAdd)}
                </div>
                <div>
                  <span className="font-bold text-accent">OI: </span>
                  SPH {formatDiopter(selectedRx.oiSph)} · CYL{" "}
                  {formatDiopter(selectedRx.oiCyl)} × {selectedRx.oiAxis}° · DP{" "}
                  {selectedRx.odDp + selectedRx.oiDp}mm
                </div>
              </div>
            )}
          </div>

          {/* PASO 2: Armazón */}
          <div className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                  <Glasses className="w-4 h-4 text-primary" />
                  Elección de Armazón (Catálogo o Escáner EAN-13)
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <ScanBarcode className="w-4 h-4 text-primary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={barcodeSearch}
                    onChange={(e) => handleBarcodeLookup(e.target.value)}
                    placeholder="Escanear EAN / SKU..."
                    className="pl-9 pr-3 py-1.5 rounded-xl bg-background border border-border text-xs font-mono w-44"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCameraModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-accent/15 text-accent border border-accent/30 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" /> Cámara
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableFrames.map((frame) => {
                const active = frame.id === frameId;
                const outOfStock = frame.stock <= 0;
                return (
                  <button
                    type="button"
                    key={frame.id}
                    disabled={outOfStock}
                    onClick={() => setFrameId(frame.id)}
                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      outOfStock
                        ? "opacity-45 cursor-not-allowed bg-muted/30 border-border"
                        : active
                        ? "bg-primary/10 border-primary shadow-sm cursor-pointer"
                        : "bg-background border-border hover:bg-muted/40 cursor-pointer"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-primary uppercase">
                          {frame.brand}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {frame.caliberLens}□{frame.caliberBridge}-
                          {frame.caliberTemple}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-foreground mt-0.5">
                        {frame.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {frame.color} · {frame.material}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between w-full">
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          outOfStock
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {outOfStock
                          ? "Agotado (0 u.)"
                          : `Stock: ${frame.stock} u.`}
                      </span>
                      <span className="text-sm font-bold font-mono tabular-clinical">
                        {formatARS(frame.retailPrice)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PASO 3: Cristales y Tratamientos */}
          <div className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                3
              </span>
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Diseño de Cristales, Índice y Tratamientos
              </h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">
                Diseño Óptico del Cristal (Par)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {LENS_DESIGNS.map((d) => {
                  const active = selectedLensDesign.id === d.id;
                  return (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => setSelectedLensDesign(d)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        active
                          ? "bg-primary/10 border-primary"
                          : "bg-background border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {d.name}
                        </span>
                        <span className="text-xs font-mono font-bold text-primary tabular-clinical">
                          {formatARS(d.price)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {d.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">
                Material e Índice de Refracción
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {LENS_MATERIALS.map((mat) => {
                  const active = selectedMaterial.id === mat.id;
                  return (
                    <button
                      type="button"
                      key={mat.id}
                      onClick={() => setSelectedMaterial(mat)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        active
                          ? "bg-accent/15 border-accent text-foreground"
                          : "bg-background border-border text-muted-foreground"
                      }`}
                    >
                      <p className="text-xs font-bold text-foreground">
                        {mat.name}
                      </p>
                      <p className="text-[11px] font-mono mt-0.5 tabular-clinical">
                        +{formatARS(mat.price)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">
                Tratamientos Multicapa
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {LENS_TREATMENTS.map((tr) => {
                  const checked = selectedTreatments.includes(tr.id);
                  return (
                    <label
                      key={tr.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                        checked
                          ? "bg-primary/10 border-primary"
                          : "bg-background border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTreatment(tr.id)}
                          className="rounded border-border text-primary"
                        />
                        <span className="text-xs font-semibold">{tr.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold tabular-clinical">
                        +{formatARS(tr.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
              <label className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border cursor-pointer">
                <div>
                  <p className="text-xs font-bold">{ACCESSORY_KIT.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    +{formatARS(ACCESSORY_KIT.price)}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={includeAccessoryKit}
                  onChange={(e) => setIncludeAccessoryKit(e.target.checked)}
                  className="w-4 h-4"
                />
              </label>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1">
                  Derivación a Laboratorio Óptico
                </label>
                <select
                  value={labId}
                  onChange={(e) => setLabId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-xs font-semibold"
                >
                  {labs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} (SLA {l.slaDays}d)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Liquidación, PDF, Impresión y WhatsApp */}
        <div className="lg:col-span-5 rounded-2xl bg-card border border-border p-5 shadow-sm space-y-5 sticky top-20 printable-area">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-primary font-bold">
                Liquidación Óptica Integral
              </span>
              <h2 className="text-lg font-bold">
                Resumen de Orden & Financiación
              </h2>
            </div>
            <CreditCard className="w-5 h-5 text-primary" />
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Armazón ({selectedFrame?.brand} {selectedFrame?.model})
              </span>
              <span className="font-mono font-semibold tabular-clinical">
                {formatARS(framePrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Cristales ({selectedLensDesign.name})
              </span>
              <span className="font-mono font-semibold tabular-clinical">
                {formatARS(lensBasePrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Tratamientos ({selectedTreatments.length} seleccionados)
              </span>
              <span className="font-mono font-semibold tabular-clinical">
                {formatARS(treatmentsPrice)}
              </span>
            </div>
            {includeAccessoryKit && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {ACCESSORY_KIT.name}
                </span>
                <span className="font-mono font-semibold tabular-clinical">
                  {formatARS(accessoryPrice)}
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-border flex justify-between text-sm font-bold">
              <span>Subtotal Bruto</span>
              <span className="font-mono tabular-clinical">
                {formatARS(subtotal)}
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Descuento (Máx {maxDiscountForRole}%)
                </label>
                <input
                  type="number"
                  min="0"
                  max={maxDiscountForRole}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border font-mono text-xs tabular-clinical"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Cobertura Obra Social (ARS)
                </label>
                <input
                  type="number"
                  step="5000"
                  min="0"
                  value={insuranceCoverage}
                  onChange={(e) => setInsuranceCoverage(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border font-mono text-xs tabular-clinical"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Seña / Anticipo Hoy (ARS)
                </label>
                <input
                  type="number"
                  step="10000"
                  min="0"
                  max={totalAmount}
                  value={depositPaid}
                  onChange={(e) => setDepositPaid(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-primary font-mono text-xs font-bold tabular-clinical"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Medio de Pago Seña
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs font-semibold"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Bonificación + Obra Social:</span>
              <span className="font-mono text-accent tabular-clinical">
                -{formatARS(discountAmount + insuranceCoverage)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-bold">Total Neto a Pagar:</span>
              <span className="text-2xl font-bold font-mono text-foreground tabular-clinical">
                {formatARS(totalAmount)}
              </span>
            </div>
            <div className="pt-2 border-t border-border/80 flex justify-between text-xs font-semibold">
              <span className="text-primary">
                Seña Abonada: {formatARS(safeDeposit)}
              </span>
              <span className="text-amber-500 font-mono tabular-clinical">
                Saldo al Retirar: {formatARS(balanceDue)}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirmOrder}
            className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:opacity-95 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
          >
            <CheckCircle2 className="w-4 h-4" />
            {submitting
              ? "Ejecutando Transacción Atómica..."
              : "Confirmar Venta & Emitir Orden a Laboratorio"}
          </button>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-accent/15 border border-accent/30 text-accent text-xs font-bold hover:bg-accent/25 transition cursor-pointer min-h-[44px]"
            >
              <Share2 className="w-3.5 h-3.5" />
              WhatsApp
            </a>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/25 transition cursor-pointer min-h-[44px]"
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF Orden
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-background border border-border text-foreground text-xs font-semibold hover:bg-muted transition cursor-pointer min-h-[44px]"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
          </div>

          {createdOrderNum && (
            <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 text-xs flex items-center gap-2 text-accent font-medium">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                Orden <strong>{createdOrderNum}</strong> creada y disponible en
                el Tablero Kanban.
              </span>
            </div>
          )}
        </div>
      </div>

      <CameraScannerModal
        open={cameraModalOpen}
        onOpenChange={setCameraModalOpen}
        inventory={availableFrames}
        onDetected={handleBarcodeLookup}
      />
    </div>
  );
}
