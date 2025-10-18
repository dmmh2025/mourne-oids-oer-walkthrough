import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Server-side Supabase client with SERVICE KEY (bypasses RLS for safe, controlled inserts)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // <-- service role key (server-only)
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const payload = {
      store: body.store ?? null,
      name: body.name ?? null,
      adt: body.adt ?? null,
      sbr: body.sbr ?? null,
      extremes: body.extremes ?? null,
      section_total: body.section_total ?? null,
      service_total: body.service_total ?? null,
      predicted: body.predicted ?? null,
      sections: body.sections ?? null, // jsonb
    };

    const { data, error } = await supabase
      .from("walkthrough_submissions")
      .insert([payload])
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: data?.id ?? null });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}
