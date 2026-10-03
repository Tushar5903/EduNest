import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "edunest_token";

/**
 * Portal gate: teacher|student only (UX gate; backend allowRoles is the real guard).
 * Middleware is cookie-presence only (no DB, no JWT verify here) — pages hydrate
 * role via GET /auth/me and redirect if role mismatches.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return NextResponse.next();
  }
  const hasSession = Boolean(req.cookies.get(COOKIE)?.value);
  if (!hasSession && pathname !== "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  // NOTE: no hasSession-on-/login redirect — it used to ping-pong with the
  // root page's redirect (infinite blank refresh loop). Role routing is owned
  // by app/page.tsx (client, via GET /auth/me) and the shell role guard.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
