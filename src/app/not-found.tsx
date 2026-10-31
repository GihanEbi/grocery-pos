import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl">🥕</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">This aisle doesn&apos;t exist. Let&apos;s get you back to the shop floor.</p>
      <Button asChild className="mt-2"><Link href="/">Go home</Link></Button>
    </div>
  );
}
