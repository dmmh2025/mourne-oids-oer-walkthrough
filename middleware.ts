import { NextRequest, NextResponse } from "next/server";

// Read list of allowed users from an environment variable.
// Format: [{"user":"Damien","pass":"Pepperoni1"}, ...]
const raw = process.env.BASIC_AUTH_JSON || "[]";

type Cred = { user: string; pass: string };
let ALLOWED: Cred[] = [];
try {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    ALLOWED = parsed
      .filter((x) => x && typeof x.user === "string" && typeof x.pass === "string")
      .map((x) => ({ user: x.user, pass: x.pass }));
  }
} catch {
  // ignore
}

function unauthorized() {
  const res = new NextResponse("Authentication required.", { status: 401 });
  res.headers.set("WWW-Authenticate", 'Basic realm="Mourne-oids Hub", charset="UTF-8"');
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Always skip API routes (this fixes your /api/submit)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 2) Skip static assets / Next internals
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/public/") ||
    pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico|css|js|map|woff2?|ttf|txt|pdf)$/i)
  ) {
    return NextResponse.next();
  }

  // 3) Protect pages (extend the list as needed)
  const protectedPaths = [
    "/",                // home
    "/walkthrough",
    "/admin",
    "/success",
    "/deep-clean",
    "/memomailer",
    "/pizza-of-the-week",
  ];
  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!isProtected) return NextResponse.next();

  // 4) Check Basic Auth
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Basic ")) return unauthorized();

  try {
    const base64 = auth.replace("Basic ", "");
    const decoded = Buffer.from(base64, "base64").toString("utf8"); // "user:pass"
    const idx = decoded.indexOf(":");
    if (idx === -1) return unauthorized();
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);

    const ok = ALLOWED.some((c) => c.user === user && c.pass === pass);
    return ok ? NextResponse.next() : unauthorized();
  } catch {
    return unauthorized();
  }
}

// Run on pages only (exclude /api and _next at the matcher level too)
export const config = {
  matcher: ["/((?!api|_next|favicon.ico).*)"],
};
