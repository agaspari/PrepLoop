import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /api/auth/logout — Clear session cookie and redirect to login.
 */
export async function GET() {
  const cookieStore = await cookies();
  
  cookieStore.set("preploop-session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0, // Expire immediately
    path: "/",
  });

  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"));
}
