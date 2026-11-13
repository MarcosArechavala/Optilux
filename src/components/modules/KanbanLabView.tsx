"use client";

import React, { useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  FlaskConical,
  Clock,
  ArrowRight,
  ArrowLeft,
  MessageCircle,
  AlertTriangle,
  GripVertical,
  Filter,
  Glasses,
  History,
  Settings2,
  CreditCard,
  FileDown,
} from "lucide-react";
import { ERPState, KanbanStatus, LabOrderDTO, UserRole } from "@/types/erp";
import { formatARS, formatDate, formatDateTime } from "@/lib/utils";
import { KANBAN_COLUMNS, PAYMENT_METHODS } from "@/lib/catalog";
import { buildWhatsAppUrl, pickupMessage } from "@/lib/whatsapp";
import { downloadOrderPdf } from "@/lib/pdf";
import { can } from "@/lib/permissions";
import { Modal } from "@/components/ui/Modal";

interface KanbanLabViewProps {
  data: ERPState;
  role: UserRole;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: "success" | "warning" | "error") => void;
}

const TONE_BADGES: Record<string, string> = {
  blue: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  violet: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  amber: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  slate: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

function DroppableColumn({
  id,
  children,
}: {
  id: KanbanStatus;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl bg-card/85 border p-3.5 min-h-[520px] flex flex-col justify-between transition ${
        isOver ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      {children}
    </div>
  );
}

function DraggableOrderCard({
  order,
  children,
}: {
  order: LabOrderDTO;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: order.id,
      data: { order },
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl bg-background border p-3.5 shadow-sm space-y-2.5 transition ${
        order.isDelayed
          ? "border-destructive/60 bg-destructive/[0.03]"
          : "border-border hover:border-primary/50"
      } ${isDragging ? "opacity-60 z-30 shadow-xl" : ""}`}
    >
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Arrastrar orden ${order.orderNumber}`}
          className="inline-flex items-center gap-1 font-mono text-xs font-bold text-primary cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
          {order.orderNumber}
        </button>
        {order.isDelayed && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive text-destructive-foreground text-[10px] font-bold uppercase">
            <AlertTriangle className="w-3 h-3" /> Demorado
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function KanbanLabView({
  data,
  role,
  onRefresh,
  onToast,
}: KanbanLabViewProps) {
  const { orders, labs } = data;
  const canManageLabs = can(role, "labs:write");
  const canDeliver = can(role, "orders:deliver");

  const [labFilter, setLabFilter] = useState<string>("ALL");
  const [mobileActiveCol, setMobileActiveCol] =
    useState<KanbanStatus>("RECEPCION");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal de Cobro al Entregar (cuando balanceDue > 0)
  const [deliveryTarget, setDeliveryTarget] = useState<LabOrderDTO | null>(
    null
  );
  const [deliveryPaymentMethod, setDeliveryPaymentMethod] =
    useState("TRANSFERENCIA");

  // Modal Historial de Estados
  const [historyOrder, setHistoryOrder] = useState<LabOrderDTO | null>(null);

  // Modal ABM de Laboratorios
  const [showLabsModal, setShowLabsModal] = useState(false);
  const [labForm, setLabForm] = useState({
    name: "",
    contactName: "",
    phone: "+54911",
    email: "",
    slaDays: 4,
    costFactor: 0.35,
    notes: "",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  const filteredOrders = orders.filter((o) =>
    labFilter === "ALL" ? true : o.labId === labFilter
  );

  const executeStatusMove = async (
    order: LabOrderDTO,
    targetStatus: KanbanStatus,
    paymentMethod?: string
  ) => {
    setUpdatingId(order.id);
    try {
      const res = await fetch("/api/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_ORDER_STATUS",
          payload: {
            orderId: order.id,
            status: targetStatus,
            payment: paymentMethod ? { method: paymentMethod } : undefined,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onToast(json.error || "No se pudo mover la orden", "error");
        return;
      }
      await onRefresh();
      const colName =
        KANBAN_COLUMNS.find((c) => c.id === targetStatus)?.title ||
        targetStatus;
      onToast(
        `Orden ${order.orderNumber} movida a "${colName}"`,
        targetStatus === "LISTO_SUCURSAL" || targetStatus === "ENTREGADO"
          ? "success"
          : "warning"
      );
    } catch {
      onToast("Error al actualizar estado de laboratorio.", "error");
    } finally {
      setUpdatingId(null);
      setDeliveryTarget(null);
    }
  };

  const requestMove = (order: LabOrderDTO, targetStatus: KanbanStatus) => {
    if (order.status === targetStatus) return;
    if (targetStatus === "ENTREGADO") {
      if (!canDeliver) {
        onToast(
          "Solo Vendedores o Administradores pueden entregar órdenes y saldar cuentas.",
          "warning"
        );
        return;
      }
      if (order.balanceDue > 0) {
        setDeliveryTarget(order);
        return;
      }
    }
    executeStatusMove(order, targetStatus);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const ord = orders.find((o) => o.id === active.id);
    const targetStatus = over.id as KanbanStatus;
    if (ord && targetStatus) {
      requestMove(ord, targetStatus);
    }
  };

  const handleCreateLab = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SAVE_LAB",
          payload: labForm,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onToast(json.error || "Error guardando laboratorio", "error");
        return;
      }
      await onRefresh();
      setShowLabsModal(false);
      setLabForm({
        name: "",
        contactName: "",
        phone: "+54911",
        email: "",
        slaDays: 4,
        costFactor: 0.35,
        notes: "",
      });
      onToast(`Laboratorio ${json.lab.name} guardado.`, "success");
    } catch {
      onToast("Error guardando laboratorio.", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Logística de Taller & Laboratorios (Tablero Kanban)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Soporte táctil @dnd-kit, auditoría de estados, modal de cobro en entrega y WhatsApp en 1 clic.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border text-xs">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground font-medium">
              Laboratorio:
            </span>
            <select
              value={labFilter}
              onChange={(e) => setLabFilter(e.target.value)}
              className="bg-transparent font-semibold text-foreground focus:outline-none"
            >
              <option value="ALL">Todos ({orders.length})</option>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {canManageLabs && (
            <button
              type="button"
              onClick={() => setShowLabsModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/15 text-primary border border-primary/30 text-xs font-bold hover:bg-primary/25 cursor-pointer min-h-[40px]"
            >
              <Settings2 className="w-3.5 h-3.5" />
              ABM Laboratorios ({labs.length})
            </button>
          )}
        </div>
      </div>

      {/* Pestañas de Columnas para Móvil (< 768px) */}
      <div className="flex md:hidden gap-1.5 overflow-x-auto pb-1">
        {KANBAN_COLUMNS.map((col) => {
          const count = filteredOrders.filter((o) => o.status === col.id).length;
          const active = mobileActiveCol === col.id;
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => setMobileActiveCol(col.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border"
              }`}
            >
              {col.step}. {col.short} ({count})
            </button>
          );
        })}
      </div>

      {/* Tablero Kanban con @dnd-kit */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 items-start">
          {KANBAN_COLUMNS.map((col, colIdx) => {
            const colOrders = filteredOrders.filter((o) => o.status === col.id);
            const hiddenOnMobile = mobileActiveCol !== col.id;

            return (
              <div
                key={col.id}
                className={hiddenOnMobile ? "hidden md:block" : "block"}
              >
                <DroppableColumn id={col.id}>
                  <div>
                    <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-border">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg border text-xs font-mono font-bold flex items-center justify-center shrink-0 ${
                            TONE_BADGES[col.tone]
                          }`}
                        >
                          {col.step}
                        </span>
                        <h2 className="text-xs font-bold uppercase tracking-wider truncate">
                          {col.title}
                        </h2>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-mono font-bold">
                        {colOrders.length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {colOrders.map((ord) => {
                        const prevCol = KANBAN_COLUMNS[colIdx - 1];
                        const nextCol = KANBAN_COLUMNS[colIdx + 1];
                        const waUrl = buildWhatsAppUrl(
                          ord.patient.phone,
                          pickupMessage({
                            patientName: ord.patient.fullName,
                            orderNumber: ord.orderNumber,
                            lensType: ord.lensType,
                            balanceDue: ord.balanceDue,
                          })
                        );

                        return (
                          <DraggableOrderCard key={ord.id} order={ord}>
                            <div
                              className={
                                updatingId === ord.id ? "opacity-50" : ""
                              }
                            >
                              <p className="text-xs font-bold text-foreground">
                                {ord.patient.fullName}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {ord.lensType} ({ord.lensMaterial})
                              </p>
                            </div>

                            {ord.frame && (
                              <div className="px-2.5 py-1.5 rounded-lg bg-muted/60 text-[11px] font-mono text-foreground truncate flex items-center gap-1.5">
                                <Glasses
                                  className="w-3 h-3 text-primary shrink-0"
                                  aria-hidden="true"
                                />
                                {ord.frame.brand} {ord.frame.model}
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                              <span className="inline-flex items-center gap-1 truncate">
                                <FlaskConical className="w-3 h-3 text-primary shrink-0" />
                                {ord.lab.name}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] font-mono tabular-clinical">
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatDate(ord.promisedDate)}
                              </span>
                              {ord.balanceDue > 0 ? (
                                <span className="text-amber-500 font-bold">
                                  Saldo: {formatARS(ord.balanceDue)}
                                </span>
                              ) : (
                                <span className="text-accent font-bold">
                                  Pagado 100%
                                </span>
                              )}
                            </div>

                            {/* Acciones de PDF e Historial de Auditoría */}
                            <div className="flex items-center justify-between gap-1 text-[11px] pt-1">
                              <button
                                type="button"
                                onClick={() => setHistoryOrder(ord)}
                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <History className="w-3 h-3 text-primary" />
                                Trazabilidad ({ord.statusLogs.length})
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  downloadOrderPdf({
                                    orderNumber: ord.orderNumber,
                                    promisedDate: ord.promisedDate,
                                    patientName: ord.patient.fullName,
                                    patientDni: ord.patient.dni,
                                    patientPhone: ord.patient.phone,
                                    healthInsurance:
                                      ord.patient.healthInsurance,
                                    sellerName: ord.sellerName,
                                    labName: ord.lab.name,
                                    frameName: ord.frame
                                      ? `${ord.frame.brand} ${ord.frame.model}`
                                      : "Propio",
                                    lensType: ord.lensType,
                                    lensMaterial: ord.lensMaterial,
                                    treatments: ord.treatments,
                                    accessories: ord.accessories || "-",
                                    subtotal: ord.subtotal,
                                    discount: ord.discount,
                                    insuranceCovered: ord.insuranceCovered,
                                    totalAmount: ord.totalAmount,
                                    depositPaid: ord.depositPaid,
                                    balanceDue: ord.balanceDue,
                                    rx: ord.prescription,
                                  })
                                }
                                className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer"
                              >
                                <FileDown className="w-3 h-3" /> PDF
                              </button>
                            </div>

                            {col.id === "LISTO_SUCURSAL" && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2 px-2.5 rounded-lg bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 transition"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                Notificar Retiro WhatsApp
                              </a>
                            )}

                            {/* Botones accesibles de avance/retroceso */}
                            <div className="flex items-center justify-between gap-1.5 pt-1">
                              {prevCol ? (
                                <button
                                  type="button"
                                  disabled={updatingId === ord.id}
                                  onClick={() => requestMove(ord, prevCol.id)}
                                  className="px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <ArrowLeft className="w-3 h-3" /> Ant.
                                </button>
                              ) : (
                                <span />
                              )}

                              {nextCol && (
                                <button
                                  type="button"
                                  disabled={updatingId === ord.id}
                                  onClick={() => requestMove(ord, nextCol.id)}
                                  className="px-2.5 py-1 rounded-md bg-primary/15 hover:bg-primary/25 text-primary font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  {nextCol.id === "ENTREGADO"
                                    ? "Entregar"
                                    : "Avanzar"}{" "}
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </DraggableOrderCard>
                        );
                      })}

                      {colOrders.length === 0 && (
                        <div className="h-36 rounded-xl border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground text-center p-4">
                          Soltá una orden aquí o usá &ldquo;Avanzar&rdquo;
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span>Costo Lab:</span>
                    <span>
                      {formatARS(
                        colOrders.reduce((acc, item) => acc + item.labCost, 0)
                      )}
                    </span>
                  </div>
                </DroppableColumn>
              </div>
            );
          })}
        </div>
      </DndContext>

      {/* Modal de Cobro del Saldo Pendiente al Entregar */}
      <Modal
        open={Boolean(deliveryTarget)}
        onOpenChange={(o) => !o && setDeliveryTarget(null)}
        title={`Cobro de Saldo en Entrega — ${deliveryTarget?.orderNumber ?? ""}`}
        description="Seleccioná el medio de pago con el que el paciente abona el saldo pendiente."
      >
        {deliveryTarget && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-muted/50 border border-border space-y-1">
              <p className="font-bold text-sm">
                {deliveryTarget.patient.fullName}
              </p>
              <p className="text-muted-foreground">
                {deliveryTarget.lensType} ({deliveryTarget.lensMaterial})
              </p>
              <p className="text-base font-mono font-bold text-amber-500 pt-1">
                Saldo a cancelar hoy: {formatARS(deliveryTarget.balanceDue)}
              </p>
            </div>

            <div>
              <label className="block font-semibold mb-1.5">
                Medio de Pago Recibido en Mostrador
              </label>
              <select
                value={deliveryPaymentMethod}
                onChange={(e) => setDeliveryPaymentMethod(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm font-semibold"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeliveryTarget(null)}
                className="px-4 py-2 rounded-xl border border-border font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  executeStatusMove(
                    deliveryTarget,
                    "ENTREGADO",
                    deliveryPaymentMethod
                  )
                }
                className="px-4 py-2 rounded-xl bg-accent text-accent-foreground font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                Cobrar Saldo y Marcar Entregado
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Trazabilidad / Historial de Estados (OrderStatusLog) */}
      <Modal
        open={Boolean(historyOrder)}
        onOpenChange={(o) => !o && setHistoryOrder(null)}
        title={`Auditoría de Orden ${historyOrder?.orderNumber ?? ""}`}
        description={`Paciente: ${historyOrder?.patient.fullName ?? ""} · Lab: ${historyOrder?.lab.name ?? ""}`}
      >
        <div className="space-y-3 text-xs">
          {historyOrder?.statusLogs.map((log, i) => (
            <div
              key={log.id}
              className="flex items-start justify-between p-3 rounded-xl bg-background border border-border"
            >
              <div>
                <span className="font-mono font-bold text-primary">
                  #{i + 1} · {log.fromStatus ? `${log.fromStatus} → ` : ""}
                  {log.toStatus}
                </span>
                <p className="text-muted-foreground mt-0.5">
                  Operador: {log.userName}
                </p>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatDateTime(log.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </Modal>

      {/* Modal ABM de Laboratorios Ópticos */}
      <Modal
        open={showLabsModal}
        onOpenChange={setShowLabsModal}
        title="Gestión de Laboratorios Externos y Taller Propio"
        description="Configurá SLA en días hábiles, factor de costo y datos de contacto."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5 text-xs">
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {labs.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between p-3 rounded-xl bg-background border border-border"
              >
                <div>
                  <p className="font-bold text-foreground">{l.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Contacto: {l.contactName || "-"} · Tel: {l.phone || "-"}
                  </p>
                </div>
                <div className="text-right font-mono">
                  <span className="px-2 py-0.5 rounded bg-primary/15 text-primary font-bold">
                    SLA {l.slaDays}d
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Costo: {Math.round(l.costFactor * 100)}%
                  </p>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleCreateLab}
            className="space-y-3 pt-3 border-t border-border"
          >
            <h4 className="font-bold text-sm">Agregar Nuevo Laboratorio</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">
                  Nombre del Laboratorio
                </label>
                <input
                  type="text"
                  required
                  value={labForm.name}
                  onChange={(e) =>
                    setLabForm({ ...labForm, name: e.target.value })
                  }
                  placeholder="Ej. Shamir Lab Buenos Aires"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Responsable / Contacto
                </label>
                <input
                  type="text"
                  value={labForm.contactName}
                  onChange={(e) =>
                    setLabForm({ ...labForm, contactName: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1">Teléfono</label>
                <input
                  type="text"
                  value={labForm.phone}
                  onChange={(e) =>
                    setLabForm({ ...labForm, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  SLA Prometido (días)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={labForm.slaDays}
                  onChange={(e) =>
                    setLabForm({ ...labForm, slaDays: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Factor Costo (0-1)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="0.9"
                  value={labForm.costFactor}
                  onChange={(e) =>
                    setLabForm({
                      ...labForm,
                      costFactor: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold cursor-pointer"
              >
                Guardar Laboratorio
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
