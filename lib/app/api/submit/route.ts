import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Minimal validation
    const sections = body?.sections ?? {};
    const section_total = Number(body?.section_total ?? 0);
    const adt = body?.adt === "" ? null : Number(body?.adt);
    const extreme_lates = body?.extreme_lates === "" ? null : Number(body?.extreme_lates);
    const sbr = body?.sbr === "" ? null : Number(body?.sbr);
    const service_total = Number(body?.service_total ?? 0);
    const predicted = Number(body?.predicted ?? 0);
    const store = body?.store ?? null;
    const user_email = body?.user_email ?? null;

    if (!Number.isFinite(section_total) || !Number.isFinite(service_total) || !Number.isFinite(predicted)) {
      return NextResponse.json({ error: "Invalid numbers" }, { status: 400 });
    }

    const { data, error } = await serverSupabase
      .from("walkthrough_submissions")
      .insert({
        sections,
        section_total,
        adt,
        extreme_lates,
        sbr,
        service_total,
        predicted,
        store,
        user_email,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
