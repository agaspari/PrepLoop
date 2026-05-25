import { NextResponse } from "next/server";

/**
 * Lightweight HMAC verification for Edge Runtime.
 * Uses Web Crypto API (available in Edge) instead of Node's crypto module.
 */
async function verifyTokenEdge(token, secret) {
  if (!token || !token.includes(".")) return false;

  const lastDotIndex = token.lastIndexOf(".");
  const payload = token.substring(0, lastDotIndex);
  const signature = token.substring(lastDotIndex + 1);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return signature === expected;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Routes that bypass authentication
  const publicPaths = [
    "/login",
    "/api/auth",
    "/api/generate",  // Protected by its own CRON_SECRET
    "/_next",
    "/favicon.ico",
  ];

  // Allow public paths through without auth
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for APP_PASSWORD — if not set, auth is disabled (local dev convenience)
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return NextResponse.next();
  }

  // Verify session cookie
  const sessionCookie = request.cookies.get("preploop-session")?.value;
  const secret = process.env.AUTH_SECRET || process.env.APP_PASSWORD || "preploop-fallback-secret";

  if (sessionCookie) {
    const isValid = await verifyTokenEdge(sessionCookie, secret);
    if (isValid) {
      return NextResponse.next();
    }
  }

  // No valid session — redirect to login
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     * This ensures the middleware runs on pages, API routes, etc.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
