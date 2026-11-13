"use client";

import React, { useRef, useState } from "react";
import {
  UserPlus,
  FileText,
  Eye,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  Upload,
  Search,
  Sparkles,
  ShoppingBag,
  Phone,
  ShieldCheck,
  ExternalLink,
  Copy,
} from "lucide-react";
import { ERPState, PatientDTO, PrescriptionDTO, UserRole } from "@/types/erp";
import {
  formatARS,
  formatDate,
  formatDiopter,
  rxStatus,
  daysUntil,
} from "@/lib/utils";
import { HEALTH_INSURANCES } from "@/lib/catalog";
import { prescriptionSchema, flattenIssues } from "@/lib/validation";
import { can } from "@/lib/permissions";
import { Modal } from "@/components/ui/Modal";

interface PatientsRxViewProps {
  data: ERPState;
  role: UserRole;
  preselectedPatientId?: string;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: "success" | "warning" | "error") => void;
  onSendToPos: (patientId: string, prescriptionId?: string) => void;
}

interface EyeFields {
  sph: string;
  cyl: string;
  axis: string;
  add: string;
  dp: string;
  height: string;
}

export function PatientsRxView({
  data,
  role,
  preselectedPatientId,
  onRefresh,
  onToast,
  onSendToPos,
}: PatientsRxViewProps) {
  const { patients } = data;
  const canWriteRx = can(role, "rx:write");
  const canWritePatient = can(role, "patients:write");

  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    preselectedPatientId || patients[0]?.id || ""
  );
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [previewAttachment, setPreviewAttachment] =
    useState<PrescriptionDTO | null>(null);

  const errorSummaryRef = useRef<HTMLDivElement>(null);

  // Formulario Receta Técnica (OD / OI)
  const [doctorName, setDoctorName] = useState(
    "Dra. Valeria S. Kriger (MN 94.112)"
  );
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [lensUsage, setLensUsage] = useState("Lejos / Permanente Filtro Azul");
  const [observations, setObservations] = useState(
    "Centrado pupilar monocular verificado con pupilómetro digital."
  );

  const [od, setOd] = useState<EyeFields>({
    sph: "-1.75",
    cyl: "-0.50",
    axis: "180",
    add: "0.00",
    dp: "31.5",
    height: "18.0",
  });
  const [oi, setOi] = useState<EyeFields>({
    sph: "-2.00",
    cyl: "-0.75",
    axis: "175",
    add: "0.00",
    dp: "31.5",
    height: "18.0",
  });

  // Adjunto real subido a /api/uploads
  const [attachment, setAttachment] = useState<{
    name: string;
    path?: string;
    mime?: string;
  } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingRx, setSavingRx] = useState(false);

  // Nuevo Paciente
  const [newPatient, setNewPatient] = useState({
    fullName: "",
    dni: "",
    phone: "+54911",
    email: "",
    healthInsurance: "OSDE 310",
    memberNumber: "",
    notes: "",
  });

  const filteredPatients = patients.filter(
    (p) =>
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.dni.includes(search) ||
      p.healthInsurance.toLowerCase().includes(search.toLowerCase())
  );

  const activePatient: PatientDTO | undefined =
    patients.find((p) => p.id === selectedPatientId) || filteredPatients[0];

  const stepDiopter = (
    eye: "od" | "oi",
    field: "sph" | "cyl" | "add",
    delta: number
  ) => {
    const setter = eye === "od" ? setOd : setOi;
    setter((prev) => {
      const current = parseFloat(prev[field]) || 0;
      const next = Math.round((current + delta) * 4) / 4;
      const clamped =
        field === "add" ? Math.max(0, Math.min(4, next)) : next;
      return { ...prev, [field]: clamped.toFixed(2) };
    });
  };

  const handleUploadFile = async (file: File) => {
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        onToast(json.error || "Error subiendo archivo", "error");
        return;
      }
      setAttachment({
        name: json.attachmentName,
        path: json.attachmentPath,
        mime: json.attachmentMime,
      });
      onToast(
        `Receta física "${json.attachmentName}" almacenada en el servidor.`,
        "success"
      );
    } catch {
      onToast("Error subiendo adjunto médico", "error");
    } finally {
      setUploadingFile(false);
    }
  };

  const validateAndSaveRx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) return;

    const payload = {
      patientId: activePatient.id,
      doctorName,
      issueDate,
      od,
      oi,
      lensUsage,
      observations,
      attachmentName: attachment?.name ?? null,
      attachmentPath: attachment?.path ?? null,
      attachmentMime: attachment?.mime ?? null,
    };

    const check = prescriptionSchema.safeParse(payload);
    if (!check.success) {
      const errs = flattenIssues(check.error);
      setFieldErrors(errs);
      setTimeout(() => errorSummaryRef.current?.focus(), 50);
      return;
    }

    setFieldErrors({});
    setSavingRx(true);
    try {
      const res = await fetch("/api/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_PRESCRIPTION",
          payload,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.fields) setFieldErrors(json.fields);
        onToast(json.error || "Error guardando receta", "error");
        return;
      }
      await onRefresh();
      setAttachment(null);
      onToast(
        `Receta oftalmológica registrada en la ficha de ${activePatient.fullName}`,
        "success"
      );
    } catch {
      onToast("Error al guardar la receta clínica", "error");
    } finally {
      setSavingRx(false);
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_PATIENT",
          payload: newPatient,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onToast(json.error || "Datos de paciente inválidos", "error");
        return;
      }
      await onRefresh();
      setSelectedPatientId(json.patient.id);
      setShowNewPatientModal(false);
      setNewPatient({
        fullName: "",
        dni: "",
        phone: "+54911",
        email: "",
        healthInsurance: "OSDE 310",
        memberNumber: "",
        notes: "",
      });
      onToast(`Paciente ${json.patient.fullName} dado de alta.`, "success");
    } catch {
      onToast("Error al crear paciente.", "error");
    }
  };

  const renderEyeCardInput = (
    eyeKey: "od" | "oi",
    title: string,
    values: EyeFields,
    setValues: React.Dispatch<React.SetStateAction<EyeFields>>,
    accentClass: string
  ) => (
    <div className="rounded-2xl bg-background border border-border p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <span className={`text-xs font-bold font-mono ${accentClass}`}>
          {title}
        </span>
        {eyeKey === "oi" && (
          <button
            type="button"
            onClick={() => setOi({ ...od })}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
          >
            <Copy className="w-3 h-3" /> Copiar valores de OD
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(
          [
            { key: "sph", label: "Esfera (SPH)", step: "0.25", isDiopter: true },
            {
              key: "cyl",
              label: "Cilindro (CYL)",
              step: "0.25",
              isDiopter: true,
            },
            {
              key: "axis",
              label: "Eje (AXIS 0-180°)",
              step: "1",
              isDiopter: false,
            },
            {
              key: "add",
              label: "Adición (ADD)",
              step: "0.25",
              isDiopter: true,
            },
            {
              key: "dp",
              label: "D. Pupilar (mm)",
              step: "0.5",
              isDiopter: false,
            },
            {
              key: "height",
              label: "Alt. Focal (mm)",
              step: "0.5",
              isDiopter: false,
            },
          ] as const
        ).map((f) => {
          const errKey = `${eyeKey}.${f.key}`;
          const hasErr = Boolean(fieldErrors[errKey]);
          return (
            <div key={f.key}>
              <label
                htmlFor={`${eyeKey}-${f.key}`}
                className="block text-[11px] font-semibold text-muted-foreground mb-1"
              >
                {f.label}
              </label>
              <div className="flex items-center gap-1">
                {f.isDiopter && (
                  <button
                    type="button"
                    onClick={() =>
                      stepDiopter(
                        eyeKey,
                        f.key as "sph" | "cyl" | "add",
                        -0.25
                      )
                    }
                    aria-label={`Disminuir ${f.label} 0.25`}
                    className="w-7 h-8 rounded-lg bg-muted hover:bg-muted/80 font-mono text-xs font-bold shrink-0 cursor-pointer"
                  >
                    -
                  </button>
                )}
                <input
                  id={`${eyeKey}-${f.key}`}
                  type="number"
                  step={f.step}
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                  onBlur={() => {
                    if (f.isDiopter) {
                      const n = parseFloat(values[f.key]);
                      if (Number.isFinite(n)) {
                        setValues((prev) => ({
                          ...prev,
                          [f.key]: n.toFixed(2),
                        }));
                      }
                    }
                  }}
                  className={`w-full px-2 py-1.5 rounded-lg bg-card border font-mono text-xs text-right tabular-clinical ${
                    hasErr ? "border-destructive" : "border-border"
                  }`}
                />
                {f.isDiopter && (
                  <button
                    type="button"
                    onClick={() =>
                      stepDiopter(
                        eyeKey,
                        f.key as "sph" | "cyl" | "add",
                        0.25
                      )
                    }
                    aria-label={`Aumentar ${f.label} 0.25`}
                    className="w-7 h-8 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 font-mono text-xs font-bold shrink-0 cursor-pointer"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Ficha Clínica de Pacientes & Recetas (Rx)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Grilla dióptrica con steppers ±0.25 D, validación de eje astigmático, adjunto real en servidor y alertas de vencimiento.
          </p>
        </div>
        {canWritePatient && (
          <button
            onClick={() => setShowNewPatientModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:opacity-95 active:scale-[0.98] transition cursor-pointer min-h-[44px]"
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            Nuevo Paciente Clínico
          </button>
        )}
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Columna Izquierda: Padrón de Pacientes */}
        <div className="lg:col-span-4 rounded-2xl bg-card border border-border p-4 shadow-sm space-y-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, DNI u Obra Social..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border text-sm"
            />
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {filteredPatients.map((p) => {
              const isSelected = activePatient?.id === p.id;
              const latestRx = p.prescriptions[0];
              const status = latestRx ? rxStatus(latestRx.expiryDate) : null;

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "bg-background/60 border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {p.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono tabular-clinical">
                        DNI {p.dni} · {p.healthInsurance}
                      </p>
                    </div>
                    {status === "POR_VENCER" && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-bold uppercase tracking-wider shrink-0">
                        Vence en {daysUntil(latestRx.expiryDate)}d
                      </span>
                    )}
                    {status === "VENCIDA" && (
                      <span className="px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold uppercase tracking-wider shrink-0">
                        Rx Vencida
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {p.prescriptions.length} receta(s)
                    </span>
                    {p.balance > 0 ? (
                      <span className="font-mono font-semibold text-amber-500 tabular-clinical">
                        Saldo: {formatARS(p.balance)}
                      </span>
                    ) : (
                      <span className="font-mono text-accent font-medium">
                        Al día
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha */}
        {activePatient && (
          <div className="lg:col-span-8 space-y-5">
            <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">
                      {activePatient.fullName}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-semibold">
                      {activePatient.healthInsurance}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-1.5 font-mono tabular-clinical">
                    <span>DNI: {activePatient.dni}</span>
                    <span>Credencial: {activePatient.memberNumber || "-"}</span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {activePatient.phone}
                    </span>
                  </div>
                </div>

                {can(role, "pos:create") && (
                  <button
                    onClick={() =>
                      onSendToPos(
                        activePatient.id,
                        activePatient.prescriptions[0]?.id
                      )
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold shadow-sm hover:opacity-95 transition cursor-pointer min-h-[44px]"
                  >
                    <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                    Cotizar Receta en POS
                  </button>
                )}
              </div>

              {activePatient.notes && (
                <div className="mt-3 p-3 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground">
                  <strong className="text-foreground">
                    Anamnesis y Perfil Visual:{" "}
                  </strong>
                  {activePatient.notes}
                </div>
              )}

              {/* Historial de Recetas */}
              <div className="mt-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  Recetas Oftalmológicas Registradas
                </h3>

                {activePatient.prescriptions.map((rx) => {
                  const st = rxStatus(rx.expiryDate);
                  return (
                    <div
                      key={rx.id}
                      className="rounded-xl bg-background border border-border p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            {rx.doctorName} ·{" "}
                            <span className="text-primary">{rx.lensUsage}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono tabular-clinical">
                            Emitida: {formatDate(rx.issueDate)} · Vence:{" "}
                            {formatDate(rx.expiryDate)}
                          </p>
                        </div>

                        {st === "VIGENTE" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/15 text-accent text-xs font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Vigente ({daysUntil(rx.expiryDate)} días)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-500 text-xs font-semibold">
                            <CalendarClock className="w-3.5 h-3.5" />
                            Renovación Anual ({daysUntil(rx.expiryDate)}d)
                          </span>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono tabular-clinical border-collapse">
                          <thead>
                            <tr className="border-b border-border text-muted-foreground bg-muted/40">
                              <th className="py-2 px-2.5 text-left">OJO</th>
                              <th className="py-2 px-2.5 text-right">SPH</th>
                              <th className="py-2 px-2.5 text-right">CYL</th>
                              <th className="py-2 px-2.5 text-right">AXIS</th>
                              <th className="py-2 px-2.5 text-right">ADD</th>
                              <th className="py-2 px-2.5 text-right">DP</th>
                              <th className="py-2 px-2.5 text-right">ALT</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            <tr>
                              <td className="py-2 px-2.5 font-bold text-primary">
                                OD (Der)
                              </td>
                              <td className="py-2 px-2.5 text-right font-semibold">
                                {formatDiopter(rx.odSph)} D
                              </td>
                              <td className="py-2 px-2.5 text-right font-semibold">
                                {formatDiopter(rx.odCyl)} D
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {rx.odAxis}°
                              </td>
                              <td className="py-2 px-2.5 text-right text-accent font-semibold">
                                {formatDiopter(rx.odAdd)} D
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {rx.odDp.toFixed(1)} mm
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {rx.odHeight.toFixed(1)} mm
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-2.5 font-bold text-accent">
                                OI (Izq)
                              </td>
                              <td className="py-2 px-2.5 text-right font-semibold">
                                {formatDiopter(rx.oiSph)} D
                              </td>
                              <td className="py-2 px-2.5 text-right font-semibold">
                                {formatDiopter(rx.oiCyl)} D
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {rx.oiAxis}°
                              </td>
                              <td className="py-2 px-2.5 text-right text-accent font-semibold">
                                {formatDiopter(rx.oiAdd)} D
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {rx.oiDp.toFixed(1)} mm
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {rx.oiHeight.toFixed(1)} mm
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
                        <span className="text-muted-foreground">
                          Obs: {rx.observations || "Sin observaciones"}
                        </span>
                        {rx.attachmentName && (
                          <button
                            type="button"
                            onClick={() => setPreviewAttachment(rx)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary font-mono text-[11px] hover:bg-primary/20 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {rx.attachmentName}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Formulario de Nueva Receta Técnica */}
            {canWriteRx && (
              <form
                onSubmit={validateAndSaveRx}
                className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <h3 className="text-base font-bold tracking-tight flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Cargar Nueva Receta Técnica Oftalmológica
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Steppers ±0.25 D, validación de eje obligatorio cuando CYL ≠ 0 y subida real de receta médica.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-primary/10 text-primary font-semibold">
                    Norma ISO 13666
                  </span>
                </div>

                {/* Resumen de Errores Enfocable (WCAG 2.2) */}
                {Object.keys(fieldErrors).length > 0 && (
                  <div
                    ref={errorSummaryRef}
                    tabIndex={-1}
                    role="alert"
                    aria-labelledby="rx-error-heading"
                    className="p-4 rounded-xl bg-destructive/10 border border-destructive text-destructive text-xs space-y-1.5 focus:outline-none"
                  >
                    <p
                      id="rx-error-heading"
                      className="font-bold flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Revisá los siguientes parámetros clínicos antes de guardar:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {Object.entries(fieldErrors).map(([k, msg]) => (
                        <li key={k}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Médico Oftalmólogo (MN/MP)
                    </label>
                    <input
                      type="text"
                      required
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Fecha de Prescripción
                    </label>
                    <input
                      type="date"
                      required
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Uso Clínico Recomendado
                    </label>
                    <select
                      value={lensUsage}
                      onChange={(e) => setLensUsage(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs font-medium"
                    >
                      <option>Lejos / Permanente Filtro Azul</option>
                      <option>Multifocal FreeForm Digital</option>
                      <option>Ocupacional Intermedia / PC</option>
                      <option>Cerca / Lectura</option>
                      <option>Solar Graduado Polarizado</option>
                    </select>
                  </div>
                </div>

                {/* Tarjetas OD y OI con etiquetas visibles en móvil y escritorio */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {renderEyeCardInput(
                    "od",
                    "OJO DERECHO (OD)",
                    od,
                    setOd,
                    "text-primary"
                  )}
                  {renderEyeCardInput(
                    "oi",
                    "OJO IZQUIERDO (OI)",
                    oi,
                    setOi,
                    "text-accent"
                  )}
                </div>

                {/* Subida real de archivo médico + observaciones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Digitalización Receta Física (PDF / JPG / PNG)
                    </label>
                    <label className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-dashed border-primary/50 bg-primary/5 cursor-pointer hover:bg-primary/10 transition">
                      <span className="text-xs font-mono truncate text-foreground">
                        {uploadingFile
                          ? "Subiendo archivo al servidor..."
                          : attachment?.name || "Seleccionar archivo..."}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
                        <Upload className="w-3.5 h-3.5" /> Subir
                      </span>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadFile(file);
                        }}
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Observaciones de Gabinete
                    </label>
                    <input
                      type="text"
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingRx}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:opacity-95 active:scale-[0.98] transition cursor-pointer min-h-[44px]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {savingRx
                      ? "Guardando Receta..."
                      : "Registrar Receta en Ficha Clínica"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Modal Accesible Radix: Nuevo Paciente */}
      <Modal
        open={showNewPatientModal}
        onOpenChange={setShowNewPatientModal}
        title="Alta de Nuevo Paciente Clínico"
        description="Registrá los datos filiatorios y cobertura médica."
      >
        <form onSubmit={handleCreatePatient} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">
              Nombre y Apellido Completo
            </label>
            <input
              type="text"
              required
              value={newPatient.fullName}
              onChange={(e) =>
                setNewPatient({ ...newPatient, fullName: e.target.value })
              }
              placeholder="Ej. Dra. Carolina Pazos"
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">
                DNI / Documento
              </label>
              <input
                type="text"
                required
                value={newPatient.dni}
                onChange={(e) =>
                  setNewPatient({ ...newPatient, dni: e.target.value })
                }
                placeholder="34.912.401"
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                WhatsApp / Móvil (+549...)
              </label>
              <input
                type="text"
                required
                value={newPatient.phone}
                onChange={(e) =>
                  setNewPatient({ ...newPatient, phone: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">
                Obra Social / Prepaga
              </label>
              <select
                value={newPatient.healthInsurance}
                onChange={(e) =>
                  setNewPatient({
                    ...newPatient,
                    healthInsurance: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm"
              >
                {HEALTH_INSURANCES.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">N° de Afiliado</label>
              <input
                type="text"
                value={newPatient.memberNumber}
                onChange={(e) =>
                  setNewPatient({
                    ...newPatient,
                    memberNumber: e.target.value,
                  })
                }
                placeholder="61-994201-01"
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">
              Observaciones / Antecedentes Visuales
            </label>
            <textarea
              rows={2}
              value={newPatient.notes}
              onChange={(e) =>
                setNewPatient({ ...newPatient, notes: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewPatientModal(false)}
              className="px-4 py-2 rounded-xl border border-border font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold cursor-pointer"
            >
              Crear Paciente
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Previsualización de Receta Médica Adjunta */}
      <Modal
        open={Boolean(previewAttachment)}
        onOpenChange={(o) => !o && setPreviewAttachment(null)}
        title={`Adjunto Médico: ${previewAttachment?.attachmentName ?? ""}`}
        description={`Prescripción de ${previewAttachment?.doctorName ?? ""}`}
        maxWidth="max-w-2xl"
      >
        {previewAttachment?.attachmentPath ? (
          previewAttachment.attachmentMime?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/uploads/${previewAttachment.attachmentPath}`}
              alt={previewAttachment.attachmentName ?? "Receta médica"}
              className="w-full max-h-[65vh] object-contain rounded-xl border border-border"
            />
          ) : (
            <iframe
              src={`/api/uploads/${previewAttachment.attachmentPath}`}
              title={previewAttachment.attachmentName ?? "PDF Receta"}
              className="w-full h-[65vh] rounded-xl border border-border"
            />
          )
        ) : (
          <div className="p-6 rounded-xl bg-muted/40 border border-border text-xs space-y-2">
            <p className="font-bold text-foreground">
              Documento Clínico Verificado: {previewAttachment?.attachmentName}
            </p>
            <p className="text-muted-foreground">
              Profesional firmante: {previewAttachment?.doctorName} · Uso:{" "}
              {previewAttachment?.lensUsage}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
