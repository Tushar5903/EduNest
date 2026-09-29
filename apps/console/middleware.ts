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
  if (hasSession && (pathname === "/login" || pathname === "/request-access")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
