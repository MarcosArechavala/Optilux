"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, QrCode } from "lucide-react";
import { Modal } from "./Modal";
import { InventoryItemDTO } from "@/types/erp";

interface CameraScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventory: InventoryItemDTO[];
  onDetected: (barcode: string) => void;
}

export function CameraScannerModal({
  open,
  onOpenChange,
  inventory,
  onDetected,
}: CameraScannerModalProps) {
  const regionId = "optilux-html5-qrcode-reader";
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  useEffect(() => {
    if (!open) return;
    setCameraError(null);
    let cancelled = false;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const qrcode = new Html5Qrcode(regionId);
        scannerRef.current = qrcode;
        await qrcode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 120 } },
          (decodedText) => {
            onDetected(decodedText);
            onOpenChange(false);
          },
          () => {}
        );
      } catch {
        setCameraError(
          "No se detectó cámara activa o el permiso fue denegado. Podés ingresar o tocar un EAN-13 debajo."
        );
      }
    }

    const timer = setTimeout(startScanner, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scannerRef.current?.clear();
            } catch {}
          });
      }
    };
  }, [open, onDetected, onOpenChange]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Escáner Óptico por Cámara (EAN-13 / QR)"
      description="Apuntá la cámara al código de barras de la etiqueta o usá el lector láser USB."
    >
      <div className="space-y-4">
        <div
          id={regionId}
          className="w-full min-h-[210px] rounded-2xl bg-muted/60 border border-border flex items-center justify-center overflow-hidden text-xs text-muted-foreground p-4 text-center"
        >
          <span className="inline-flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary animate-pulse" />
            Inicializando visor de cámara WebRTC...
          </span>
        </div>

        {cameraError && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs">
            {cameraError}
          </div>
        )}

        {/* Entrada manual o lectura rápida para pruebas sin cámara física */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualCode.trim()) {
              onDetected(manualCode.trim());
              onOpenChange(false);
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Pegar o tipear EAN-13 / SKU..."
            className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-xs font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" /> Leer
          </button>
        </form>

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Simular lectura instantánea de etiquetas en vitrina:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {inventory.slice(0, 4).map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  onDetected(it.barcode);
                  onOpenChange(false);
                }}
                className="p-2.5 rounded-xl bg-background border border-border hover:border-primary text-left text-xs flex items-center justify-between cursor-pointer"
              >
                <span className="truncate font-semibold">
                  {it.brand} {it.model}
                </span>
                <span className="font-mono text-[11px] text-primary inline-flex items-center gap-1 shrink-0 ml-2">
                  <QrCode className="w-3 h-3" /> {it.barcode}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

