"use client";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, MoreHorizontal, Pencil, Power, UserPlus } from "lucide-react";
import type { Role, User } from "@/types";
import { api } from "@/mocks/services";
import { useAppStore } from "@/store/app-store";
import { useCurrentUser } from "@/hooks";
import { ROLE_LABEL } from "@/lib/permissions";
import { formatDate } from "@/lib/formatting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/shared/form-field";
import { DemoBadge } from "@/components/shared/demo-badge";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { SettingsSection } from "./settings-section";

const AVATAR_COLORS = ["#059669", "#0284c7", "#d97706", "#db2777", "#7c3aed", "#0891b2", "#65a30d", "#e11d48"];
const ROLE_BADGE: Record<Role, "default" | "info" | "secondary"> = { admin: "default", manager: "info", cashier: "secondary" };

const schema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(60, "Keep the name under 60 characters."),
  email: z.string().trim().min(1, "Email is required.").pipe(z.email("Enter a valid email address.")),
  role: z.enum(["admin", "manager", "cashier"]),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?\d{9,15}$/.test(v.replace(/[\s\-()]/g, "")), "Enter a valid phone number, e.g. +94 77 123 4567."),
  password: z.string().min(6, "Password must be at least 6 characters.").max(64),
});
type FormValues = z.infer<typeof schema>;

export function UsersSettings() {
  const users = useAppStore((s) => s.users);
  const me = useCurrentUser();
  const confirm = useConfirm();
  const [editing, setEditing] = React.useState<User | null>(null);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const sorted = React.useMemo(() => {
    const rank: Record<Role, number> = { admin: 0, manager: 1, cashier: 2 };
    return [...users].sort((a, b) => Number(b.active) - Number(a.active) || rank[a.role] - rank[b.role] || a.name.localeCompare(b.name));
  }, [users]);

  const toggleActive = async (u: User) => {
    const otherAdmins = users.filter((x) => x.id !== u.id && x.role === "admin" && x.active).length;
    // Signed-in user: the store itself refuses removing the last admin (error shown below);
    // otherwise block self-deactivation so the current session stays valid.
    if (u.id === me?.id && u.active && otherAdmins > 0) return toast.error("You can't deactivate the account you're signed in with.");
    const ok = await confirm({
      title: u.active ? `Deactivate ${u.name}?` : `Reactivate ${u.name}?`,
      description: u.active ? "They will no longer be able to sign in. Their sales and history are kept." : "They will be able to sign in again with their existing password.",
      confirmLabel: u.active ? "Deactivate" : "Reactivate",
      tone: u.active ? "destructive" : "default",
    });
    if (!ok) return;
    setBusy(u.id);
    const r = await api.users.update(u.id, { active: !u.active });
    setBusy(null);
    if (!r.ok) return toast.error(r.error);
    toast.success(`${u.name} ${u.active ? "deactivated" : "reactivated"}`);
  };

  return (
    <SettingsSection
      title="Users & roles"
      description={<>Demo accounts that can sign in to this browser. <DemoBadge label="Demo passwords are stored in plain text" className="ml-1 align-middle" /></>}
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          data-testid="add-user"
        >
          <UserPlus />
          Add user
        </Button>
      }
    >
      <div className="-mx-5 -my-5">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>User</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((u) => {
              const isMe = u.id === me?.id;
              return (
                <TableRow key={u.id} data-testid="user-row" className={u.active ? undefined : "opacity-70"}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={u.name} color={u.avatarColor} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {u.name}
                          {isMe && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground md:hidden">{u.email}</p>
                        <p className="hidden text-xs text-muted-foreground md:block">Since {formatDate(u.createdAt)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{u.email}</TableCell>
                  <TableCell><Badge variant={ROLE_BADGE[u.role]}>{ROLE_LABEL[u.role]}</Badge></TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular sm:table-cell">{u.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.active ? "success" : "outline"} dot>{u.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`} disabled={busy === u.id} data-testid="user-actions">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(u);
                            setOpen(true);
                          }}
                          data-testid="user-edit"
                        >
                          <Pencil />
                          Edit user
                        </DropdownMenuItem>
                        <DropdownMenuItem destructive={u.active} onSelect={() => void toggleActive(u)} data-testid="user-toggle-active">
                          <Power />
                          {u.active ? "Deactivate" : "Reactivate"}
                          {isMe && <span className="ml-auto text-[11px] text-muted-foreground">You</span>}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <UserDialog open={open} onOpenChange={setOpen} user={editing} isSelf={!!editing && editing.id === me?.id} />
    </SettingsSection>
  );
}

function UserDialog({ open, onOpenChange, user, isSelf }: { open: boolean; onOpenChange: (v: boolean) => void; user: User | null; isSelf: boolean }) {
  const [showPw, setShowPw] = React.useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", role: "cashier", phone: "", password: "" }, mode: "onTouched" });
  const { register, handleSubmit, control, reset, setError, formState } = form;
  const { errors, isSubmitting } = formState;

  React.useEffect(() => {
    if (!open) return;
    setShowPw(false);
    reset(user ? { name: user.name, email: user.email, role: user.role, phone: user.phone, password: user.password } : { name: "", email: "", role: "cashier", phone: "", password: "" });
  }, [open, user, reset]);

  const onSubmit = handleSubmit(async (v) => {
    const input = { name: v.name, email: v.email.toLowerCase(), role: v.role as Role, phone: v.phone, password: v.password };
    const r = user
      ? await api.users.update(user.id, input)
      : await api.users.create({ ...input, active: true, avatarColor: AVATAR_COLORS[useAppStore.getState().users.length % AVATAR_COLORS.length]! });
    if (!r.ok) {
      if (/email/i.test(r.error)) setError("email", { message: r.error }, { shouldFocus: true });
      else if (/admin/i.test(r.error)) setError("role", { message: r.error });
      toast.error(r.error);
      return;
    }
    toast.success(user ? `${r.data.name} updated` : `${r.data.name} can now sign in`);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !isSubmitting && onOpenChange(v)}>
      <DialogContent size="md" data-testid="user-dialog">
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription>{user ? `Update ${user.name}'s details and role.` : "Create a demo account. The user can sign in immediately."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="usr-name" required error={errors.name?.message} className="sm:col-span-2">
              <Input id="usr-name" autoComplete="off" aria-invalid={!!errors.name} data-testid="user-name" {...register("name")} />
            </FormField>
            <FormField label="Email" htmlFor="usr-email" required error={errors.email?.message} className="sm:col-span-2">
              <Input id="usr-email" type="email" autoComplete="off" aria-invalid={!!errors.email} data-testid="user-email" {...register("email")} />
            </FormField>
            <FormField label="Role" error={errors.role?.message} hint={isSelf ? "You can't change your own role." : undefined}>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSelf}>
                    <SelectTrigger data-testid="user-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["admin", "manager", "cashier"] as Role[]).map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Phone" htmlFor="usr-phone" error={errors.phone?.message} hint="Optional">
              <Input id="usr-phone" type="tel" inputMode="tel" autoComplete="off" aria-invalid={!!errors.phone} {...register("phone")} />
            </FormField>
            <FormField label="Password" htmlFor="usr-password" required error={errors.password?.message} hint="At least 6 characters. Demo only — stored unencrypted in this browser." className="sm:col-span-2">
              <div className="relative">
                <Input id="usr-password" type={showPw ? "text" : "password"} autoComplete="new-password" className="pr-10" aria-invalid={!!errors.password} data-testid="user-password" {...register("password")} />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" loading={isSubmitting} data-testid="save-user">{user ? "Save changes" : "Add user"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
