import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function isISODate(d: string) {
  // YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // Query params
    const from = url.searchParams.get("from"); // YYYY-MM-DD
    const to = url.searchParams.get("to"); // YYYY-MM-DD
    const store = url.searchParams.get("store"); // optional

    // Defaults: last 30 days -> today
    const today = new Date().toISOString().slice(0, 10);
    const thirtyAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const fromDate = from && isISODate(from) ? from : thirtyAgo;
    const toDate = to && isISODate(to) ? to : today;

    const fromISO = new Date(fromDate + "T00:00:00.000Z").toISOString();
    const toISO = new Date(toDate + "T23:59:59.999Z").toISOString();

    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // ⚠️ Ensure this matches your actual table name:
    // If you used a different table, change it here.
    let q = supabase
      .from("osa_standards_walkthroughs")
      .select("store, walkthrough_type, completed_at, completed_by, is_admin_override")
      .gte("completed_at", fromISO)
      .lte("completed_at", toISO)
      .order("completed_at", { ascending: false })
      .limit(5000);

    if (store && store !== "All") {
      q = q.eq("store", store);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
