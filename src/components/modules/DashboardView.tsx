"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Glasses,
  Sparkles,
  PackageCheck,
  ShieldAlert,
} from "lucide-react";
import { ERPState, ModuleId, UserRole } from "@/types/erp";
import { formatARS, formatUSD } from "@/lib/utils";
import { can } from "@/lib/permissions";

interface DashboardViewProps {
  data: ERPState;
  role: UserRole;
  onNavigate: (mod: ModuleId) => void;
}

export function DashboardView({ data, role, onNavigate }: DashboardViewProps) {
  const { inventory, orders, metrics } = data;
  const showFinancials = can(role, "dashboard:financial");

  const lowStockItems = inventory.filter((i) => i.stock <= i.minStock);
  const maxWeekly = Math.max(
    ...metrics.weeklySeries.map((d) => Math.max(d.amountArs, d.target)),
    1
  );

  const totalMixAmount = metrics.salesMix.reduce((a, b) => a + b.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header Contextual */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase mb-2">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Métricas Calculadas en Tiempo Real desde SQLite
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Dashboard Ejecutivo OptiLux
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Facturación consolidada (ARS + USD @ {formatARS(metrics.usdRate)}), tiempos reales de laboratorio y alertas críticas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {can(role, "pos:create") && (
            <button
              onClick={() => onNavigate("POS")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:opacity-95 active:scale-[0.98] transition cursor-pointer min-h-[44px]"
            >
              <Glasses className="w-4 h-4" aria-hidden="true" />
              Nueva Cotización / POS
            </button>
          )}
          <button
            onClick={() => onNavigate("KANBAN")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border text-foreground font-medium text-sm hover:bg-muted/70 active:scale-[0.98] transition cursor-pointer min-h-[44px]"
          >
            <FlaskConical className="w-4 h-4 text-primary" aria-hidden="true" />
            Taller Kanban ({orders.length})
          </button>
        </div>
      </div>

      {/* Top 4 KPIs Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Ventas Consolidada Hoy */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          onClick={() => showFinancials && onNavigate("CAJA")}
          className="group rounded-2xl bg-card border border-border p-5 shadow-sm hover:border-primary/50 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ingresos Hoy (Consolidado)
            </span>
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-clinical tracking-tight">
              {showFinancials
                ? formatARS(metrics.consolidatedTodayArs)
                : "Restringido"}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-accent font-medium inline-flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" /> ARS{" "}
              {formatARS(metrics.salesTodayArs)}
            </span>
            <span className="text-muted-foreground font-mono">
              + {formatUSD(metrics.salesTodayUsd)}
            </span>
          </div>
        </motion.div>

        {/* KPI 2: Órdenes Activas en Laboratorio */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          onClick={() => onNavigate("KANBAN")}
          className="group rounded-2xl bg-card border border-border p-5 shadow-sm hover:border-primary/50 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Órdenes en Laboratorio
            </span>
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
              <FlaskConical className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-clinical">
              {metrics.activeLabCount}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              en proceso técnico
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-amber-500 font-medium inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />{" "}
              {metrics.delayedCount} con alerta SLA
            </span>
            <span className="text-muted-foreground">
              {data.labs.length} labs activos
            </span>
          </div>
        </motion.div>

        {/* KPI 3: Lentes Listos para Entrega */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          onClick={() => onNavigate("KANBAN")}
          className="group rounded-2xl bg-card border border-border p-5 shadow-sm hover:border-accent/50 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Listos en Sucursal
            </span>
            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-clinical text-accent">
              {metrics.readyCount}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              calibrados p/ retiro
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-accent font-medium">
              Notificación WhatsApp 1-click
            </span>
            <span className="text-muted-foreground">Control QC 100%</span>
          </div>
        </motion.div>

        {/* KPI 4: Alertas Críticas de Stock */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
          onClick={() => onNavigate("INVENTARIO")}
          className="group rounded-2xl bg-card border border-border p-5 shadow-sm hover:border-destructive/50 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Alertas de Stock
            </span>
            <div className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-clinical text-destructive">
              {metrics.lowStockCount}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              SKUs bajo mínimo
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-destructive font-medium">
              Reposición prioritaria
            </span>
            <span className="text-muted-foreground">
              Total catálogo: {inventory.length}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Bento Row 2: Gráficos Reales de Ingresos + Mix de Ventas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 rounded-2xl bg-card border border-border p-5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Evolución de Ingresos Reales (Últimos 6 días) vs Meta Diaria
              </h2>
              <p className="text-xs text-muted-foreground">
                Calculado directamente desde los asientos de Caja en ARS + USD convertido
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> Cobrado
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2.5 h-0.5 bg-accent inline-block" /> Meta ({formatARS(metrics.dailyTarget)})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-3 items-end h-52 pt-6 px-1 border-b border-border">
            {metrics.weeklySeries.map((item) => {
              const heightPct = Math.max(
                Math.round((item.amountArs / maxWeekly) * 100),
                4
              );
              const targetPct = Math.round((item.target / maxWeekly) * 100);
              return (
                <div
                  key={item.date}
                  className="group relative flex flex-col items-center h-full justify-end"
                >
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 bg-popover border border-border px-2 py-1 rounded-md shadow-md text-[11px] font-mono tabular-clinical whitespace-nowrap z-10 pointer-events-none">
                    {formatARS(item.amountArs)}
                  </div>

                  <div className="w-full max-w-[46px] h-full flex items-end relative">
                    <div
                      style={{ bottom: `${targetPct}%` }}
                      className="w-full h-0.5 bg-accent/80 absolute left-0 z-10"
                      title={`Meta: ${formatARS(item.target)}`}
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPct}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="w-full rounded-t-lg bg-gradient-to-t from-primary/80 to-primary group-hover:brightness-110 transition-all"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-6 gap-3 pt-2.5 text-center">
            {metrics.weeklySeries.map((item) => (
              <div key={item.date} className="flex flex-col">
                <span className="text-xs font-semibold text-foreground">
                  {item.label}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground tabular-clinical">
                  {(item.amountArs / 1_000_000).toFixed(2)}M
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mix de Ventas Real */}
        <div className="lg:col-span-5 rounded-2xl bg-card border border-border p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Mix de Ventas Real por Unidad Óptica
            </h2>
            <p className="text-xs text-muted-foreground">
              Participación sobre órdenes emitidas ({formatARS(totalMixAmount)})
            </p>

            <div className="mt-5 h-4 w-full rounded-full bg-muted overflow-hidden flex gap-0.5 p-0.5">
              {metrics.salesMix.map((segment) => (
                <div
                  key={segment.label}
                  style={{ width: `${Math.max(segment.pct, 3)}%` }}
                  className={`${segment.color} h-full first:rounded-l-full last:rounded-r-full transition-all`}
                />
              ))}
            </div>

            <div className="mt-5 space-y-3.5">
              {metrics.salesMix.map((segment) => (
                <div
                  key={segment.label}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-muted/40 border border-border/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 ${segment.color}`}
                    />
                    <div className="truncate">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {segment.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono tabular-clinical">
                        {formatARS(segment.amount)}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono tabular-clinical px-2.5 py-1 rounded-lg bg-background border border-border">
                    {segment.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Ticket Promedio Orden Emitida:</span>
            <span className="font-mono font-bold text-foreground tabular-clinical">
              {formatARS(
                orders.length > 0
                  ? Math.round(
                      orders.reduce((a, b) => a + b.totalAmount, 0) /
                        orders.length
                    )
                  : 0
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Bento Row 3: Performance SLA por Laboratorio + Alertas de Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 rounded-2xl bg-card border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Performance y SLA por Laboratorio Óptico (Bullet Chart)
              </h2>
              <p className="text-xs text-muted-foreground">
                Demora promedio real vs SLA objetivo configurado por laboratorio
              </p>
            </div>
            <button
              onClick={() => onNavigate("KANBAN")}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              Ver Kanban →
            </button>
          </div>

          <div className="space-y-4">
            {metrics.labBenchmarks.map((lab) => {
              const isOverSla = lab.avgDays > lab.slaDays;
              const widthPct = Math.min(Math.round((lab.avgDays / 7) * 100), 100);
              const targetMarkerPct = Math.min(
                Math.round((lab.slaDays / 7) * 100),
                100
              );

              return (
                <div
                  key={lab.id}
                  className="p-3 rounded-xl bg-muted/30 border border-border/70 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {lab.name}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
                        {lab.activeCount} activas
                      </span>
                      {lab.delayedCount > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold">
                          {lab.delayedCount} demorada(s)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono tabular-clinical">
                      <span
                        className={
                          isOverSla
                            ? "text-destructive font-bold"
                            : "text-accent font-bold"
                        }
                      >
                        {lab.avgDays}d prom.
                      </span>
                      <span className="text-muted-foreground">
                        / SLA {lab.slaDays}d
                      </span>
                    </div>
                  </div>

                  <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      style={{ width: `${widthPct}%` }}
                      className={`h-full rounded-full transition-all ${
                        isOverSla ? "bg-destructive" : "bg-primary"
                      }`}
                    />
                    <div
                      style={{ left: `${targetMarkerPct}%` }}
                      className="absolute top-0 bottom-0 w-1 bg-foreground z-10"
                      title={`SLA Objetivo: ${lab.slaDays} días`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alertas Críticas de Stock */}
        <div className="lg:col-span-5 rounded-2xl bg-card border border-border p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
                  <ShieldAlert
                    className="w-4 h-4 text-destructive"
                    aria-hidden="true"
                  />
                  Reposición Crítica de Inventario
                </h2>
                <p className="text-xs text-muted-foreground">
                  Modelos por debajo del stock de seguridad clínica
                </p>
              </div>
              <button
                onClick={() => onNavigate("INVENTARIO")}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Reponer →
              </button>
            </div>

            <div className="space-y-2.5">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/20"
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-xs font-bold text-foreground truncate block">
                      {item.brand} — {item.model}
                    </span>
                    <p className="text-[11px] text-muted-foreground font-mono tabular-clinical mt-0.5">
                      SKU: {item.sku} · EAN {item.barcode}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-destructive text-destructive-foreground text-xs font-mono font-bold tabular-clinical">
                      Stock: {item.stock}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      Mín: {item.minStock} u.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PackageCheck
                className="w-5 h-5 text-accent shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Lector USB HID + Cámara WebRTC Activos
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Escaneá cualquier EAN-13 desde cualquier pantalla
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate("INVENTARIO")}
              className="px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition cursor-pointer"
            >
              Catálogo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
