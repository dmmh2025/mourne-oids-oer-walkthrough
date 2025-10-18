import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only

// IMPORTANT: do NOT expose service key on the client.
const sb = createClient(url, serviceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      store,
      name,
      adt,
      sbr,
      extremes,
      sections,
      section_total,
      service_total,
      predicted,
    } = body ?? {};

    if (!store || !name) {
      return NextResponse.json(
        { error: "Missing store or name" },
        { status: 400 }
      );
    }

    // shape the row for your table
    const payload = {
      store,
      name,
      adt,
      sbr,
      extremes,
      sections,         // JSON
      section_total,
      service_total,
      predicted,
    };

    const { data, error } = await sb
      .from("walkthrough_submissions")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
