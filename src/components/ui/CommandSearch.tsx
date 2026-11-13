"use client";

import React, { useEffect, useState } from "react";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Search,
  User,
  Glasses,
  Kanban,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { ERPState, ModuleId } from "@/types/erp";
import { formatARS } from "@/lib/utils";

interface CommandSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ERPState;
  onNavigate: (mod: ModuleId) => void;
  onSelectPatient: (patientId: string) => void;
  onSelectFrameInPos: (frameId: string) => void;
}

export function CommandSearch({
  open,
  onOpenChange,
  data,
  onNavigate,
  onSelectPatient,
  onSelectFrameInPos,
}: CommandSearchProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[15%] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden focus:outline-none">
          <DialogPrimitive.Title className="sr-only">
            Buscador global OptiLux
          </DialogPrimitive.Title>
          <Command className="w-full" shouldFilter={true}>
            <div className="flex items-center border-b border-border px-4">
              <Search className="w-4 h-4 text-primary mr-2.5 shrink-0" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Buscar paciente (DNI), orden (OT-2026), armazón (SKU o EAN-13)..."
                className="w-full py-3.5 bg-transparent text-sm focus:outline-none"
              />
              <kbd className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                ESC
              </kbd>
            </div>

            <Command.List className="max-h-80 overflow-y-auto p-2 space-y-2">
              <Command.Empty className="py-8 text-center text-xs text-muted-foreground">
                No se encontraron coincidencias para &ldquo;{query}&rdquo;.
              </Command.Empty>

              <Command.Group
                heading="Pacientes & Fichas Clínicas"
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1"
              >
                {data.patients.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={`${p.fullName} ${p.dni} ${p.healthInsurance}`}
                    onSelect={() => {
                      onSelectPatient(p.id);
                      onOpenChange(false);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl text-xs text-foreground aria-selected:bg-primary/15 aria-selected:text-primary cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-primary" />
                      <div>
                        <p className="font-bold">{p.fullName}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          DNI {p.dni} · {p.healthInsurance}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Group
                heading="Órdenes de Laboratorio (Kanban)"
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1"
              >
                {data.orders.map((o) => (
                  <Command.Item
                    key={o.id}
                    value={`${o.orderNumber} ${o.patient.fullName} ${o.lensType} ${o.lab.name}`}
                    onSelect={() => {
                      onNavigate("KANBAN");
                      onOpenChange(false);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl text-xs text-foreground aria-selected:bg-primary/15 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Kanban className="w-4 h-4 text-accent" />
                      <div>
                        <p className="font-bold font-mono">
                          {o.orderNumber} — {o.patient.fullName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {o.lensType} · {o.status}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[11px]">
                      {formatARS(o.totalAmount)}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Group
                heading="Armazones & Productos (Cargar en POS)"
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1"
              >
                {data.inventory.map((it) => (
                  <Command.Item
                    key={it.id}
                    value={`${it.brand} ${it.model} ${it.sku} ${it.barcode}`}
                    onSelect={() => {
                      onSelectFrameInPos(it.id);
                      onOpenChange(false);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl text-xs text-foreground aria-selected:bg-primary/15 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Glasses className="w-4 h-4 text-primary" />
                      <div>
                        <p className="font-bold">
                          {it.brand} {it.model}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {it.sku} · EAN {it.barcode} · Stock {it.stock}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono font-bold">
                      {formatARS(it.retailPrice)}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>

            <div className="border-t border-border px-4 py-2 bg-muted/40 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" />
                Atajo rápido: Ctrl+K o pistola lectora USB en cualquier pantalla
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

