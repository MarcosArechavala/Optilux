"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Glasses, ShieldCheck, Lock, Mail, Sparkles } from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    role: "Administrador General",
    email: "admin@optilux.ar",
    desc: "Acceso total: POS, Caja, ABM Laboratorios, Stock y Configuración USD",
  },
  {
    role: "Vendedor / Asesor Óptico",
    email: "ventas@optilux.ar",
    desc: "Ficha Rx, Cotizador POS (máx. 15% dto.), Entrega y Caja",
  },
  {
    role: "Técnico de Laboratorio",
    email: "taller@optilux.ar",
    desc: "Tablero Kanban, Recetas Rx y Stock (sin acceso a POS ni Caja)",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@optilux.ar");
  const [password, setPassword] = useState("optilux123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo iniciar sesión");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Error de red al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Columna Izquierda: Identidad Clínica + Accesos Rápidos por Rol */}
        <div className="lg:col-span-6 p-6 sm:p-8 bg-gradient-to-br from-primary/15 via-card to-accent/10 border-b lg:border-b-0 lg:border-r border-border flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                <Glasses className="w-6 h-6" />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight block leading-none">
                  OptiLux <span className="text-primary">PRO</span>
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Clinical Precision · Eyewear Luxury ERP
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Autenticación JWT + RBAC en Servidor
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Seleccioná un perfil operativo para cargar sus credenciales y probar los permisos reales en el servidor:
            </p>

            <div className="space-y-2.5">
              {DEMO_ACCOUNTS.map((acc) => {
                const active = email === acc.email;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword("optilux123");
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition cursor-pointer ${
                      active
                        ? "bg-primary/10 border-primary shadow-sm"
                        : "bg-background/70 border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        {acc.role}
                      </span>
                      <span className="text-[11px] font-mono text-primary font-semibold">
                        {acc.email}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {acc.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground font-mono flex items-center justify-between pt-3 border-t border-border/60">
            <span>Clave demo: optilux123</span>
            <span>Sesión firmada HS256</span>
          </div>
        </div>

        {/* Columna Derecha: Formulario Accesible */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-center space-y-5"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Iniciar Sesión Operativa
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Ingresá con tu cuenta asignada de sucursal o laboratorio.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-destructive/15 border border-destructive text-destructive text-xs font-semibold"
            >
              {error}
            </div>
          )}

          <div className="space-y-3.5">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold mb-1.5"
              >
                Correo Electrónico Institucional
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer min-h-[46px]"
          >
            <ShieldCheck className="w-4 h-4" />
            {loading ? "Verificando credenciales..." : "Ingresar a OptiLux PRO"}
          </button>
        </form>
      </div>
    </div>
  );
}

