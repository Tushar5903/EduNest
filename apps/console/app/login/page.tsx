"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Clock3, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@edunest/shared";
import { homeFor, login } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { identifier: "", password: "" } });

  async function onSubmit(values: LoginInput) {
    setPending(true);
    try {
      const user = await login(values.identifier, values.password);
      toast.success(`Welcome, ${user.name}`);
      router.replace(homeFor(user.role));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to authenticate");
    } finally {
      setPending(false);
    }
  }

  return <main className="min-h-screen bg-[#f3f4fb] px-4 py-6 sm:px-8 lg:grid lg:place-items-center lg:px-10"><div className="mx-auto grid w-full max-w-[970px] overflow-hidden rounded-2xl bg-white shadow-[0_14px_40px_rgba(34,32,94,0.12)] ring-1 ring-[#e4e5f2] lg:grid-cols-[405px_1fr]">
    <section className="flex min-h-[555px] flex-col bg-[#12124c] px-9 py-9 text-white sm:px-10"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#2b2b70]"><ShieldCheck size={19} /></div><div><div className="font-display text-lg font-bold">EduNest</div><div className="text-[10px] font-semibold tracking-[0.14em] text-[#aeadde]">SECURE ADMIN CONSOLE</div></div></div><div className="mt-7 inline-flex w-fit items-center gap-2 rounded-full bg-[#242461] px-3 py-1.5 text-xs font-semibold text-[#deddfb]"><span className="h-2 w-2 rounded-full bg-[#24c998]" />Academic year configuration active</div><h1 className="mt-8 max-w-[310px] font-display text-3xl font-bold leading-[1.12] tracking-tight">Authorized School Administration Console</h1><p className="mt-4 max-w-[320px] text-sm leading-6 text-[#c7c6ed]">Access secure records, faculty rosters, student administration, fee ledgers, and institutional circulars.</p><div className="mt-8 space-y-4 border-t border-white/10 pt-6"><SecurityItem icon={<ShieldCheck size={17} />} title="Encrypted data vault" text="Institutional records stay protected." /><SecurityItem icon={<LockKeyhole size={17} />} title="Multi-factor ready" text="Secure session and role enforcement." /><SecurityItem icon={<Clock3 size={17} />} title="Real-time audit trail" text="Administrative actions are traceable." /></div><div className="mt-auto flex items-center justify-between border-t border-white/10 pt-6 text-xs text-[#aeadde]"><span>EduNest Security Protocol</span><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#24c998]" />All gateways online</span></div></section>
    <section className="flex min-h-[555px] flex-col justify-center px-7 py-10 sm:px-14"><div className="mx-auto w-full max-w-[425px]"><div className="flex items-center justify-between gap-3"><h2 className="font-display text-3xl font-bold tracking-tight text-[#11104c]">Admin Sign In</h2><span className="rounded-md bg-[#f0efff] px-3 py-1 text-xs font-semibold text-[#37356d]">Single Sign-On</span></div><p className="mt-2 text-sm leading-5 text-[#777792]">Enter your official institutional credentials or school administrator ID to access your dashboard.</p>{searchParams.get("error") === "use-portal" ? <div className="mt-5 rounded-lg bg-[#fff6dc] p-3 text-sm text-[#946d11]">This account uses the Student/Teacher Portal login.</div> : null}<form onSubmit={form.handleSubmit(onSubmit)} className="mt-7 space-y-5"><FieldLabel label="Institutional Email Address or Admin UID" required error={form.formState.errors.identifier?.message}><div className="relative"><Mail className="absolute left-3 top-3.5 text-[#8d8bab]" size={17} /><input {...form.register("identifier")} autoComplete="username" placeholder="Enter your institutional email" className="h-11 w-full rounded-xl border border-[#dadbef] pl-10 pr-3 text-sm text-[#17164b] outline-none ring-[#aaa9dc] placeholder:text-[#9a98ad] focus:ring-2" /></div></FieldLabel><FieldLabel label="Account Password" required error={form.formState.errors.password?.message}><div className="relative"><LockKeyhole className="absolute left-3 top-3.5 text-[#8d8bab]" size={17} /><input {...form.register("password")} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" className="h-11 w-full rounded-xl border border-[#dadbef] pl-10 pr-11 text-sm text-[#17164b] outline-none ring-[#aaa9dc] placeholder:text-[#9a98ad] focus:ring-2" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3 text-[#8d8bab]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></FieldLabel><div className="flex justify-end"><button type="button" className="text-xs font-medium text-[#3c3a78] hover:underline">Forgot password?</button></div><button disabled={pending} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#29285f] text-sm font-semibold text-white shadow-[0_5px_10px_rgba(41,40,95,0.2)] transition hover:bg-[#1f1e52] disabled:cursor-wait disabled:opacity-60">{pending ? "Authenticating…" : "Authenticate & Open Workspace"}<ArrowRight size={17} /></button></form><p className="mt-6 text-center text-xs leading-5 text-[#85839c]">Protected by EduNest Zero-Trust Framework<br /><span className="underline">Acceptable Usage Policy</span> · <span className="underline">System Status</span></p><p className="mt-6 text-center text-sm text-[#777792]">New institution? <Link href="/request-access" className="font-semibold text-[#35336f] hover:underline">Register your school</Link></p></div></section>
  </div></main>;
}

function SecurityItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#292968] text-[#a8b9ff]">{icon}</div><div><div className="text-sm font-semibold">{title}</div><div className="text-xs text-[#aaa9dc]">{text}</div></div></div>; }
function FieldLabel({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) { return <label className="block text-xs font-semibold text-[#17164b]"><span>{label}{required ? <span className="ml-1 text-[#c8324d]">*</span> : null}</span>{children}{error ? <span className="mt-1 block font-normal text-[#b22c43]">{error}</span> : null}</label>; }

export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }
