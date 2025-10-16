import { NextResponse } from "next/server";

export async function GET() {
  const raw = process.env.BASIC_AUTH_JSON || "[]";
  let count = 0;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) count = arr.filter(
      (x: any) => x && typeof x.user === "string" && typeof x.pass === "string"
    ).length;
  } catch {}
  return NextResponse.json({ usersLoaded: count });
}
