import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supa = createClient(url, anon);

export async function POST(req: Request) {
  try {
    const body = await req.json(); // { store, sections }
    if (!body?.store || !body?.sections) {
      return new NextResponse("Missing store/sections", { status: 400 });
    }

    const { error } = await supa.from("deep_clean_submissions").insert({
      store: body.store,
      items: body.sections, // JSONB
    });

    if (error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return new NextResponse(e?.message || "Server error", { status: 500 });
  }
}
