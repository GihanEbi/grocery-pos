import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Wallet,
  Clock,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  /** Optional sub-pages shown as tabs / breadcrumbs. */
  children?: { title: string; href: string }[];
  badge?: "lowStock" | "notifications";
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
      { title: "POS Terminal", href: "/pos", icon: ShoppingCart, permission: "pos.use" },
    ],
  },
  {
    label: "Catalog & Stock",
    items: [
      { title: "Products", href: "/products", icon: Package, permission: "products.view" },
      {
        title: "Inventory",
        href: "/inventory",
        icon: Boxes,
        permission: "inventory.view",
        badge: "lowStock",
        children: [
          { title: "Overview", href: "/inventory" },
          { title: "Stock Movements", href: "/inventory/movements" },
          { title: "Expiry", href: "/inventory/expiry" },
        ],
      },
      { title: "Purchasing", href: "/purchasing", icon: ClipboardList, permission: "purchasing.view" },
      { title: "Suppliers", href: "/suppliers", icon: Truck, permission: "suppliers.view" },
    ],
  },
  {
    label: "Sales & People",
    items: [
      { title: "Sales & Returns", href: "/sales", icon: Receipt, permission: "sales.view" },
      { title: "Customers", href: "/customers", icon: Users, permission: "customers.view" },
      { title: "Shifts", href: "/shifts", icon: Clock, permission: "shifts.view" },
    ],
  },
  {
    label: "Business",
    items: [
      { title: "Expenses", href: "/expenses", icon: Wallet, permission: "expenses.view" },
      { title: "Reports", href: "/reports", icon: BarChart3, permission: "reports.view" },
      { title: "AI Assistant", href: "/ai-assistant", icon: Sparkles, permission: "ai.use" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Notifications", href: "/notifications", icon: Bell, permission: "notifications.view", badge: "notifications" },
      { title: "Settings", href: "/settings", icon: Settings, permission: "settings.view" },
    ],
  },
];

/** Flat lookup for page titles & breadcrumbs. */
export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pos": "POS Terminal",
  "/products": "Products",
  "/inventory": "Inventory",
  "/inventory/movements": "Stock Movements",
  "/inventory/expiry": "Expiry Management",
  "/purchasing": "Purchase Orders",
  "/purchasing/new": "New Purchase Order",
  "/suppliers": "Suppliers",
  "/sales": "Sales & Returns",
  "/customers": "Customers",
  "/shifts": "Cash Register & Shifts",
  "/expenses": "Expenses",
  "/reports": "Reports & Analytics",
  "/ai-assistant": "AI Assistant",
  "/notifications": "Notifications",
  "/settings": "Settings",
};
