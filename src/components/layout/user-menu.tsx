"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, RefreshCw, Settings, Store, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/app-store";
import { useAuthStore, useCurrentUser } from "@/store/auth-store";
import { useCartStore } from "@/store/cart-store";
import { ROLE_LABEL, homeRouteFor } from "@/lib/permissions";
import { UserAvatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function UserMenu({ compact }: { compact?: boolean }) {
  const user = useCurrentUser();
  const users = useAppStore((s) => s.users);
  const shop = useAppStore((s) => s.settings.shop);
  const switchUser = useAuthStore((s) => s.switchUser);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  if (!user) return null;

  const demoAccounts = users.filter((u) => u.active && u.id !== user.id && ["usr_admin", "usr_mgr", "usr_cash1"].includes(u.id));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2.5 rounded-lg p-1 pr-2 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40" data-testid="user-menu">
          <UserAvatar name={user.name} color={user.avatarColor} />
          {!compact && (
            <span className="hidden min-w-0 text-left leading-tight md:block">
              <span className="block max-w-32 truncate text-[13px] font-medium">{user.name}</span>
              <span className="block text-[11px] text-muted-foreground">{ROLE_LABEL[user.role]}</span>
            </span>
          )}
          <ChevronDown className="hidden size-3.5 text-muted-foreground md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="flex items-center gap-3 p-2">
          <UserAvatar name={user.name} color={user.avatarColor} className="size-10 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="mt-0.5 text-[11px] font-medium text-primary-soft-foreground">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
        <div className="mx-1 mb-1 flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs text-muted-foreground">
          <Store className="size-3.5" /> <span className="truncate">{shop.name}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5"><RefreshCw className="size-3" />Switch demo account</DropdownMenuLabel>
        {demoAccounts.map((u) => (
          <DropdownMenuItem
            key={u.id}
            data-testid={`switch-${u.role}`}
            onSelect={() => {
              const r = switchUser(u.id);
              if (r.ok) {
                useCartStore.getState().clear();
                toast.success(`Signed in as ${u.name}`, { description: ROLE_LABEL[u.role] });
                router.push(homeRouteFor(u.role));
              }
            }}
          >
            <UserAvatar name={u.name} color={u.avatarColor} className="size-6 text-[10px] ring-0" />
            <span className="flex-1 truncate">{u.name}</span>
            <span className="text-[11px] text-muted-foreground">{ROLE_LABEL[u.role].split(" ")[0]}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/settings"><Settings />Settings</Link></DropdownMenuItem>
        {user.role === "admin" && <DropdownMenuItem asChild><Link href="/settings?tab=users"><UserCog />Manage users</Link></DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          data-testid="logout"
          onSelect={() => {
            logout();
            router.push("/login");
            toast("Signed out of the demo session");
          }}
        >
          <LogOut />Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
