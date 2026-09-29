"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe, logout, type SessionUser } from "@/lib/auth";
import { useNow } from "@/lib/useNow";

const ADMIN_NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/teachers", label: "Teachers" },
  { href: "/admin/classes", label: "Classes" },
  { href: "/admin/timetable", label: "Timetable" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/fees", label: "Fees" },
  { href: "/admin/salary", label: "Salary" },
  { href: "/admin/notices", label: "Notices" },
  { href: "/admin/complaints", label: "Complaints" },
  { href: "/admin/reports/school", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

const SUPER_NAV = [
  { href: "/super/dashboard", label: "Dashboard" },
  { href: "/super/requests", label: "Approvals" },
  { href: "/super/institutes", label: "Directory" },
  { href: "/super/audit", label: "Audit" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const now = useNow();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    if (pathname === "/login" || pathname === "/request-access") return;
    getMe()
      .then((u) => {
        if (u.role !== "admin" && u.role !== "super-admin") {
          router.replace("/login?error=use-portal");
          return;
        }
        setUser(u);
      })
      .catch(() => router.replace("/login"));
  }, [pathname, router]);

  if (pathname === "/login" || pathname === "/request-access") return <>{children}</>;

  const nav = user?.role === "super-admin" ? SUPER_NAV : ADMIN_NAV;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex items-center justify-between bg-[#EA580C] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-bold">EduNest Console</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{user?.role ?? "console"}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="tabular-nums">{now.toLocaleString()}</span>
          {user ? (
            <button
              className="rounded-lg bg-white/15 px-2 py-1"
              onClick={() => logout().then(() => router.replace("/login"))}
            >
              Logout
            </button>
          ) : null}
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-[#F5F5F4] bg-white p-3 lg:block">
          <nav className="flex flex-col gap-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-2 text-sm ${pathname === n.href ? "bg-[#FFF7ED] font-medium text-[#EA580C]" : "text-[#1C1917] hover:bg-[#FFF7ED]"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 bg-white p-4">{children}</main>
      </div>
    </div>
  );
}
