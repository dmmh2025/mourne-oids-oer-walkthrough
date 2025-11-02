import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// add or remove protected paths here
const PROTECTED_PATHS = ["/admin", "/deep-clean", "/oer", "/memo", "/memomailer"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // only protect certain routes
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // 1) check for Supabase browser session (very simple check)
  // different Supabase versions name this slightly differently so we check a couple
  const hasSupabaseSession =
    req.cookies.get("sb-access-token") ||
    req.cookies.get("sb:token") ||
    req.cookies.get("supabase-auth-token");

  if (hasSupabaseSession) {
    return NextResponse.next();
  }

  // 2) fall back to your existing Basic Auth (what you already had on Vercel)
  const basicAuthHeader = req.headers.get("authorization");
  const json = process.env.BASIC_AUTH_JSON; // this is what you said you already had in Vercel

  if (json && basicAuthHeader?.startsWith("Basic ")) {
    // decode provided credentials
    const base64Credentials = basicAuthHeader.split(" ")[1];
    const [incomingUser, incomingPass] = Buffer.from(base64Credentials, "base64")
      .toString("utf-8")
      .split(":");

    // stored credentials (e.g. { "admin": "password123", "damien": "pizza" })
    const allowed = JSON.parse(json) as Record<string, string>;

    const isValid = Object.entries(allowed).some(
      ([user, pass]) => user === incomingUser && pass === incomingPass
    );

    if (isValid) {
      return NextResponse.next();
    }
  }

  // 3) otherwise, go to login
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirectedFrom", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/deep-clean/:path*", "/oer/:path*", "/memo/:path*", "/memomailer/:path*"],
};
