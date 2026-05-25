import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.APP_PASSWORD || "preploop-fallback-secret";

/**
 * Create a signed session token using HMAC-SHA256.
 */
function createSessionToken() {
  const payload = `preploop-session:${Date.now()}`;
  const hmac = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

/**
 * Verify a session token's HMAC signature.
 */
export function verifySessionToken(token) {
  if (!token || !token.includes(".")) return false;
  
  const lastDotIndex = token.lastIndexOf(".");
  const payload = token.substring(0, lastDotIndex);
  const signature = token.substring(lastDotIndex + 1);
  
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
  
  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/**
 * POST /api/auth — Verify password and set session cookie.
 */
export async function POST(request) {
  try {
    const { password } = await request.json();
    const appPassword = process.env.APP_PASSWORD;

    if (!appPassword) {
      return NextResponse.json(
        { success: false, error: "APP_PASSWORD is not configured on the server." },
        { status: 500 }
      );
    }

    // Timing-safe password comparison
    const passwordBuffer = Buffer.from(password || "");
    const expectedBuffer = Buffer.from(appPassword);
    
    const isValid = passwordBuffer.length === expectedBuffer.length && 
      crypto.timingSafeEqual(passwordBuffer, expectedBuffer);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Incorrect password." },
        { status: 401 }
      );
    }

    // Password correct — create signed session token and set cookie
    const token = createSessionToken();
    const cookieStore = await cookies();

    cookieStore.set("preploop-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication failed." },
      { status: 500 }
    );
  }
}
