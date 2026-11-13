import type { KanbanStatus } from "@/lib/catalog";
import type { UserRole } from "@/lib/permissions";

export type { UserRole, KanbanStatus };

export type ModuleId =
  | "DASHBOARD"
  | "PACIENTES"
  | "POS"
  | "KANBAN"
  | "INVENTARIO"
  | "CAJA";

export interface PrescriptionDTO {
  id: string;
  patientId: string;
  doctorName: string;
  issueDate: string;
  expiryDate: string;
  odSph: number;
  odCyl: number;
  odAxis: number;
  odAdd: number;
  odDp: number;
  odHeight: number;
  oiSph: number;
  oiCyl: number;
  oiAxis: number;
  oiAdd: number;
  oiDp: number;
  oiHeight: number;
  lensUsage: string;
  attachmentName?: string | null;
  attachmentPath?: string | null;
  attachmentMime?: string | null;
  observations?: string | null;
}

export interface PatientDTO {
  id: string;
  fullName: string;
  dni: string;
  phone: string;
  email?: string | null;
  healthInsurance: string;
  memberNumber?: string | null;
  notes?: string | null;
  balance: number;
  createdAt: string;
  prescriptions: PrescriptionDTO[];
}

export interface InventoryItemDTO {
  id: string;
  sku: string;
  barcode: string;
  brand: string;
  model: string;
  category: string;
  color: string;
  material: string;
  caliberLens: number;
  caliberBridge: number;
  caliberTemple: number;
  costPrice: number;
  retailPrice: number;
  stock: number;
  minStock: number;
  location: string;
}

export interface LabDTO {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  slaDays: number;
  costFactor: number;
  notes?: string | null;
  active: boolean;
}

export interface OrderStatusLogDTO {
  id: string;
  orderId: string;
  fromStatus?: string | null;
  toStatus: string;
  userName: string;
  createdAt: string;
}

export interface LabOrderDTO {
  id: string;
  orderNumber: string;
  patientId: string;
  patient: PatientDTO;
  prescriptionId?: string | null;
  prescription?: PrescriptionDTO | null;
  frameId?: string | null;
  frame?: InventoryItemDTO | null;
  labId: string;
  lab: LabDTO;
  lensType: string;
  lensMaterial: string;
  treatments: string;
  accessories?: string | null;
  labCost: number;
  status: KanbanStatus;
  promisedDate: string;
  isDelayed: boolean; // Calculado dinámicamente en el servidor
  framePrice: number;
  lensPrice: number;
  treatmentsPrice: number;
  accessoriesPrice: number;
  subtotal: number;
  discount: number;
  insuranceCovered: number;
  totalAmount: number;
  depositPaid: number;
  balanceDue: number;
  sellerName: string;
  deliveredAt?: string | null;
  createdAt: string;
  statusLogs: OrderStatusLogDTO[];
}

export interface CashShiftDTO {
  id: string;
  name: string;
  status: "OPEN" | "CLOSED";
  openedByName: string;
  openedAt: string;
  openingAmount: number;
  closedByName?: string | null;
  closedAt?: string | null;
  expectedCash?: number | null;
  declaredCash?: number | null;
  difference?: number | null;
  expectedUsd?: number | null;
  declaredUsd?: number | null;
  differenceUsd?: number | null;
}

export interface CashTransactionDTO {
  id: string;
  shiftId?: string | null;
  type: "INGRESO" | "EGRESO";
  category: string;
  paymentMethod: string;
  currency: string;
  amount: number;
  exchangeRate: number;
  amountArs: number;
  reference: string;
  operatorName: string;
  createdAt: string;
}

export interface DashboardMetricsDTO {
  salesTodayArs: number;
  salesTodayUsd: number;
  consolidatedTodayArs: number;
  activeLabCount: number;
  delayedCount: number;
  readyCount: number;
  lowStockCount: number;
  usdRate: number;
  dailyTarget: number;
  weeklySeries: {
    label: string;
    date: string;
    amountArs: number;
    target: number;
  }[];
  salesMix: {
    label: string;
    amount: number;
    pct: number;
    color: string;
  }[];
  labBenchmarks: {
    id: string;
    name: string;
    slaDays: number;
    avgDays: number;
    activeCount: number;
    delayedCount: number;
  }[];
}

export interface ERPState {
  patients: PatientDTO[];
  inventory: InventoryItemDTO[];
  labs: LabDTO[];
  orders: LabOrderDTO[];
  activeShift: CashShiftDTO | null;
  recentShifts: CashShiftDTO[];
  transactions: CashTransactionDTO[];
  metrics: DashboardMetricsDTO;
}
