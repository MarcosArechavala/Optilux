"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast as sonnerToast } from "sonner";
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  Kanban,
  Barcode,
  Wallet,
  Sun,
  Moon,
  Shield,
  ChevronLeft,
  ChevronRight,
  Glasses,
  Search,
  LogOut,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import { ERPState, ModuleId } from "@/types/erp";
import type { SessionUser } from "@/lib/session";
import { ROLE_LABELS, type UserRole } from "@/lib/permissions";
import { DashboardView } from "./modules/DashboardView";
import { PatientsRxView } from "./modules/PatientsRxView";
import { PosCotizadorView } from "./modules/PosCotizadorView";
import { KanbanLabView } from "./modules/KanbanLabView";
import { InventoryBarcodeView } from "./modules/InventoryBarcodeView";
import { CashFinanceView } from "./modules/CashFinanceView";
import { CommandSearch } from "./ui/CommandSearch";
import { BottomSheet } from "./ui/Modal";

interface OptiLuxShellProps {
  initialData: ERPState;
  currentUser: SessionUser;
}

const NAV_ITEMS: {
  id: ModuleId;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  allowedRoles: UserRole[];
}[] = [
  {
    id: "DASHBOARD",
    label: "Dashboard Ejecutivo",
    shortLabel: "Inicio",
    icon: LayoutDashboard,
    allowedRoles: ["ADMIN", "VENDEDOR", "TECNICO_LAB"],
  },
  {
    id: "PACIENTES",
    label: "Pacientes & Recetas (Rx)",
    shortLabel: "Recetas",
    icon: Users,
    allowedRoles: ["ADMIN", "VENDEDOR", "TECNICO_LAB"],
  },
  {
    id: "POS",
    label: "POS & Cotizador Óptico",
    shortLabel: "POS",
    icon: ShoppingBag,
    allowedRoles: ["ADMIN", "VENDEDOR"],
  },
  {
    id: "KANBAN",
    label: "Taller & Labs (Kanban)",
    shortLabel: "Taller",
    icon: Kanban,
    allowedRoles: ["ADMIN", "VENDEDOR", "TECNICO_LAB"],
  },
  {
    id: "INVENTARIO",
    label: "Inventario & Barras",
    shortLabel: "Stock",
    icon: Barcode,
    allowedRoles: ["ADMIN", "VENDEDOR", "TECNICO_LAB"],
  },
  {
    id: "CAJA",
    label: "Caja & Finanzas",
    shortLabel: "Caja",
    icon: Wallet,
    allowedRoles: ["ADMIN", "VENDEDOR"],
  },
];

export function OptiLuxShell({ initialData, currentUser }: OptiLuxShellProps) {
  const router = useRouter();
  const [erpData, setErpData] = useState<ERPState>(initialData);
  const [activeModule, setActiveModule] = useState<ModuleId>("DASHBOARD");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  // Estado compartido para saltar entre módulos
  const [selectedPatientId, setSelectedPatientId] = useState<
    string | undefined
  >();
  const [posPatientId, setPosPatientId] = useState<string | undefined>();
  const [posRxId, setPosRxId] = useState<string | undefined>();
  const [posFrameId, setPosFrameId] = useState<string | undefined>();

  // Buffer para lector láser USB HID global (ráfaga de dígitos + Enter)
  const barcodeBufferRef = useRef<{ chars: string; lastTime: number }>({
    chars: "",
    lastTime: 0,
  });

  // Tema persistente en localStorage + prefers-color-scheme
  useEffect(() => {
    const saved = localStorage.getItem("optilux-theme");
    if (saved === "light" || saved === "dark") {
      setIsDark(saved === "dark");
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setIsDark(false);
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add("dark");
      localStorage.setItem("optilux-theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("optilux-theme", "light");
    }
  }, [isDark]);

  // Lector USB HID global en cualquier pantalla
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      const now = Date.now();
      if (now - barcodeBufferRef.current.lastTime > 90) {
        barcodeBufferRef.current.chars = "";
      }
      barcodeBufferRef.current.lastTime = now;

      if (e.key === "Enter" && barcodeBufferRef.current.chars.length >= 8) {
        const scanned = barcodeBufferRef.current.chars;
        barcodeBufferRef.current.chars = "";
        const found = erpData.inventory.find((i) => i.barcode === scanned);
        if (found) {
          sonnerToast.success(
            `Lector USB: ${found.brand} ${found.model} (${found.barcode})`
          );
          if (currentUser.role !== "TECNICO_LAB") {
            setPosFrameId(found.id);
            setActiveModule("POS");
          } else {
            setActiveModule("INVENTARIO");
          }
        }
      } else if (/^\d$/.test(e.key)) {
        barcodeBufferRef.current.chars += e.key;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [erpData.inventory, currentUser.role]);

  const triggerToast = (
    message: string,
    type: "success" | "warning" | "error" = "success"
  ) => {
    if (type === "success") sonnerToast.success(message);
    else if (type === "warning") sonnerToast.warning(message);
    else sonnerToast.error(message);
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/erp", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.ok) {
        const fresh = await res.json();
        setErpData(fresh);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSendToPos = (patientId: string, prescriptionId?: string) => {
    setPosPatientId(patientId);
    setPosRxId(prescriptionId);
    setActiveModule("POS");
    triggerToast(
      "Receta cargada en el Cotizador POS. Seleccione armazón y cristales.",
      "success"
    );
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const visibleNavItems = NAV_ITEMS.filter((item) =>
    item.allowedRoles.includes(currentUser.role)
  );

  // En móvil: máximo 4 ítems directos + botón "Más" (BottomSheet) para cumplir UI/UX Pro Max (<= 5 ítems)
  const mobilePrimaryItems = visibleNavItems.slice(0, 4);
  const mobileOverflowItems = visibleNavItems.slice(4);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background text-foreground">
      <Toaster
        position="bottom-right"
        theme={isDark ? "dark" : "light"}
        richColors
        closeButton
      />

      {/* Sidebar Colapsable (Desktop >= 1024px) */}
      <aside
        className={`hidden lg:flex flex-col justify-between border-r border-border bg-card/90 backdrop-blur-md transition-all duration-200 shrink-0 sticky top-0 h-screen ${
          sidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="p-4 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
                <Glasses className="w-5 h-5" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <span className="font-extrabold tracking-tight text-base block leading-none">
                    OptiLux <span className="text-primary">PRO</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Clinical Eyewear ERP
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label="Colapsar barra lateral"
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          <nav className="space-y-1.5" aria-label="Menú Principal">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[44px] ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          {!sidebarCollapsed ? (
            <div className="p-3 rounded-xl bg-muted/50 border border-border text-xs space-y-1">
              <div className="flex items-center justify-between font-semibold text-accent">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                  SQLite + JWT Activo
                </span>
                {isRefreshing && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                {erpData.patients.length} Pacientes · {erpData.orders.length} OT
              </p>
            </div>
          ) : (
            <div className="flex justify-center">
              <span
                className="w-2.5 h-2.5 rounded-full bg-accent"
                title="Base de Datos Conectada"
              />
            </div>
          )}
        </div>
      </aside>

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Glasses className="w-5 h-5" />
            </div>
            <span className="font-bold text-sm">OptiLux PRO</span>
          </div>

          {/* Buscador Global Ctrl+K */}
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-muted/60 hover:bg-muted border border-border text-xs text-muted-foreground transition cursor-pointer max-w-xs w-full sm:w-auto"
          >
            <Search className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">
              Buscar paciente, OT o EAN-13...
            </span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px]">
              Ctrl K
            </kbd>
          </button>

          <div className="flex items-center gap-2">
            {/* Usuario Autenticado y Rol RBAC Real */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/70 border border-border text-xs">
              <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-bold text-foreground truncate max-w-[160px]">
                {currentUser.name}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary font-mono text-[10px] font-bold">
                {ROLE_LABELS[currentUser.role]}
              </span>
            </div>

            {/* Toggle Tema */}
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              aria-label="Alternar modo claro u oscuro"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/70 hover:bg-muted border border-border text-xs font-semibold transition cursor-pointer min-h-[40px]"
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-primary" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {/* Cerrar Sesión */}
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión o cambiar de usuario"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card hover:bg-destructive/15 hover:text-destructive border border-border text-xs font-semibold transition cursor-pointer min-h-[40px]"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>

        {/* Área de Trabajo */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {activeModule === "DASHBOARD" && (
                <DashboardView
                  data={erpData}
                  role={currentUser.role}
                  onNavigate={(mod) => setActiveModule(mod)}
                />
              )}

              {activeModule === "PACIENTES" && (
                <PatientsRxView
                  data={erpData}
                  role={currentUser.role}
                  preselectedPatientId={selectedPatientId}
                  onRefresh={refreshData}
                  onToast={triggerToast}
                  onSendToPos={handleSendToPos}
                />
              )}

              {activeModule === "POS" && (
                <PosCotizadorView
                  data={erpData}
                  role={currentUser.role}
                  preselectedPatientId={posPatientId}
                  preselectedRxId={posRxId}
                  preselectedFrameId={posFrameId}
                  onRefresh={refreshData}
                  onToast={triggerToast}
                />
              )}

              {activeModule === "KANBAN" && (
                <KanbanLabView
                  data={erpData}
                  role={currentUser.role}
                  onRefresh={refreshData}
                  onToast={triggerToast}
                />
              )}

              {activeModule === "INVENTARIO" && (
                <InventoryBarcodeView
                  data={erpData}
                  role={currentUser.role}
                  onRefresh={refreshData}
                  onToast={triggerToast}
                />
              )}

              {activeModule === "CAJA" && (
                <CashFinanceView
                  data={erpData}
                  role={currentUser.role}
                  onRefresh={refreshData}
                  onToast={triggerToast}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Barra Inferior Móvil (<= 5 botones: 4 principales + botón Más con BottomSheet) */}
      <nav
        aria-label="Navegación inferior móvil"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-card/95 backdrop-blur-md border-t border-border px-2 flex items-center justify-around"
      >
        {mobilePrimaryItems.map((item) => {
          const Icon = item.icon;
          const active = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 rounded-xl transition cursor-pointer ${
                active
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-[10px] mt-0.5">{item.shortLabel}</span>
            </button>
          );
        })}

        {mobileOverflowItems.length > 0 && (
          <button
            type="button"
            onClick={() => setMobileMoreOpen(true)}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 rounded-xl transition cursor-pointer ${
              mobileOverflowItems.some((i) => i.id === activeModule)
                ? "text-primary font-bold"
                : "text-muted-foreground"
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Más</span>
          </button>
        )}
      </nav>

      {/* BottomSheet Móvil para ítems adicionales y perfil */}
      <BottomSheet
        open={mobileMoreOpen}
        onOpenChange={setMobileMoreOpen}
        title="Módulos Adicionales & Perfil"
      >
        <div className="space-y-2">
          {mobileOverflowItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveModule(item.id);
                  setMobileMoreOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-background border border-border text-sm font-bold"
              >
                <Icon className="w-5 h-5 text-primary" />
                {item.label}
              </button>
            );
          })}

          <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Sesión: <strong className="text-foreground">{currentUser.name}</strong>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-destructive font-bold"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Buscador Global Ctrl+K */}
      <CommandSearch
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        data={erpData}
        onNavigate={(mod) => setActiveModule(mod)}
        onSelectPatient={(pid) => {
          setSelectedPatientId(pid);
          setActiveModule("PACIENTES");
        }}
        onSelectFrameInPos={(fid) => {
          if (currentUser.role !== "TECNICO_LAB") {
            setPosFrameId(fid);
            setActiveModule("POS");
            triggerToast("Armazón cargado en el Cotizador POS.", "success");
          } else {
            setActiveModule("INVENTARIO");
          }
        }}
      />
    </div>
  );
}
