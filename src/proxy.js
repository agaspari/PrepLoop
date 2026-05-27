import { NextResponse } from "next/server";

/**
 * Next.js 16 Proxy — Firebase Auth session verification.
 * Checks for the firebaseToken cookie on protected routes.
 * The actual token verification happens server-side in actions.js;
 * this proxy only checks for cookie presence as a fast gate.
 */
export function proxy(request) {
  const { pathname } = request.nextUrl;

  // Public paths that don't require auth
  const publicPaths = [
    "/login",
    "/_next",
    "/favicon.ico",
    "/api/cron",
  ];

  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for Firebase session cookie
  const sessionCookie = request.cookies.get("firebaseToken")?.value;

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
