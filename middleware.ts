import { NextRequest, NextResponse } from "next/server";

// Read list of allowed users from an environment variable.
// Format (JSON): [{"user":"Downpatrick","pass":"dp123"},{"user":"Kilkeel","pass":"kk123"}]
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
  // ignore; ALLOWED remains []
}

function unauthorized() {
  const res = new NextResponse("Authentication required.", { status: 401 });
  res.headers.set("WWW-Authenticate", 'Basic realm="OER", charset="UTF-8"');
  return res;
}

export function middleware(req: NextRequest) {
  // Skip static assets and Next internals
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/public/") ||
    pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico|css|js|map|woff2?|ttf|txt|pdf)$/i)
  ) {
    return NextResponse.next();
  }

  // Protect selected paths:
  // - Add or remove paths here.
  const protectedPaths = ["/", "/walkthrough", "/admin", "/success"];
  const isProtected = protectedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isProtected) return NextResponse.next();

  // Check Authorization header
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

// Limit where the middleware runs (important for performance).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
