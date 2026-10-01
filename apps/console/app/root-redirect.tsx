"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeFor } from "@/lib/auth";
import { getSessionUser } from "@/lib/super";

/**
 * Role-aware resolver for `/`.
 * Middleware only checks cookie presence (optimistic check per Next docs),
 * so `/` delegates to the backend session to pick the real home.
 * Falls back to /login when the session is stale/invalid.
 */
export function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getSessionUser()
      .then((user) => {
        if (!cancelled) router.replace(homeFor(user.role));
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return <p className="p-6 text-sm text-[#77748d]">Redirecting…</p>;
}
