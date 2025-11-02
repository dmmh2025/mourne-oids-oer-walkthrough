// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// we’re not doing Basic Auth anymore, we just let Next.js + Supabase handle it
export function middleware(req: NextRequest) {
  return NextResponse.next();
}

// still tell Next.js which routes it should run on
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
