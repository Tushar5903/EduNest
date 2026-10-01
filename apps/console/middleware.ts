import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "edunest_token";

/**
 * Console gate: admin|super-admin only (UX gate; backend allowRoles is the real guard).
 * Private app — also send X-Robots-Tag noindex (see layout metadata).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return NextResponse.next();
  }
  const hasSession = Boolean(req.cookies.get(COOKIE)?.value);
  const isPublic = pathname === "/login" || pathname === "/request-access";
  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  // NOTE: no authed redirect for /login or /request-access here.
  // Middleware only sees cookie presence, not role, so forcing
  // /login -> / while app/page.tsx redirects / -> /login created an
  // infinite loop. Let the client resolve the role home instead.
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
