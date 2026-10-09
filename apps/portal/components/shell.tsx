"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, BookOpen, ChevronDown, CircleUserRound, ClipboardCheck, FileText, GraduationCap, LogOut, Menu, MessageSquare, NotebookTabs, ReceiptText, Search, Settings2, ShieldCheck, Users, WalletCards, Grid2X2, X } from "lucide-react";
import { getMe, logout, type SessionUser } from "@/lib/auth";
import { StudentShell } from "@/components/student-portal";

const TEACHER_NAV = [
  { href: "/teacher/dashboard", label: "Dashboard", icon: Grid2X2 },
  { href: "/teacher/classes", label: "My Classes", icon: Users },
  { href: "/teacher/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/teacher/tests", label: "Tests", icon: NotebookTabs },
  { href: "/teacher/results/publish", label: "Results", icon: BookOpen },
  { href: "/teacher/students/new", label: "Add Student", icon: CircleUserRound },
  { href: "/teacher/promote", label: "Promote Students", icon: GraduationCap },
  { href: "/teacher/fees", label: "Fees", icon: ReceiptText },
  { href: "/teacher/salary", label: "Salary", icon: WalletCards },
  { href: "/teacher/notices", label: "Notices", icon: FileText },
  { href: "/teacher/complaints", label: "Complaints", icon: MessageSquare },
  { href: "/teacher/profile", label: "My Profile", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/login") return;
    getMe().then((u) => {
      if (u.role !== "teacher" && u.role !== "student") {
        router.replace("/login?error=use-console");
        return;
      }
      setUser(u);
      if (u.role === "teacher" && !pathname.startsWith("/teacher")) router.replace("/teacher/dashboard");
      if (u.role === "student" && !pathname.startsWith("/student")) router.replace("/student/home");
    }).catch(() => {
      logout().catch(() => undefined).finally(() => router.replace("/login"));
    });
  }, [pathname, router]);

  useEffect(() => {
    if (pathname === "/login" || !pathname.startsWith("/teacher")) return;
    const title = pathname.includes("/dashboard")
      ? "Dashboard"
      : pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ?? "Portal";
    document.title = `${title.replace(/\b\w/g, (character) => character.toUpperCase())} · EduNest Portal`;
  }, [pathname]);

  if (pathname === "/login") return <>{children}</>;
  if (pathname.startsWith("/student")) return <StudentShell user={user}>{children}</StudentShell>;
  if (!pathname.startsWith("/teacher")) return <>{children}</>;

  const sidebarWidth = collapsed ? "lg:pl-[78px]" : "lg:pl-[300px]";
  const pageTitle = TEACHER_NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "Dashboard";

  function navigation(mobile = false) {
    return TEACHER_NAV.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || (href !== "/teacher/dashboard" && pathname.startsWith(`${href}/`));
      return <Link key={href} href={href} onClick={() => mobile && setMobileOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${active ? "bg-[#302d6d] text-white shadow-[inset_3px_0_0_#bab8ff]" : "text-[#aaa8d0] hover:bg-white/10 hover:text-white"}`}><Icon size={19} />{!collapsed || mobile ? <span>{label}</span> : null}</Link>;
    });
  }

  async function confirmLogout() {
    await logout();
    setLogoutOpen(false);
    router.replace("/login");
  }

  return <div className="min-h-screen bg-[#f6f4ff] text-[#17164b]">
    <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-[#12113f] text-white transition-all lg:flex ${collapsed ? "w-[78px]" : "w-[300px]"}`}>
      <div className="relative flex h-[78px] items-center gap-3 border-b border-white/10 px-5"><button type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#2e2b6e] transition hover:bg-[#403d85]"><GraduationCap size={22} /></button>{!collapsed ? <div><div className="font-display text-xl font-bold tracking-tight">EduNest</div><div className="text-xs font-semibold tracking-[0.16em] text-[#a9a7d2]">TEACHER CONSOLE</div></div> : null}</div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-6">{navigation()}</nav>
      <button type="button" aria-label="Open account actions" onClick={() => setLogoutOpen(true)} className={`m-3 rounded-xl bg-[#211f5c] p-3 text-left transition hover:bg-[#2a2870] ${collapsed ? "flex justify-center" : ""}`}><div className="flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d8d7f6] text-sm font-bold text-[#27255e]">{user?.name?.slice(0, 1).toUpperCase() ?? "T"}</div>{!collapsed ? <div className="min-w-0"><div className="truncate text-sm font-semibold">{user?.name ?? "Teacher"}</div><div className="text-xs text-[#aaa8d0]">{user?.role ?? "teacher"}</div></div> : null}<ChevronDown size={17} className={`${collapsed ? "hidden" : "ml-auto"} text-[#aaa8d0]`} /></div></button>
    </aside>
    <div className={`${sidebarWidth} transition-all`}>
      <header className="sticky top-0 z-30 flex h-[78px] items-center gap-4 border-b border-[#e7e4f5] bg-white/95 px-4 backdrop-blur sm:px-7"><button aria-label="Open navigation" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-[#f3f1ff] lg:hidden"><Menu size={21} /></button><div className="hidden shrink-0 items-center gap-3 text-sm font-semibold text-[#686681] md:flex"><span className="text-[#8b89a7]">EDUNEST</span><span>›</span><span className="text-[#1b194b]">{pageTitle}</span></div><div className="relative mx-auto flex w-full max-w-[520px] flex-1 items-center"><Search className="absolute left-3 text-[#85829f]" size={18} /><input aria-label="Global search" placeholder="Search students, classes, records…" className="h-11 w-full rounded-lg bg-[#f3f1fc] pl-10 pr-3 text-sm outline-none ring-[#cbc8f3] placeholder:text-[#85829f] focus:ring-2" /></div><div className="hidden shrink-0 items-center gap-3 sm:flex"><span className="rounded-md bg-[#f0efff] px-3 py-2 text-xs font-semibold text-[#26235e]"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#5f5c9a]" />Platform: Operational</span><button aria-label="Notifications" className="rounded-lg p-2 hover:bg-[#f3f1ff]"><Bell size={18} /></button><button aria-label="Security" className="rounded-lg p-2 hover:bg-[#f3f1ff]"><ShieldCheck size={18} /></button></div><button type="button" aria-label="Open account actions" onClick={() => setLogoutOpen(true)} className="flex shrink-0 items-center gap-2 rounded-lg p-1.5 text-left transition hover:bg-[#f3f1ff]"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#d9d7ef] text-sm font-bold">{user?.name?.slice(0, 1).toUpperCase() ?? "T"}</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-4">{user?.name ?? "Teacher"}</div><div className="text-xs text-[#77748d]">Teacher Workspace</div></div><ChevronDown size={16} className="hidden sm:block" /></button></header>
      <main className="min-h-[calc(100vh-78px)] px-4 py-5 sm:px-7 lg:px-8">{children}</main>
    </div>
    {mobileOpen ? <div className="fixed inset-0 z-50 bg-[#12113f]/60 lg:hidden" onClick={() => setMobileOpen(false)}><aside className="h-full w-[280px] bg-[#12113f] p-4 text-white" onClick={(event) => event.stopPropagation()}><div className="mb-8 flex items-center justify-between"><div className="font-display text-xl font-bold">EduNest</div><button aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X /></button></div><nav className="flex flex-col gap-1">{navigation(true)}</nav></aside></div> : null}
    {logoutOpen ? <div className="fixed inset-0 z-[60] grid place-items-center bg-[#0d0c31]/55 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="logout-title" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f0efff] text-[#29285f]"><LogOut size={21} /></div><h2 id="logout-title" className="mt-4 text-center font-display text-xl font-bold">Sign out of EduNest?</h2><p className="mt-2 text-center text-sm leading-6 text-[#77748d]">Your current session will be closed on this device.</p><div className="mt-6 flex gap-3"><button type="button" onClick={() => setLogoutOpen(false)} className="flex-1 rounded-lg bg-[#f0efff] px-4 py-3 text-sm font-semibold text-[#29285f]">Cancel</button><button type="button" onClick={() => void confirmLogout()} className="flex-1 rounded-lg bg-[#29285f] px-4 py-3 text-sm font-semibold text-white">Sign out</button></div></section></div> : null}
  </div>;
}
