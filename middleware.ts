// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// this is what you said you're using on Vercel
// e.g. BASIC_AUTH_JSON='{"damien":"supersecret","leona":"another"}'
const raw = process.env.BASIC_AUTH_JSON || "";
let USERS: Record<string, string> = {};
try {
  if (raw) {
    USERS = JSON.parse(raw);
  }
} catch (e) {
  // ignore bad JSON
  USERS = {};
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) always allow these paths
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2) 👉 IMPORTANT: allow /admin to render, so the page can do its own Supabase
  //    "is this email in ADMIN_EMAILS?" check
  if (pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // 3) everything else = check basic auth
  const auth = req.headers.get("authorization");

  if (!auth || !auth.startsWith("Basic ")) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    // ask browser for basic auth creds
    res.headers.set("WWW-Authenticate", 'Basic realm="Mourne-oids Hub"');
    return res;
  }

  // parse basic auth header
  const base64 = auth.split(" ")[1] || "";
  const [user, pass] = Buffer.from(base64, "base64").toString().split(":");

  if (!user || !pass) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.headers.set("WWW-Authenticate", 'Basic realm="Mourne-oids Hub"');
    return res;
  }

  const expected = USERS[user];

  if (!expected || expected !== pass) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.headers.set("WWW-Authenticate", 'Basic realm="Mourne-oids Hub"');
    return res;
  }

  // 4) authenticated → carry on
  return NextResponse.next();
}

// match everything except the obvious static bits
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
