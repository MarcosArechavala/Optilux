export type UserRole = "ADMIN" | "VENDEDOR" | "TECNICO_LAB";

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  VENDEDOR: "Vendedor / Asesor Óptico",
  TECNICO_LAB: "Técnico de Laboratorio",
};

const ALL: UserRole[] = ["ADMIN", "VENDEDOR", "TECNICO_LAB"];
const SALES: UserRole[] = ["ADMIN", "VENDEDOR"];

/** Matriz de permisos: única fuente de verdad para servidor y UI. */
export const PERMISSIONS = {
  "dashboard:read": ALL,
  "dashboard:financial": SALES,
  "patients:read": ALL,
  "patients:write": SALES,
  "rx:write": SALES,
  "pos:create": SALES,
  "orders:read": ALL,
  "orders:move": ALL,
  "orders:deliver": SALES,
  "inventory:read": ALL,
  "inventory:write": ["ADMIN"] as UserRole[],
  "inventory:adjust": ALL,
  "cash:read": SALES,
  "cash:write": SALES,
  "labs:read": ALL,
  "labs:write": ["ADMIN"] as UserRole[],
  "settings:write": ["ADMIN"] as UserRole[],
  "uploads:read": ALL,
  "uploads:write": SALES,
} satisfies Record<string, UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: UserRole | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as UserRole[]).includes(role);
}

