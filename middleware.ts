// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Basic Auth config from Vercel env
const raw = process.env.BASIC_AUTH_JSON || "";
let USERS: Record<string, string> = {};
try {
  if (raw) {
    USERS = JSON.parse(raw);
  }
} catch {
  USERS = {};
}

// this is the standard pattern to skip public files
const PUBLIC_FILE = /\.(.*)$/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 0) always let public files through (stuff in /public like your banner)
  if (PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  // 1) always allow these app routes
  if (
    pathname === "/" ||                     // your hub / login screen
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2) let /admin through — the page itself will check Supabase + email
  if (pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // 3) everything else: use your old Basic Auth
  const auth = req.headers.get("authorization");

  if (!auth || !auth.startsWith("Basic ")) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.headers.set("WWW-Authenticate", 'Basic realm="Mourne-oids Hub"');
    return res;
  }

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
