"use client";

import React, { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";
import {
  ScanBarcode,
  Printer,
  Plus,
  Search,
  Camera,
  AlertTriangle,
} from "lucide-react";
import { ERPState, InventoryItemDTO, UserRole } from "@/types/erp";
import { formatARS } from "@/lib/utils";
import { INVENTORY_CATEGORIES } from "@/lib/catalog";
import { can } from "@/lib/permissions";
import { Modal } from "@/components/ui/Modal";
import { CameraScannerModal } from "@/components/ui/CameraScannerModal";

interface InventoryBarcodeViewProps {
  data: ERPState;
  role: UserRole;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: "success" | "warning" | "error") => void;
}

export function InventoryBarcodeView({
  data,
  role,
  onRefresh,
  onToast,
}: InventoryBarcodeViewProps) {
  const { inventory } = data;
  const canCreateSku = can(role, "inventory:write");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedForLabel, setSelectedForLabel] =
    useState<InventoryItemDTO | null>(inventory[0] || null);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  const [newItem, setNewItem] = useState({
    sku: "OPT-PR-0912",
    barcode: "", // Vacío para autogenerar EAN-13 interno válido con dígito verificador
    brand: "Prada Eyewear",
    model: "Symphony Acetate PR 17WV",
    category: "ARMAZON_RECETA",
    color: "Negro Brillante / Logo Plata",
    material: "Acetato Italiano Premium",
    caliberLens: 54,
    caliberBridge: 18,
    caliberTemple: 145,
    costPrice: 165000,
    retailPrice: 385000,
    stock: 4,
    minStock: 2,
    location: "Boutique VIP B3",
  });

  // Renderizado real de código de barras EAN-13 / CODE128 con JsBarcode
  useEffect(() => {
    if (!selectedForLabel || !barcodeSvgRef.current) return;
    try {
      const code = selectedForLabel.barcode;
      JsBarcode(barcodeSvgRef.current, code, {
        format: /^\d{13}$/.test(code) ? "EAN13" : "CODE128",
        lineColor: "#0f172a",
        background: "#f8fafc",
        width: 1.7,
        height: 44,
        displayValue: true,
        fontSize: 12,
        font: "monospace",
        margin: 6,
      });
    } catch {
      // Fallback a CODE128 si el código no cumple longitud EAN13
      try {
        JsBarcode(barcodeSvgRef.current, selectedForLabel.barcode, {
          format: "CODE128",
          lineColor: "#0f172a",
          background: "#f8fafc",
          width: 1.5,
          height: 44,
          displayValue: true,
          fontSize: 12,
        });
      } catch {}
    }
  }, [selectedForLabel]);

  const filteredItems = inventory.filter((item) => {
    const matchesSearch =
      item.brand.toLowerCase().includes(search.toLowerCase()) ||
      item.model.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.barcode.includes(search);
    const matchesCat =
      categoryFilter === "ALL" || item.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleAdjustStock = async (item: InventoryItemDTO, delta: number) => {
    if (item.stock + delta < 0) {
      onToast("El stock no puede quedar en negativo.", "warning");
      return;
    }
    try {
      const res = await fetch("/api/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADJUST_STOCK",
          payload: { itemId: item.id, delta },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onToast(json.error || "Error ajustando stock", "error");
        return;
      }
      await onRefresh();
      onToast(
        `Stock actualizado: ${item.brand} ${item.model} (${
          delta > 0 ? `+${delta}` : delta
        })`,
        "success"
      );
    } catch {
      onToast("Error ajustando stock", "error");
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_INVENTORY_ITEM",
          payload: newItem,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onToast(json.error || "Datos de SKU inválidos", "error");
        return;
      }
      await onRefresh();
      setSelectedForLabel(json.item);
      setShowNewModal(false);
      onToast(
        `Producto ${json.item.brand} creado con EAN-13 ${json.item.barcode}.`,
        "success"
      );
    } catch {
      onToast("Error al crear SKU.", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Inventario Inteligente, Calibres & Código de Barras EAN-13
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generador real de etiquetas térmicas con JsBarcode (EAN-13) + QR y escáner por cámara o lector USB.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setScannerModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border text-foreground font-semibold text-sm hover:bg-muted transition cursor-pointer min-h-[44px]"
          >
            <Camera className="w-4 h-4 text-accent" />
            Escanear con Cámara / USB
          </button>

          {canCreateSku && (
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:opacity-95 transition cursor-pointer min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              Nuevo Armazón / Producto
            </button>
          )}
        </div>
      </div>

      {/* Layout Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por marca, modelo, SKU o código EAN-13..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-card border border-border text-sm"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl bg-card border border-border text-xs font-semibold"
            >
              <option value="ALL">Todas las Categorías</option>
              {INVENTORY_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tabla Escritorio */}
          <div className="hidden md:block rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground uppercase text-[11px] font-bold">
                  <th className="py-3 px-4">SKU / Marca & Modelo</th>
                  <th className="py-3 px-3">Calibre Técnico</th>
                  <th className="py-3 px-3">Material & Color</th>
                  <th className="py-3 px-3 text-right">Precio PVP</th>
                  <th className="py-3 px-3 text-center">Stock</th>
                  <th className="py-3 px-4 text-right">Ajuste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {filteredItems.map((item) => {
                  const isLow = item.stock <= item.minStock;
                  const isSelected = selectedForLabel?.id === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedForLabel(item)}
                      className={`transition cursor-pointer ${
                        isSelected ? "bg-primary/10" : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <p className="font-bold text-foreground">
                          {item.brand} — {item.model}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {item.sku} · EAN {item.barcode}
                        </p>
                      </td>
                      <td className="py-3 px-3 font-mono tabular-clinical">
                        {item.caliberLens > 0 ? (
                          <span className="px-2 py-1 rounded-md bg-muted font-semibold">
                            {item.caliberLens}□{item.caliberBridge}-
                            {item.caliberTemple}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-foreground">
                          {item.material}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.color}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold tabular-clinical text-sm">
                        {formatARS(item.retailPrice)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-mono font-bold text-xs ${
                            isLow
                              ? "bg-destructive/15 text-destructive"
                              : "bg-accent/15 text-accent"
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-3 h-3" />}
                          {item.stock} u.
                        </span>
                      </td>
                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={item.stock <= 0}
                            onClick={() => handleAdjustStock(item, -1)}
                            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 font-mono font-bold cursor-pointer"
                            title="Descontar 1 unidad"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(item, 1)}
                            className="w-7 h-7 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 font-mono font-bold cursor-pointer"
                            title="Sumar 1 unidad"
                          >
                            +
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tarjetas Móvil */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredItems.map((item) => {
              const isLow = item.stock <= item.minStock;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedForLabel(item)}
                  className="rounded-2xl bg-card border border-border p-4 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-mono text-primary font-bold">
                        {item.sku} · EAN {item.barcode}
                      </span>
                      <h3 className="text-sm font-bold">
                        {item.brand} {item.model}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {item.color} · {item.material}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-sm tabular-clinical">
                      {formatARS(item.retailPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border text-xs font-mono">
                    <span>
                      Cal: {item.caliberLens}□{item.caliberBridge}-
                      {item.caliberTemple}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          isLow ? "text-destructive font-bold" : "text-accent"
                        }
                      >
                        Stock: {item.stock}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdjustStock(item, 1);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Generador de Etiqueta Imprimible con JsBarcode EAN-13 + QR */}
        <div className="lg:col-span-4 rounded-2xl bg-card border border-border p-5 shadow-sm space-y-4 sticky top-20">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <span className="text-[11px] font-mono uppercase text-primary font-bold">
                Impresora Térmica Zebra / Brother
              </span>
              <h2 className="text-base font-bold">
                Etiqueta EAN-13 + QR Escaneable
              </h2>
            </div>
            <ScanBarcode className="w-5 h-5 text-primary" />
          </div>

          {selectedForLabel && (
            <div className="space-y-4">
              {/* Área imprimible aislada con @media print */}
              <div className="printable-area rounded-xl bg-white text-slate-950 p-4 border-2 border-dashed border-slate-300 shadow-inner space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
                  <span>OPTILUX BOUTIQUE</span>
                  <span>{selectedForLabel.location}</span>
                </div>
                <p className="text-sm font-extrabold tracking-tight truncate">
                  {selectedForLabel.brand} — {selectedForLabel.model}
                </p>
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-700">
                  <span>SKU: {selectedForLabel.sku}</span>
                  <span>
                    Cal: {selectedForLabel.caliberLens}□
                    {selectedForLabel.caliberBridge}-
                    {selectedForLabel.caliberTemple}
                  </span>
                </div>

                {/* Barcode EAN-13 real + QR Code */}
                <div className="py-2 px-2 flex items-center justify-between gap-2 bg-slate-50 rounded-lg border border-slate-200">
                  <svg
                    ref={barcodeSvgRef}
                    className="max-w-[190px] h-16"
                    aria-label={`Código de barras EAN-13 ${selectedForLabel.barcode}`}
                  />
                  <div className="p-1 bg-white rounded border border-slate-200 shrink-0">
                    <QRCodeSVG
                      value={`${selectedForLabel.sku}|${selectedForLabel.barcode}|${selectedForLabel.retailPrice}`}
                      size={52}
                    />
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between border-t border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-600">
                    {selectedForLabel.material}
                  </span>
                  <span className="text-base font-mono font-black">
                    {formatARS(selectedForLabel.retailPrice)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  window.print();
                  onToast(
                    `Imprimiendo etiqueta térmica de ${selectedForLabel.sku}`,
                    "success"
                  );
                }}
                className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition cursor-pointer min-h-[44px]"
              >
                <Printer className="w-4 h-4" />
                Imprimir Etiqueta Térmica (@media print)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nuevo Producto */}
      <Modal
        open={showNewModal}
        onOpenChange={setShowNewModal}
        title="Alta de Armazón / Producto Óptico"
        description="Si dejás el código EAN-13 vacío, el sistema genera uno interno válido con dígito verificador."
      >
        <form onSubmit={handleCreateItem} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">SKU Interno</label>
              <input
                type="text"
                required
                value={newItem.sku}
                onChange={(e) =>
                  setNewItem({ ...newItem, sku: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl bg-background border border-border font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                EAN-13 (Opcional: autogenera)
              </label>
              <input
                type="text"
                value={newItem.barcode}
                onChange={(e) =>
                  setNewItem({ ...newItem, barcode: e.target.value })
                }
                placeholder="Vacío = EAN-13 automático"
                className="w-full px-3 py-2 rounded-xl bg-background border border-border font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Marca</label>
              <input
                type="text"
                required
                value={newItem.brand}
                onChange={(e) =>
                  setNewItem({ ...newItem, brand: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl bg-background border border-border"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Modelo</label>
              <input
                type="text"
                required
                value={newItem.model}
                onChange={(e) =>
                  setNewItem({ ...newItem, model: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl bg-background border border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Categoría</label>
              <select
                value={newItem.category}
                onChange={(e) =>
                  setNewItem({ ...newItem, category: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl bg-background border border-border"
              >
                {INVENTORY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Ubicación Vitrina
              </label>
              <input
                type="text"
                required
                value={newItem.location}
                onChange={(e) =>
                  setNewItem({ ...newItem, location: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl bg-background border border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-semibold mb-1">
                Ancho Lente (mm)
              </label>
              <input
                type="number"
                value={newItem.caliberLens}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    caliberLens: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-background border border-border font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Puente (mm)</label>
              <input
                type="number"
                value={newItem.caliberBridge}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    caliberBridge: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-background border border-border font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Varilla (mm)</label>
              <input
                type="number"
                value={newItem.caliberTemple}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    caliberTemple: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-background border border-border font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-semibold mb-1">Costo (ARS)</label>
              <input
                type="number"
                value={newItem.costPrice}
                onChange={(e) =>
                  setNewItem({ ...newItem, costPrice: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl bg-background border border-border font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">PVP (ARS)</label>
              <input
                type="number"
                value={newItem.retailPrice}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    retailPrice: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-background border border-border font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Stock Inicial</label>
              <input
                type="number"
                value={newItem.stock}
                onChange={(e) =>
                  setNewItem({ ...newItem, stock: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl bg-background border border-border font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="px-4 py-2 rounded-xl border border-border font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold cursor-pointer"
            >
              Guardar SKU
            </button>
          </div>
        </form>
      </Modal>

      <CameraScannerModal
        open={scannerModalOpen}
        onOpenChange={setScannerModalOpen}
        inventory={inventory}
        onDetected={(code) => {
          setSearch(code);
          const found = inventory.find(
            (i) =>
              i.barcode.includes(code) ||
              i.sku.toLowerCase().includes(code.toLowerCase())
          );
          if (found) {
            setSelectedForLabel(found);
            onToast(
              `Código ${code} detectado: ${found.brand} ${found.model}`,
              "success"
            );
          } else {
            onToast(`Código ${code} filtrado en catálogo`, "warning");
          }
        }}
      />
    </div>
  );
}
