"use client";
import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Database, Lock, Palette, ReceiptText, Store, Users, type LucideIcon } from "lucide-react";
import { useCan, useCurrentUser } from "@/hooks";
import { ROLE_LABEL } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShopSettingsForm } from "@/components/settings/shop-settings-form";
import { PosSettingsForm } from "@/components/settings/pos-settings-form";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { UsersSettings } from "@/components/settings/users-settings";
import { DemoDataSettings } from "@/components/settings/demo-data-settings";

type TabKey = "shop" | "pos" | "appearance" | "users" | "demo";

const TABS: { key: TabKey; label: string; icon: LucideIcon; description: string }[] = [
  { key: "shop", label: "Shop", icon: Store, description: "Name, contact details, logo and currency" },
  { key: "pos", label: "POS & receipts", icon: ReceiptText, description: "Tax, discounts, receipts and register" },
  { key: "appearance", label: "Appearance", icon: Palette, description: "Light, dark or system theme" },
  { key: "users", label: "Users & roles", icon: Users, description: "Demo accounts and access" },
  { key: "demo", label: "Demo data", icon: Database, description: "Storage and reset" },
];

function SettingsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const user = useCurrentUser();
  const canShop = useCan("settings.shop");
  const canPos = useCan("settings.pos");
  const canUsers = useCan("users.manage");
  const canDemo = useCan("demo.reset");

  const allowed = TABS.filter((t) => (t.key === "shop" ? canShop : t.key === "pos" ? canPos : t.key === "users" ? canUsers : t.key === "demo" ? canDemo : true));
  const requested = params.get("tab") as TabKey | null;
  const initial = allowed.find((t) => t.key === requested)?.key ?? allowed[0]!.key;
  const [tab, setTab] = React.useState<TabKey>(initial);

  // Follow back/forward navigation and links like /settings?tab=users.
  React.useEffect(() => {
    if (requested && allowed.some((t) => t.key === requested)) setTab(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);

  const change = (v: string) => {
    setTab(v as TabKey);
    router.replace(`/settings?tab=${v}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <PageHeader title="Settings" description="Configure your shop, the POS terminal and this demo." />
      {!canShop && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-[13px] text-muted-foreground" data-testid="settings-restricted-note">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            You&apos;re signed in as <span className="font-medium text-foreground">{user ? ROLE_LABEL[user.role] : "a limited role"}</span>. Shop, POS, user and demo-data settings require the{" "}
            <span className="font-medium text-foreground">Owner / Admin</span> role — only appearance settings are available.
          </p>
        </div>
      )}
      <Tabs value={tab} onValueChange={change} orientation="vertical" className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <TabsList className="h-auto w-full justify-start gap-1 bg-muted/60 lg:flex-col lg:items-stretch lg:bg-transparent lg:p-0">
          {allowed.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              data-testid={`settings-tab-${t.key}`}
              className="h-8 justify-start px-3 lg:h-auto lg:items-start lg:gap-3 lg:rounded-lg lg:px-3 lg:py-2.5 lg:text-left lg:data-[state=active]:bg-card lg:data-[state=active]:shadow-soft lg:hover:bg-accent/60 lg:[&_svg]:mt-0.5 lg:[&_svg]:size-4"
            >
              <t.icon />
              <span className="flex flex-col">
                <span>{t.label}</span>
                <span className="hidden text-[11.5px] font-normal text-muted-foreground lg:block lg:whitespace-normal">{t.description}</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="min-w-0">
          {canShop && <TabsContent value="shop"><ShopSettingsForm /></TabsContent>}
          {canPos && <TabsContent value="pos"><PosSettingsForm /></TabsContent>}
          <TabsContent value="appearance"><AppearanceSettings /></TabsContent>
          {canUsers && <TabsContent value="users"><UsersSettings /></TabsContent>}
          {canDemo && <TabsContent value="demo"><DemoDataSettings /></TabsContent>}
        </div>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}
