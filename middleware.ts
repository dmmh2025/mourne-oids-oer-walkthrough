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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) always allow these paths
  if (
    pathname === "/" ||                     // 👈 let the hub / signup screen load
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2) also allow /admin through so the page itself can decide using Supabase
  if (pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // 3) everything else still uses your Basic Auth
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
