# DESIGN SYSTEM — OPTILUX ERP & POS
**Concept:** *"Clinical Precision meets Modern Eyewear Luxury"*  
**Generated via:** UI/UX Pro Max Design Intelligence (Variance: 7/10 · Motion: 6/10 · Density: 8/10)

---

## 1. Visual Philosophy & Art Direction
OptiLux merges **ophthalmological accuracy** (high-contrast tabular diopter grids, calibrated measurements, zero-ambiguity logistics statuses) with **contemporary eyewear boutique aesthetics** (deep slate surfaces, pure clinical white, cobalt optical blue, emerald precision accents, and refined micro-interactions).

### Core Principles
1. **Tabular Clinical Rigor:** Every diopter (`SPH`, `CYL`, `AXIS`, `ADD`, `DP`, `ALT`), currency amount, and SKU code uses `font-variant-numeric: tabular-nums` and JetBrains Mono / Inter Mono alignment.
2. **Dual-Theme Native Architecture:**
   - **Light Mode (Clinical Daylight):** Pure clinical white (`#FFFFFF`) cards over cool alabaster slate (`#F8FAFC`) backgrounds with crisp `#E2E8F0` hairlines.
   - **Dark Mode (Boutique Obsidian):** Deep slate carbon (`#090D16`) background with elevated `#111827` cards, subtle top inner borders (`rgba(255,255,255,0.07)`), and luminous cobalt/emerald accents.
3. **100% Responsive Adaptive Ergonomics (360px → Ultrawide 2560px):**
   - **Mobile (< 768px):** Fixed Thumb-Zone Bottom Tab Bar (`h-16`, `safe-area-inset-bottom`), interactive Cards replacing dense tables, and slide-up Bottom Drawers/Modals.
   - **Desktop (≥ 1024px):** Collapsible Left Sidebar (`260px` expanded / `72px` rail), Split-View workspaces for Rx + POS Cotizador, and 6-column horizontal Kanban logistics board.

---

## 2. Semantic Color Tokens (Light & Dark Mode)

| Semantic Token | Light Mode (Clinical) | Dark Mode (Obsidian) | Usage |
| :--- | :--- | :--- | :--- |
| `--background` | `#F8FAFC` (Slate 50) | `#090D16` (Obsidian 950) | Primary app canvas |
| `--foreground` | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Primary high-contrast text (≥ 12:1) |
| `--card` | `#FFFFFF` (Clinical White) | `#111827` (Slate 900) | Bento cards, Rx sheets, POS panels |
| `--card-elevated` | `#F1F5F9` (Slate 100) | `#1E293B` (Slate 800) | Nested clinical inputs, hover states |
| `--primary` | `#0284C7` (Optical Cobalt) | `#38BDF8` (Luminous Cobalt) | Primary CTAs, active tabs, OD indicator |
| `--accent` | `#059669` (Optical Emerald) | `#10B981` (Luminous Emerald) | Secondary CTA, OI indicator, financial positive |
| `--muted` | `#F1F5F9` (Slate 100) | `#1E293B` (Slate 800) | Skeleton loaders, secondary badges |
| `--muted-foreground` | `#475569` (Slate 600) | `#94A3B8` (Slate 400) | Technical labels, timestamps (≥ 4.6:1 contrast) |
| `--border` | `#E2E8F0` (Slate 200) | `#1E293B` (Slate 800) | Hairline dividers, Rx grid lines |
| `--ring` | `#0284C7` (Cobalt Focus) | `#38BDF8` (Luminous Focus) | WCAG 2.2 2px focus outline |

### Logistics & Kanban Semantic Status Tokens
| Stage / Status | Badge BG (Light / Dark) | Text / Accent | Clinical Meaning |
| :--- | :--- | :--- | :--- |
| `1. Recepción y Seña` | `#EFF6FF` / `rgba(59,130,246,0.15)` | `#2563EB` / `#60A5FA` | Order created, deposit verified |
| `2. Enviado a Lab` | `#F5F3FF` / `rgba(139,92,246,0.15)` | `#7C3AED` / `#A78BFA` | Dispatched to external optical lab |
| `3. En Tallado / Biselado` | `#FFFBEB` / `rgba(245,158,11,0.15)` | `#D97706` / `#FBBF24` | Lens surfacing & edging in progress |
| `4. Control de Calidad` | `#ECFEFF` / `rgba(6,182,212,0.15)` | `#0891B2` / `#22D3EE` | Digital lensometer inspection |
| `5. Listo en Sucursal` | `#ECFDF5` / `rgba(16,185,129,0.15)` | `#059669` / `#34D399` | Ready for pickup + WhatsApp trigger |
| `6. Entregado` | `#F1F5F9` / `rgba(148,163,184,0.15)` | `#475569` / `#94A3B8` | Completed & balance settled |
| `Alerta / Demorado` | `#FEF2F2` / `rgba(239,68,68,0.15)` | `#DC2626` / `#F87171` | SLA exceeded or critical stock |

---

## 3. Typography & Hierarchy
- **Primary Sans (`--font-sans`):** `Inter`, system-ui — clean geometric precision for UI controls, navigation, and patient records.
- **Clinical Mono (`--font-mono`):** `JetBrains Mono`, monospace — mandatory for Diopter inputs (`+2.25`, `-1.75 × 180°`), Barcode SKUs (`OPT-84920`), Caliber specs (`54□18-145`), and financial balances.
- **Display Luxury (`--font-display`):** `Plus Jakarta Sans` / `Inter Tight` (`-0.025em` tracking) — executive KPIs and module headers.

### Type Scale (Density 8/10 Dashboard Tuned)
- `kpi-hero`: `clamp(1.5rem, 2.2vw, 2.25rem)` · `font-weight: 700` · `tracking: -0.03em` · `tabular-nums`
- `h1-module`: `1.375rem (22px)` · `font-weight: 600` · `tracking: -0.02em`
- `h2-card`: `1rem (16px)` · `font-weight: 600` · `tracking: -0.01em`
- `body-sm`: `0.875rem (14px)` · `line-height: 1.45`
- `clinical-label`: `0.75rem (12px)` · `font-weight: 600` · `uppercase` · `tracking: 0.06em`

---

## 4. Spacing, Layout & Responsive Breakpoints
- **8pt Base Grid with 4pt Clinical Sub-grid:**
  - Card padding: `p-4` (mobile) → `p-5` (desktop)
  - Grid gaps: `gap-3` (12px) on dense clinical matrices, `gap-4` (16px) on Bento dashboard.
- **Touch Target Compliance:** All buttons, Rx steppers, and bottom nav items enforce `min-h-[44px] min-w-[44px]` on touch devices.
- **Mobile Table-to-Card Transformation:** Data tables (`Pacientes`, `Inventario`, `Movimientos de Caja`) render semantic `<table className="hidden md:table">` on desktop and interactive `<div className="grid gap-3 md:hidden">` cards on mobile viewports.

---

## 5. Micro-Interactions & Accessibility Guardrails
- **Framer Motion Choreography:**
  - Tab transitions: `duration: 0.2s`, `ease: [0.22, 1, 0.36, 1]`
  - Tactile button feedback: `active:scale-[0.98]` without shifting layout bounds.
  - Respects `prefers-reduced-motion: reduce` automatically.
- **Clinical Validation:**
  - Diopter fields validate step increments of `0.25 D` (`SPH`, `CYL`, `ADD`) and integer `0°–180°` for `AXIS` (required whenever `CYL != 0`).
  - Inline error alerts + focusable error summary on form submission.

