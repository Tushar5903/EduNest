"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getMe, homeFor } from "@/lib/auth";

/**
 * Role-aware root: logged-in users go straight to their home, everyone else
 * to /login. A server-side `redirect("/login")` here used to ping-pong with
 * the middleware's logged-in-/login redirect (infinite blank refresh loop).
 */
export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    getMe()
      .then((u) => router.replace(homeFor(u.role)))
      .catch(() => router.replace("/login"));
  }, [router]);
  return null;
}
