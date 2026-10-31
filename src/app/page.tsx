"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/store/auth-store";
import { homeRouteFor } from "@/lib/permissions";

export default function Home() {
  const user = useCurrentUser();
  const router = useRouter();
  useEffect(() => {
    router.replace(user ? homeRouteFor(user.role) : "/login");
  }, [user, router]);
  return null;
}
