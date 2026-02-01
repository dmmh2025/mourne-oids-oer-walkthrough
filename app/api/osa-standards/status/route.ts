import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Returns today's completion status per store for pre_open and handover
export async function GET() {
  try {
    // Use UTC boundaries to keep it deterministic. If you want Europe/London day-boundaries,
    // tell me and I’ll adjust.
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("osa_standards_walkthroughs")
      .select("store, walkthrough_type, completed_at, completed_by, is_admin_override")
      .gte("completed_at", start.toISOString())
      .lte("completed_at", end.toISOString())
      .order("completed_at", { ascending: false });

    if (error) return new NextResponse(error.message, { status: 500 });

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err: any) {
    return new NextResponse(err?.message || "Server error", { status: 500 });
  }
}
