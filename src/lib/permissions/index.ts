import type { Role } from "@/types";

/**
 * Centralized role-based access control. Every route and every guarded UI action
 * checks one of these permissions via `can(role, permission)` or the `useCan` hook.
 */
export const PERMISSIONS = {
  "dashboard.view": ["admin", "manager"],
  "pos.use": ["admin", "manager", "cashier"],
  "products.view": ["admin", "manager"],
  "products.manage": ["admin", "manager"],
  "products.delete": ["admin"],
  "inventory.view": ["admin", "manager"],
  "inventory.adjust": ["admin", "manager"],
  "purchasing.view": ["admin", "manager"],
  "purchasing.manage": ["admin", "manager"],
  "purchasing.approve": ["admin", "manager"],
  "suppliers.view": ["admin", "manager"],
  "suppliers.manage": ["admin", "manager"],
  "sales.view": ["admin", "manager", "cashier"],
  "sales.refund": ["admin", "manager", "cashier"],
  "customers.view": ["admin", "manager", "cashier"],
  "customers.manage": ["admin", "manager", "cashier"],
  "shifts.view": ["admin", "manager", "cashier"],
  "shifts.viewAll": ["admin", "manager"],
  "expenses.view": ["admin", "manager"],
  "expenses.manage": ["admin", "manager"],
  "reports.view": ["admin", "manager"],
  "ai.use": ["admin", "manager"],
  "notifications.view": ["admin", "manager", "cashier"],
  "settings.view": ["admin", "manager", "cashier"],
  "settings.shop": ["admin"],
  "settings.pos": ["admin"],
  "users.manage": ["admin"],
  "demo.reset": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Owner / Admin",
  manager: "Manager",
  cashier: "Cashier",
};

/** Route prefix → required permission. Longest prefix wins. */
const ROUTE_PERMISSIONS: [string, Permission][] = [
  ["/dashboard", "dashboard.view"],
  ["/pos", "pos.use"],
  ["/products", "products.view"],
  ["/inventory", "inventory.view"],
  ["/purchasing", "purchasing.view"],
  ["/suppliers", "suppliers.view"],
  ["/sales", "sales.view"],
  ["/customers", "customers.view"],
  ["/shifts", "shifts.view"],
  ["/expenses", "expenses.view"],
  ["/reports", "reports.view"],
  ["/ai-assistant", "ai.use"],
  ["/notifications", "notifications.view"],
  ["/settings", "settings.view"],
];

export function routePermission(pathname: string): Permission | null {
  const match = ROUTE_PERMISSIONS.filter(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/")).sort(
    (a, b) => b[0].length - a[0].length,
  )[0];
  return match ? match[1] : null;
}

export function canAccessRoute(role: Role | undefined | null, pathname: string): boolean {
  const perm = routePermission(pathname);
  return perm ? can(role, perm) : true;
}

/** Landing page after login for each role. */
export function homeRouteFor(role: Role): string {
  return role === "cashier" ? "/pos" : "/dashboard";
}
