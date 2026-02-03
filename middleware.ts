// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/pending"];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // allow next static/assets + favicon
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/robots.txt")) return true;
  if (pathname.startsWith("/sitemap")) return true;
  // allow images/fonts you may serve directly
  if (pathname.startsWith("/mourneoids_")) return true;
  if (pathname.startsWith("/public")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let public routes through
  if (isPublicPath(pathname)) return NextResponse.next();

  // Create response we can attach auth cookie updates to
  const res = NextResponse.next();

  // Supabase server client (reads auth from cookies)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // 1) Must be signed in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 2) Must be approved
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("approved, role")
    .eq("id", user.id)
    .maybeSingle();

  // If no profile row, treat as not approved
  const approved = profile?.approved === true;

  // Optional: allow admins even if approved is false (remove if you don't want this)
  const isAdmin = (profile?.role || "").toLowerCase() === "admin";

  if (!approved && !isAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = "/pending";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
