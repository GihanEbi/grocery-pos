"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "motion/react";
import { ArrowRight, BarChart3, Eye, EyeOff, Lock, Mail, ScanBarcode, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore, useCurrentUser } from "@/store/auth-store";
import { useAppStore } from "@/store/app-store";
import { canAccessRoute, homeRouteFor, ROLE_LABEL } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/avatar";
import { FormField } from "@/components/shared/form-field";
import { BrandMark } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { sleep } from "@/lib/utils";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const DEMO = [
  { email: "admin@demo.pos", role: "admin" as const, blurb: "Full access to every module" },
  { email: "manager@demo.pos", role: "manager" as const, blurb: "Products, stock, purchasing, reports" },
  { email: "cashier@demo.pos", role: "cashier" as const, blurb: "POS checkout, sales & shifts" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const user = useCurrentUser();
  const users = useAppStore((s) => s.users);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const { register, handleSubmit, setValue, watch, setError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: true },
  });

  const redirectFor = (role: Parameters<typeof homeRouteFor>[0]) => {
    const next = params.get("next");
    return next && next.startsWith("/") && canAccessRoute(role, next) ? next : homeRouteFor(role);
  };

  useEffect(() => {
    if (user && !submitting) router.replace(homeRouteFor(user.role));
  }, [user, router, submitting]);

  const submit = async (values: FormValues, source = "form") => {
    setSubmitting(source);
    await sleep(450); // simulated auth round-trip
    const r = login(values.email, values.password, values.remember);
    if (!r.ok) {
      setSubmitting(null);
      setError("password", { message: r.error });
      toast.error("Sign-in failed", { description: r.error });
      return;
    }
    const u = useAppStore.getState().users.find((x) => x.id === r.data.userId)!;
    toast.success(`Welcome back, ${u.name.split(" ")[0]}!`, { description: `${ROLE_LABEL[u.role]} · demo session` });
    router.replace(redirectFor(u.role));
  };

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-8 lg:hidden"><BrandMark /></div>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to FreshMart POS</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Use a demo account below or enter the credentials manually.</p>

      <form onSubmit={handleSubmit((v) => submit(v))} className="mt-7 space-y-4" noValidate>
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="username" placeholder="you@demo.pos" className="h-10 pl-9" aria-invalid={!!errors.email} {...register("email")} />
          </div>
        </FormField>
        <FormField label="Password" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" className="h-10 px-9" aria-invalid={!!errors.password} {...register("password")} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </FormField>
        <div className="flex items-center gap-2">
          <Checkbox id="remember" checked={watch("remember")} onCheckedChange={(v) => setValue("remember", v === true)} />
          <Label htmlFor="remember" className="font-normal text-muted-foreground">Remember this demo session</Label>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={submitting === "form"} disabled={!!submitting} data-testid="login-submit">
          Sign in <ArrowRight />
        </Button>
      </form>

      <div className="my-7 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> Quick demo access <div className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-2">
        {DEMO.map((d) => {
          const u = users.find((x) => x.email === d.email);
          if (!u) return null;
          return (
            <button
              key={d.email}
              type="button"
              disabled={!!submitting}
              data-testid={`demo-login-${d.role}`}
              onClick={() => {
                setValue("email", d.email);
                setValue("password", "demo123");
                submit({ email: d.email, password: "demo123", remember: watch("remember") }, d.role);
              }}
              className="group flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-soft transition-all hover:border-primary/40 hover:shadow-elevated disabled:opacity-60"
            >
              <UserAvatar name={u.name} color={u.avatarColor} className="size-9" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">{ROLE_LABEL[d.role]}<span className="truncate text-xs font-normal text-muted-foreground">{d.email}</span></span>
                <span className="block text-xs text-muted-foreground">{d.blurb}</span>
              </span>
              {submitting === d.role ? <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />}
            </button>
          );
        })}
      </div>
      <p className="mt-6 flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        <span>Demo password for all accounts is <code className="rounded bg-card px-1 font-mono text-foreground">demo123</code>. Authentication is simulated in the browser — never use these credentials in production.</span>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[oklch(0.25_0.05_170)] p-10 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-[0.35]" style={{ background: "radial-gradient(60% 50% at 20% 10%, oklch(0.6 0.13 163 / .9), transparent 70%), radial-gradient(50% 40% at 90% 80%, oklch(0.68 0.11 200 / .6), transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
        <div className="relative flex items-center gap-3">
          <BrandMark className="bg-white text-[oklch(0.45_0.12_163)]" />
          <span className="text-lg font-semibold tracking-tight">FreshMart POS</span>
        </div>
        <div className="relative mt-auto max-w-lg">
          <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl font-semibold leading-[1.1] tracking-tight">
            Run your grocery store from one fast, friendly counter.
          </motion.h2>
          <p className="mt-4 text-[15px] text-white/70">Checkout, stock, purchasing, reports and an AI business assistant — a fully interactive frontend demo with Sri Lankan sample data.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              { icon: ScanBarcode, title: "Fast checkout", text: "Barcode, weighted items, split pay" },
              { icon: BarChart3, title: "Live reports", text: "Sales, profit & stock in sync" },
              { icon: Sparkles, title: "AI insights", text: "Reorder & expiry suggestions" },
            ].map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                <f.icon className="size-5 text-[oklch(0.85_0.12_163)]" />
                <p className="mt-3 text-sm font-medium">{f.title}</p>
                <p className="mt-0.5 text-xs text-white/60">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="relative mt-10 text-xs text-white/50">Frontend prototype · mock data stored in your browser · prices are samples, not market prices.</p>
      </aside>
      <main className="relative flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
