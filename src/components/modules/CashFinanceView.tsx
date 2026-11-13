"use client";

import React, { useState } from "react";
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Lock,
  Unlock,
  PlusCircle,
  CheckCircle2,
  CreditCard,
  Banknote,
  QrCode,
  DollarSign,
  Settings,
} from "lucide-react";
import { ERPState, UserRole } from "@/types/erp";
import {
  formatARS,
  formatDateTime,
  formatThousandsARS,
  formatUSD,
  parseMoneyARS,
} from "@/lib/utils";
import { PAYMENT_METHODS, SHIFT_NAMES, paymentLabel } from "@/lib/catalog";
import { can } from "@/lib/permissions";
import { Modal } from "@/components/ui/Modal";

interface CashFinanceViewProps {
  data: ERPState;
  role: UserRole;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: "success" | "warning" | "error") => void;
}

export function CashFinanceView({
  data,
  role,
  onRefresh,
  onToast,
}: CashFinanceViewProps) {
  const { transactions, patients, activeShift, recentShifts, metrics } = data;
  const canEditSettings = can(role, "settings:write");

  // Modales de Apertura, Arqueo de Cierre y Cotización USD
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [closeShiftModal, setCloseShiftModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);

  const [shiftName, setShiftName] = useState<(typeof SHIFT_NAMES)[number]>(
    "Turno Mañana"
  );
  const [openingAmount, setOpeningAmount] = useState(150000);
  const [declaredCash, setDeclaredCash] = useState(350000);
  const [declaredUsd, setDeclaredUsd] = useState(320);

  const [usdRateInput, setUsdRateInput] = useState<string>(
    formatThousandsARS(metrics.usdRate)
  );
  const [dailyTargetInput, setDailyTargetInput] = useState<string>(
    formatThousandsARS(metrics.dailyTarget)
  );

  const [newTx, setNewTx] = useState({
    type: "INGRESO" as "INGRESO" | "EGRESO",
    category: "SENA_POS",
    paymentMethod: "EFECTIVO",
    amount: 85000,
    reference: "Cobro Ajuste Lente de Contacto Acuvue",
  });

  // Totales Reales
  const arsIncome = transactions
    .filter((t) => t.type === "INGRESO" && t.currency === "ARS")
    .reduce((acc, t) => acc + t.amount, 0);

  const arsExpense = transactions
    .filter((t) => t.type === "EGRESO" && t.currency === "ARS")
    .reduce((acc, t) => acc + t.amount, 0);

  const netArsCash =
    (activeShift?.openingAmount ?? 0) + arsIncome - arsExpense;

  const usdTotal = transactions
    .filter((t) => t.currency === "USD")
    .reduce((acc, t) => acc + (t.type === "INGRESO" ? t.amount : -t.amount), 0);

  const consolidatedArs = netArsCash + usdTotal * metrics.usdRate;

  const byMethod = (method: string) =>
    transactions
      .filter((t) => t.paymentMethod === method && t.type === "INGRESO")
      .reduce((acc, t) => acc + t.amountArs, 0);

  const patientsWithDebt = patients.filter((p) => p.balance > 0);
  const totalReceivables = patientsWithDebt.reduce(
    (acc, p) => acc + p.balance,
    0
  );

  const handleRegisterTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) {
      onToast(
        "La caja está cerrada. Abrí un turno de caja antes de registrar movimientos.",
        "warning"
      );
      return;
    }
    try {
      const res = await fetch("/api/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_CASH_TRANSACTION",
          payload: newTx,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onToast(json.error || "Error registrando movimiento", "error");
        return;
      }
      await onRefresh();
      onToast("Movimiento asentado en el turno actual.", "success");
    } catch {
      onToast("Error registrando movimiento de caja.", "error");
    }
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/erp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "MANAGE_SHIFT",
        payload: {
          action: "open",
          name: shiftName,
          openingAmount,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      onToast(json.error || "No se pudo abrir el turno", "error");
      return;
    }
    setOpenShiftModal(false);
    await onRefresh();
    onToast(`Turno "${shiftName}" abierto en base de datos.`, "success");
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/erp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "MANAGE_SHIFT",
        payload: {
          action: "close",
          declaredCash,
          declaredUsd,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      onToast(json.error || "No se pudo cerrar el turno", "error");
      return;
    }
    setCloseShiftModal(false);
    await onRefresh();
    onToast(
      `Arqueo Z cerrado. Diferencia ARS: ${formatARS(
        json.shift.difference ?? 0
      )}`,
      "success"
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedUsd = parseMoneyARS(usdRateInput);
    const parsedTarget = parseMoneyARS(dailyTargetInput);
    const res = await fetch("/api/erp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_SETTINGS",
        payload: {
          usdRate: parsedUsd,
          dailyTarget: parsedTarget,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      onToast(json.error || "Cotización inválida", "error");
      return;
    }
    setSettingsModal(false);
    await onRefresh();
    onToast(
      `Cotización actualizada a ${formatARS(parsedUsd)} y Meta Diaria guardada.`,
      "success"
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Caja, Turnos Persistentes & Cuentas Corrientes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Estado de turno en base de datos, arqueo Z con diferencia declarada vs esperada y consolidación ARS/USD.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canEditSettings && (
            <button
              type="button"
              onClick={() => {
                setUsdRateInput(formatThousandsARS(metrics.usdRate));
                setDailyTargetInput(formatThousandsARS(metrics.dailyTarget));
                setSettingsModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-card border border-border text-xs font-bold hover:bg-muted cursor-pointer min-h-[44px]"
            >
              <Settings className="w-4 h-4 text-primary" />
              USD: {formatARS(metrics.usdRate)}
            </button>
          )}

          {activeShift ? (
            <button
              type="button"
              onClick={() => setCloseShiftModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-bold text-xs shadow-sm cursor-pointer min-h-[44px]"
            >
              <Lock className="w-4 h-4" />
              Cerrar {activeShift.name} (Arqueo Z)
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOpenShiftModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground font-bold text-xs shadow-sm cursor-pointer min-h-[44px]"
            >
              <Unlock className="w-4 h-4" />
              Abrir Nuevo Turno de Caja
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de Arqueo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>CONSOLIDADO (ARS + USD)</span>
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-clinical mt-2">
            {formatARS(consolidatedArs)}
          </p>
          <p className="text-[11px] text-accent mt-1">
            Neto ARS: {formatARS(netArsCash)}
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>TARJETAS CRÉDITO / DÉB</span>
            <CreditCard className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-xl font-bold font-mono tabular-clinical mt-2">
            {formatARS(
              byMethod("TARJETA_CREDITO") + byMethod("TARJETA_DEBITO")
            )}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Cuotas s/interés & Débito
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>TRANSFERENCIAS & QR</span>
            <QrCode className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-xl font-bold font-mono tabular-clinical mt-2">
            {formatARS(
              byMethod("TRANSFERENCIA") + byMethod("MERCADOPAGO_QR")
            )}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Acreditación CBU / CVU
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>EFECTIVO FÍSICO ARS</span>
            <Banknote className="w-4 h-4 text-accent" />
          </div>
          <p className="text-xl font-bold font-mono tabular-clinical mt-2">
            {formatARS(
              (activeShift?.openingAmount ?? 0) + byMethod("EFECTIVO")
            )}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Fondo inicial: {formatARS(activeShift?.openingAmount ?? 0)}
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>ARQUEO DÓLAR (USD)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-400 tabular-clinical mt-2">
            {formatUSD(usdTotal)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Equiv: {formatARS(usdTotal * metrics.usdRate)}
          </p>
        </div>
      </div>

      {/* Grilla Inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          <div className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">
                Libro Diario de Movimientos de Caja
              </h2>
              <span className="text-xs font-mono text-muted-foreground">
                {transactions.length} asientos
              </span>
            </div>

            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {transactions.map((tx) => {
                const isOut = tx.type === "EGRESO";
                return (
                  <div
                    key={tx.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-background border border-border"
                  >
                    <div className="flex items-start gap-3">
                      {isOut ? (
                        <ArrowDownCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      ) : (
                        <ArrowUpCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {tx.reference}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {tx.category} · {paymentLabel(tx.paymentMethod)} ·{" "}
                          {tx.operatorName} · {formatDateTime(tx.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-clinical">
                      <span
                        className={`text-sm font-bold ${
                          isOut ? "text-destructive" : "text-accent"
                        }`}
                      >
                        {isOut ? "-" : "+"}
                        {tx.currency === "USD"
                          ? `${formatUSD(tx.amount)} (${formatARS(tx.amountArs)})`
                          : formatARS(tx.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historial de Cierres / Arqueos Z */}
          <div className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold">
              Historial de Turnos y Arqueos Z (Persistidos en SQLite)
            </h3>
            <div className="space-y-2">
              {recentShifts.map((sh) => (
                <div
                  key={sh.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-background border border-border text-xs font-mono"
                >
                  <div>
                    <span className="font-bold text-foreground">{sh.name}</span>{" "}
                    · Abrió: {sh.openedByName} ({formatDateTime(sh.openedAt)})
                  </div>
                  <div className="flex items-center gap-2">
                    {sh.status === "OPEN" ? (
                      <span className="px-2 py-0.5 rounded bg-accent/15 text-accent font-bold">
                        TURNO ABIERTO
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Cerrado · Dif ARS: {formatARS(sh.difference ?? 0)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Columna Derecha */}
        <div className="lg:col-span-4 space-y-5">
          <form
            onSubmit={handleRegisterTransaction}
            className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-3"
          >
            <h3 className="text-sm font-bold flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-primary" />
              Registrar Ingreso / Egreso Manual
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <select
                value={newTx.type}
                onChange={(e) =>
                  setNewTx({
                    ...newTx,
                    type: e.target.value as "INGRESO" | "EGRESO",
                  })
                }
                className="px-3 py-2 rounded-xl bg-background border border-border font-semibold"
              >
                <option value="INGRESO">INGRESO (+)</option>
                <option value="EGRESO">EGRESO (-)</option>
              </select>

              <select
                value={newTx.paymentMethod}
                onChange={(e) =>
                  setNewTx({ ...newTx, paymentMethod: e.target.value })
                }
                className="px-3 py-2 rounded-xl bg-background border border-border font-semibold"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                value={newTx.category}
                onChange={(e) =>
                  setNewTx({ ...newTx, category: e.target.value })
                }
                placeholder="Categoría..."
                className="px-3 py-2 rounded-xl bg-background border border-border font-mono"
              />
              <input
                type="number"
                required
                value={newTx.amount}
                onChange={(e) =>
                  setNewTx({ ...newTx, amount: Number(e.target.value) })
                }
                className="px-3 py-2 rounded-xl bg-background border border-border font-mono text-right"
              />
            </div>

            <input
              type="text"
              required
              value={newTx.reference}
              onChange={(e) =>
                setNewTx({ ...newTx, reference: e.target.value })
              }
              placeholder="Concepto o N° de Orden / Factura Lab..."
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs"
            />

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-95 transition cursor-pointer min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              Asentar Movimiento en Caja
            </button>
          </form>

          {/* Cuentas Corrientes */}
          <div className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">
                Cuentas Corrientes (Saldos por Cobrar)
              </h3>
              <span className="text-xs font-mono font-bold text-amber-500 tabular-clinical">
                {formatARS(totalReceivables)}
              </span>
            </div>

            <div className="space-y-2">
              {patientsWithDebt.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-background border border-border text-xs"
                >
                  <div>
                    <p className="font-bold text-foreground">{p.fullName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.healthInsurance} · Tel {p.phone}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-amber-500 tabular-clinical">
                    {formatARS(p.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Abrir Turno */}
      <Modal
        open={openShiftModal}
        onOpenChange={setOpenShiftModal}
        title="Apertura de Turno de Caja"
        description="Registrá el fondo fijo inicial en efectivo para habilitar cobros en POS y entregas."
      >
        <form onSubmit={handleOpenShift} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Turno Operativo</label>
            <select
              value={shiftName}
              onChange={(e) =>
                setShiftName(e.target.value as (typeof SHIFT_NAMES)[number])
              }
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm"
            >
              {SHIFT_NAMES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">
              Fondo Fijo Inicial en Efectivo (ARS)
            </label>
            <input
              type="number"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border font-mono text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-accent text-accent-foreground font-bold cursor-pointer"
            >
              Confirmar Apertura
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Cerrar Turno (Arqueo Z) */}
      <Modal
        open={closeShiftModal}
        onOpenChange={setCloseShiftModal}
        title={`Arqueo y Cierre Z — ${activeShift?.name ?? ""}`}
        description="Ingresá el recuento físico de billetes en gaveta para calcular la diferencia de arqueo."
      >
        <form onSubmit={handleCloseShift} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">
              Efectivo ARS Contado en Gaveta
            </label>
            <input
              type="number"
              value={declaredCash}
              onChange={(e) => setDeclaredCash(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border font-mono text-sm"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">
              Dólares Físicos (USD Billete) Contados
            </label>
            <input
              type="number"
              value={declaredUsd}
              onChange={(e) => setDeclaredUsd(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border font-mono text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground font-bold cursor-pointer"
            >
              Firmar Arqueo y Cerrar Caja
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Configuración USD y Meta Diaria */}
      <Modal
        open={settingsModal}
        onOpenChange={setSettingsModal}
        title="Parámetros Financieros y Cotización USD"
        description="Estos valores se utilizan para consolidar el arqueo multi-moneda y el gráfico del Dashboard."
      >
        <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">
              Cotización Dólar Óptico (1 USD en ARS)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={usdRateInput}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setUsdRateInput(
                    digits ? formatThousandsARS(Number(digits)) : ""
                  );
                }}
                placeholder="1.565"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-background border border-border font-mono text-sm font-bold"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Podés escribir <strong>1565</strong> o <strong>1.565</strong> → se interpreta como{" "}
              <strong className="text-foreground">
                {formatARS(parseMoneyARS(usdRateInput))}
              </strong>
            </p>
          </div>
          <div>
            <label className="block font-semibold mb-1">
              Meta Diaria de Facturación (ARS)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={dailyTargetInput}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setDailyTargetInput(
                    digits ? formatThousandsARS(Number(digits)) : ""
                  );
                }}
                placeholder="1.250.000"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-background border border-border font-mono text-sm font-bold"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold cursor-pointer"
            >
              Guardar Parámetros
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
