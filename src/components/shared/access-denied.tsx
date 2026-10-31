import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccessDenied({ homeHref }: { homeHref: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-warning-soft text-warning-foreground">
        <ShieldAlert className="size-6" />
      </span>
      <h1 className="text-lg font-semibold">You don&apos;t have access to this page</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Your role doesn&apos;t include this module. Switch to an Admin or Manager demo account from the profile menu to explore it.</p>
      <Button asChild className="mt-5"><Link href={homeHref}>Go to my home page</Link></Button>
    </div>
  );
}
