/**
 * @file middleware.ts
 * @description Next.js Edge Middleware for Server-Side Route Protection and RBAC.
 * Enforces authentication on /dashboard and /settings, and admin clearance on /admin.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const sessionToken = req.cookies.get("devledgr_session")?.value;
  const role = req.cookies.get("devledgr_role")?.value;
  const { pathname } = req.nextUrl;

  // 1. Authenticated User Routes (/dashboard, /settings)
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/settings")) {
    if (!sessionToken) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Admin & Reviewer Gated Routes (/admin)
  if (pathname.startsWith("/admin")) {
    if (!sessionToken) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", "/admin");
      return NextResponse.redirect(loginUrl);
    }

    if (role !== "admin" && role !== "reviewer") {
      // Rewrite to 403 Access Denied page while keeping /admin URL
      return NextResponse.rewrite(new URL("/403", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/admin/:path*"],
};
