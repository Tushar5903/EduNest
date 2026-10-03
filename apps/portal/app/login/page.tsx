"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Backpack, Bell, Eye, EyeOff, GraduationCap, Hash, IdCard, LockKeyhole, ShieldCheck } from "lucide-react";
import { loginSchema, type LoginInput } from "@edunest/shared";
import { homeFor, login, logout } from "@/lib/auth";
import { toast } from "sonner";

type RoleTab = "teacher" | "student";

const TAB_CONFIG: Record<
  RoleTab,
  { title: string; badge: string; description: string; idLabel: string; idPlaceholder: string; hint: string }
> = {
  teacher: {
    title: "Teacher Sign In",
    badge: "Faculty Access",
    description: "Enter your Teacher ID and password to open your classes, attendance and marks workspace.",
    idLabel: "Teacher ID",
    idPlaceholder: "e.g. T-1001",
    hint: "Teacher IDs start with T- and are issued by your school admin.",
  },
  student: {
    title: "Student Sign In",
    badge: "Learner Access",
    description: "Enter your Student ID and password to view results, attendance, fees and notices.",
    idLabel: "Student ID",
    idPlaceholder: "e.g. S-2001",
    hint: "Student IDs start with S- (plain numbers work too). Find yours on the admission slip.",
  },
};

/** Per-tab identifier guard. Student tab is lenient: S- IDs or plain numeric IDs. */
function tabIdError(tab: RoleTab, identifier: string): string | null {
  const id = identifier.trim();
  if (tab === "teacher") {
    if (!/^(T-)/i.test(id)) return "Teacher IDs start with T- (e.g. T-1001). For S- IDs, use the Student tab.";
    return null;
  }
  if (!/^(S-)/i.test(id) && !/^\d+$/.test(id)) {
    if (id.includes("@")) return null; // let lib/auth.ts raise the console-login error
    return "Student IDs start with S- (e.g. S-2001). For T- IDs, use the Teacher tab.";
  }
  return null;
}

function PortalLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<RoleTab>("teacher");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });
  const config = TAB_CONFIG[tab];

  function switchTab(next: RoleTab) {
    if (next === tab) return;
    setTab(next);
    form.reset({ identifier: "", password: "" });
    form.clearErrors();
  }

  async function onSubmit(values: LoginInput) {
    const prefixError = tabIdError(tab, values.identifier);
    if (prefixError) {
      form.setError("identifier", { message: prefixError });
      return;
    }
    setPending(true);
    try {
      const user = await login(values.identifier, values.password);
      if (user.role !== tab) {
        await logout().catch(() => undefined);
        toast.error(`This is a ${user.role === "teacher" ? "Teacher" : "Student"} ID — switch to the ${user.role === "teacher" ? "Teacher" : "Student"} tab.`);
        return;
      }
      toast.success(`Welcome, ${user.name}`);
      router.replace(homeFor(user.role));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  const IdIcon = tab === "teacher" ? IdCard : Hash;

  return (
    <main className="min-h-screen bg-[#f3f4fb] px-4 py-6 sm:px-8 lg:grid lg:place-items-center lg:px-10">
      <div className="mx-auto grid w-full max-w-[970px] overflow-hidden rounded-2xl bg-white shadow-[0_14px_40px_rgba(34,32,94,0.12)] ring-1 ring-[#e4e5f2] lg:grid-cols-[405px_1fr]">
        <section className="flex min-h-[555px] flex-col bg-[#12124c] px-9 py-9 text-white sm:px-10">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#2b2b70]">
              <ShieldCheck size={19} />
            </div>
            <div>
              <div className="font-display text-lg font-bold">EduNest</div>
              <div className="text-[10px] font-semibold tracking-[0.14em] text-[#aeadde]">STUDENT & TEACHER PORTAL</div>
            </div>
          </div>
          <div className="mt-7 inline-flex w-fit items-center gap-2 rounded-full bg-[#242461] px-3 py-1.5 text-xs font-semibold text-[#deddfb]">
            <span className="h-2 w-2 rounded-full bg-[#24c998]" />
            Academic session active
          </div>
          <h1 className="mt-8 max-w-[310px] font-display text-3xl font-bold leading-[1.12] tracking-tight">Your Classroom, Connected</h1>
          <p className="mt-4 max-w-[320px] text-sm leading-6 text-[#c7c6ed]">
            Teachers manage classes, attendance and marks. Students track results, attendance, fees and circulars.
          </p>
          <div className="mt-8 space-y-4 border-t border-white/10 pt-6">
            <SecurityItem icon={<ShieldCheck size={17} />} title="Role-guarded sessions" text="Teachers and students see only their own space." />
            <SecurityItem icon={<LockKeyhole size={17} />} title="Private by default" text="Attendance, marks and fees stay restricted." />
            <SecurityItem icon={<Bell size={17} />} title="Notices & circulars" text="School announcements reach the right audience." />
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-6 text-xs text-[#aeadde]">
            <span>EduNest Security Protocol</span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#24c998]" />
              All gateways online
            </span>
          </div>
        </section>
        <section className="flex min-h-[555px] flex-col justify-center px-7 py-10 sm:px-14">
          <div className="mx-auto w-full max-w-[425px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-3xl font-bold tracking-tight text-[#11104c]">{config.title}</h2>
              <span className="rounded-md bg-[#f0efff] px-3 py-1 text-xs font-semibold text-[#37356d]">{config.badge}</span>
            </div>
            <p className="mt-2 text-sm leading-5 text-[#777792]">{config.description}</p>
            <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-[#f1f0fa] p-1" role="tablist" aria-label="Login type">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "teacher"}
                onClick={() => switchTab("teacher")}
                className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${tab === "teacher" ? "bg-[#29285f] text-white shadow-[0_5px_10px_rgba(41,40,95,0.2)]" : "text-[#6d6b92] hover:text-[#35336f]"}`}
              >
                <GraduationCap size={17} /> Teacher
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "student"}
                onClick={() => switchTab("student")}
                className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${tab === "student" ? "bg-[#29285f] text-white shadow-[0_5px_10px_rgba(41,40,95,0.2)]" : "text-[#6d6b92] hover:text-[#35336f]"}`}
              >
                <Backpack size={17} /> Student
              </button>
            </div>
            {params.get("error") === "use-console" ? (
              <div className="mt-5 rounded-lg bg-[#fff6dc] p-3 text-sm text-[#946d11]">That account uses console login.</div>
            ) : null}
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-7 space-y-5">
              <FieldLabel label={config.idLabel} required error={form.formState.errors.identifier?.message}>
                <div className="relative">
                  <IdIcon className="absolute left-3 top-3.5 text-[#8d8bab]" size={17} />
                  <input
                    {...form.register("identifier")}
                    autoComplete="username"
                    placeholder={config.idPlaceholder}
                    className="h-11 w-full rounded-xl border border-[#dadbef] pl-10 pr-3 text-sm text-[#17164b] outline-none ring-[#aaa9dc] placeholder:text-[#9a98ad] focus:ring-2"
                  />
                </div>
                <p className="mt-1.5 text-xs font-normal leading-4 text-[#85839c]">{config.hint}</p>
              </FieldLabel>
              <FieldLabel label="Password" required error={form.formState.errors.password?.message}>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-3.5 text-[#8d8bab]" size={17} />
                  <input
                    {...form.register("password")}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="h-11 w-full rounded-xl border border-[#dadbef] pl-10 pr-11 text-sm text-[#17164b] outline-none ring-[#aaa9dc] placeholder:text-[#9a98ad] focus:ring-2"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-3 text-[#8d8bab] hover:text-[#35336f]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FieldLabel>
              <button
                disabled={pending}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#29285f] text-sm font-semibold text-white shadow-[0_5px_10px_rgba(41,40,95,0.2)] transition hover:bg-[#1f1e52] disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? "Signing in…" : tab === "teacher" ? "Sign In & Open Classes" : "Sign In & Open Dashboard"}
              </button>
            </form>
            <p className="mt-6 text-center text-xs leading-5 text-[#85839c]">
              School admin? Use the console login with your institutional email.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function SecurityItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#292968] text-[#a8b9ff]">{icon}</div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-[#aaa9dc]">{text}</div>
      </div>
    </div>
  );
}

function FieldLabel({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-[#17164b]">
      <span>
        {label}
        {required ? <span className="ml-1 text-[#c8324d]">*</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block font-normal text-[#b22c43]">{error}</span> : null}
    </label>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense>
      <PortalLoginForm />
    </Suspense>
  );
}
