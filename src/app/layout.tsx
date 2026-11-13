import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OptiLux ERP & POS | Clinical Precision & Modern Eyewear Luxury",
  description:
    "Sistema Web Integral de Gestión Óptica: ERP, Punto de Venta Cotizador, Ficha Oftalmológica, Taller Kanban, Inventario con Código de Barras y Finanzas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans min-h-screen bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}

