"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/store/auth-store";
import { canAccessRoute, homeRouteFor } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";

/** Redirects anonymous users to /login and blocks routes the role can't access. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [user, router, pathname]);

  if (!user) return null;
  if (!canAccessRoute(user.role, pathname)) return <AccessDenied homeHref={homeRouteFor(user.role)} />;
  return <>{children}</>;
}
