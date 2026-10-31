"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startOfMonth } from "date-fns";
import { Download, Gift, UserCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import type { Customer } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useCan, useDebounced } from "@/hooks";
import { formatDate, formatRelative } from "@/lib/formatting";
import { downloadCsv } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statsFor, useCustomerStats } from "./customer-stats";
import { CustomerProfileSheet } from "./customer-profile-sheet";
import { CustomerFormSheet } from "./customer-form-sheet";

interface Row {
  customer: Customer;
  purchases: number;
  spending: number;
  lastVisit: string | null;
}

export function CustomersView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const customers = useAppStore((s) => s.customers);
  const hydrated = useAppStore((s) => s.hydrated);
  const canManage = useCan("customers.manage");
  const statsMap = useCustomerStats();

  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim().toLowerCase());
  const [status, setStatus] = useState("all");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  // Deep link: /customers?id=<customerId>
  const paramId = params.get("id");
  useEffect(() => {
    if (paramId && hydrated) {
      if (customers.some((c) => c.id === paramId)) setProfileId(paramId);
      else toast.error("That customer could not be found.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramId, hydrated]);

  const profile = profileId ? customers.find((c) => c.id === profileId) ?? null : null;

  const kpis = useMemo(() => {
    const monthStart = startOfMonth(new Date()).toISOString();
    return {
      total: customers.length,
      active: customers.filter((c) => c.status === "active").length,
      newThisMonth: customers.filter((c) => c.createdAt >= monthStart).length,
      points: customers.reduce((a, c) => a + c.loyaltyPoints, 0),
    };
  }, [customers]);

  const rows = useMemo<Row[]>(() => {
    const digits = q.replace(/\D/g, "");
    return customers
      .filter((c) => (status === "all" ? true : c.status === status))
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits))
        );
      })
      .map((c) => {
        const st = statsFor(statsMap, c.id);
        return { customer: c, purchases: st.purchases, spending: st.spending, lastVisit: st.lastVisit };
      });
  }, [customers, statsMap, q, status]);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Customer",
        accessorFn: (r) => r.customer.name,
        cell: ({ row }) => (
          <div className="flex min-w-44 items-center gap-2.5">
            <UserAvatar name={row.original.customer.name} className="ring-0" />
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.customer.name}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{row.original.customer.id}</p>
            </div>
          </div>
        ),
      },
      { id: "phone", header: "Phone", accessorFn: (r) => r.customer.phone, cell: ({ getValue }) => <span className="whitespace-nowrap tabular">{getValue() as string}</span> },
      {
        id: "email",
        header: "Email",
        accessorFn: (r) => r.customer.email,
        cell: ({ getValue }) => ((getValue() as string) ? <span className="block max-w-52 truncate">{getValue() as string}</span> : <span className="text-muted-foreground">—</span>),
      },
      { id: "purchases", header: "Purchases", meta: { align: "right" }, accessorFn: (r) => r.purchases, cell: ({ getValue }) => <span className="tabular">{(getValue() as number).toLocaleString("en-LK")}</span> },
      { id: "spending", header: "Total spending", meta: { align: "right" }, accessorFn: (r) => r.spending, cell: ({ getValue }) => <Money value={getValue() as number} className="font-medium" /> },
      {
        id: "points",
        header: "Points",
        meta: { align: "right" },
        accessorFn: (r) => r.customer.loyaltyPoints,
        cell: ({ getValue }) => <span className="tabular font-medium text-primary-soft-foreground">{(getValue() as number).toLocaleString("en-LK")}</span>,
      },
      {
        id: "lastVisit",
        header: "Last visit",
        accessorFn: (r) => r.lastVisit ?? "",
        cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{row.original.lastVisit ? formatRelative(row.original.lastVisit) : "Never"}</span>,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (r) => r.customer.status,
        cell: ({ row }) => (
          <Badge variant={row.original.customer.status === "active" ? "success" : "secondary"} dot>
            {row.original.customer.status === "active" ? "Active" : "Inactive"}
          </Badge>
        ),
      },
    ],
    [],
  );

  const closeProfile = (open: boolean) => {
    if (open) return;
    setProfileId(null);
    if (paramId) router.replace(pathname, { scroll: false });
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setFormOpen(true);
  };

  const exportCsv = () => {
    if (rows.length === 0) return toast.error("Nothing to export.");
    downloadCsv(
      `customers-${new Date().toISOString().slice(0, 10)}`,
      rows.map((r) => ({
        "Customer ID": r.customer.id,
        Name: r.customer.name,
        Phone: r.customer.phone,
        Email: r.customer.email,
        Address: r.customer.address,
        Purchases: r.purchases,
        "Total spending": (r.spending / 100).toFixed(2),
        "Loyalty points": r.customer.loyaltyPoints,
        "Last visit": r.lastVisit ? formatDate(r.lastVisit) : "",
        Status: r.customer.status,
      })),
    );
    toast.success(`Exported ${rows.length} customers to CSV.`);
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Customer profiles, purchase history and loyalty balances."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Customers" }]}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}><Download /> Export</Button>
            {canManage && <Button onClick={openAdd} data-testid="add-customer"><UserPlus /> Add customer</Button>}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total customers" value={kpis.total.toLocaleString("en-LK")} icon={Users} tone="info" hint="All registered profiles" />
        <KpiCard label="Active" value={kpis.active.toLocaleString("en-LK")} icon={UserCheck} tone="success" hint={`${kpis.total - kpis.active} inactive`} />
        <KpiCard label="New this month" value={kpis.newThisMonth.toLocaleString("en-LK")} icon={UserPlus} tone="primary" hint="Joined since the 1st" />
        <KpiCard label="Points outstanding" value={kpis.points.toLocaleString("en-LK")} icon={Gift} tone="warning" hint="Unredeemed loyalty points" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone or email" data-testid="customer-search" className="sm:w-80" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by status" data-testid="customer-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        testId="customers-table"
        columns={columns}
        data={rows}
        loading={!hydrated}
        getRowId={(r) => r.customer.id}
        onRowClick={(r) => setProfileId(r.customer.id)}
        initialSorting={[{ id: "spending", desc: true }]}
        resetKey={`${q}|${status}`}
        empty={
          <EmptyState
            icon={Users}
            title={q || status !== "all" ? "No customers match your search" : "No customers yet"}
            description={q ? "Check the spelling or search by phone number." : "Add a customer to start tracking loyalty points."}
            action={canManage ? <Button size="sm" onClick={openAdd}><UserPlus /> Add customer</Button> : undefined}
          />
        }
      />

      <CustomerProfileSheet
        customer={profile}
        stats={statsFor(statsMap, profileId ?? "")}
        open={!!profile}
        onOpenChange={closeProfile}
        onEdit={openEdit}
      />
      <CustomerFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
      />
    </div>
  );
}
