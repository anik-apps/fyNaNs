import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/mfa",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and static assets
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  if (
    isPublicRoute ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // In split-origin mode (frontend: 3000, API: 8888), the refresh_token
  // cookie is set by the API origin and not visible to the Next.js middleware.
  // Auth protection is handled client-side by AuthProvider.
  // In production (same origin behind Caddy), the cookie will be visible
  // and this check can be re-enabled.
  //
  // const hasRefreshToken = request.cookies.has("refresh_token");
  // if (!hasRefreshToken) {
  //   const loginUrl = new URL("/login", request.url);
  //   loginUrl.searchParams.set("redirect", pathname);
  //   return NextResponse.redirect(loginUrl);
  // }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons).*)"],
};
