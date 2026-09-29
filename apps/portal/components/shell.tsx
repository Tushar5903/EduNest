"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe, logout, type SessionUser } from "@/lib/auth";
import { useNow } from "@/lib/useNow";

const STUDENT_NAV = [
  { href: "/student/home", label: "Home" },
  { href: "/student/results", label: "Results" },
  { href: "/student/attendance", label: "Attendance" },
  { href: "/student/fees", label: "Fees" },
  { href: "/student/timetable", label: "Timetable" },
  { href: "/student/notices", label: "Notices" },
  { href: "/student/teachers", label: "My Teachers" },
  { href: "/student/complaints", label: "Complaints" },
];

const TEACHER_NAV = [
  { href: "/teacher/dashboard", label: "Live Queue" },
  { href: "/teacher/classes", label: "My Classes" },
  { href: "/teacher/attendance", label: "Attendance" },
  { href: "/teacher/tests", label: "Tests & Marks" },
  { href: "/teacher/fees", label: "Fees" },
  { href: "/teacher/salary", label: "Salary" },
  { href: "/teacher/notices", label: "Notices" },
  { href: "/teacher/complaints", label: "Complaints" },
  { href: "/teacher/promote", label: "Promote" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const now = useNow();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    if (pathname === "/login") return;
    getMe()
      .then((u) => {
        if (u.role !== "teacher" && u.role !== "student") {
          router.replace("/login?error=use-console");
          return;
        }
        if (pathname === "/" || pathname.startsWith("/student") !== (u.role === "student")) {
          if (u.role === "teacher" && !pathname.startsWith("/teacher")) router.replace("/teacher/dashboard");
          if (u.role === "student" && !pathname.startsWith("/student")) router.replace("/student/home");
        }
        setUser(u);
      })
      .catch(() => router.replace("/login"));
  }, [pathname, router]);

  if (pathname === "/login") return <>{children}</>;

  const nav = user?.role === "teacher" ? TEACHER_NAV : STUDENT_NAV;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex items-center justify-between bg-[#EA580C] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-bold">EduNest</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{user?.role ?? "portal"}</span>
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
      {user?.adminStatus === "suspended" ? (
        <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
          Admin suspended — contact Super-Admin. School keeps running.
        </div>
      ) : null}
      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-[#F5F5F4] bg-white p-3 md:block">
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
        <main className="flex-1 bg-white p-4 pb-20 md:pb-4">{children}</main>
      </div>
      <nav className="fixed bottom-0 flex w-full gap-1 overflow-x-auto border-t bg-white p-2 md:hidden">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs ${pathname === n.href ? "bg-[#FFF7ED] font-medium text-[#EA580C]" : ""}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
