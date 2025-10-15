import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSubmissionEmails } from "../../../lib/mail";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || null;

function supabaseAsUser(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
}

export async function POST(req: Request) {
  try {
    const supabase = supabaseAsUser(req);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ error: "Not authenticated. Please log in." }, { status: 401 });
    }

    const body = await req.json();
    const sections = body?.sections ?? {};
    const section_total = Number(body?.section_total ?? 0);
    const adt = body?.adt === "" ? null : Number(body?.adt);
    const extreme_lates = body?.extreme_lates === "" ? null : Number(body?.extreme_lates);
    const sbr = body?.sbr === "" ? null : Number(body?.sbr);
    const service_total = Number(body?.service_total ?? 0);
    const predicted = Number(body?.predicted ?? 0);
    const store = body?.store ?? null;
    const user_email = body?.user_email ?? userData.user.email ?? null;

    if (!store) {
      return NextResponse.json({ error: "Store required." }, { status: 400 });
    }

    const { data, error } = await supabase
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
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // Send confirmation email (best effort)
    try {
      await sendSubmissionEmails({
        toUser: user_email,
        toAdmin: ADMIN_EMAIL,
        payload: {
          id: data.id,
          created_at: data.created_at,
          store: data.store,
          user_email: data.user_email,
          section_total: data.section_total,
          adt: data.adt,
          extreme_lates: data.extreme_lates,
          sbr: data.sbr,
          service_total: data.service_total,
          predicted: data.predicted,
        },
      });
    } catch (e) {
      console.warn("Email send failed", e);
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e: any) {
    console.error("Route error", e);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
