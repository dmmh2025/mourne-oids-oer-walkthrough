import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const store = String(body.store || "").trim();
    const completedBy = String(body.completedBy || "Admin").trim();
    const walkthroughType = String(body.walkthroughType || "").trim(); // pre_open | handover
    const sections = body.sections ?? null;

    if (!store) return new NextResponse("Missing store", { status: 400 });
    if (walkthroughType !== "pre_open" && walkthroughType !== "handover") {
      return new NextResponse("Invalid walkthroughType", { status: 400 });
    }

    const { error } = await supabase.from("osa_standards_walkthroughs").insert({
      store,
      walkthrough_type: walkthroughType,
      completed_by: completedBy,
      completed_at: new Date().toISOString(),
      sections,
      is_admin_override: true,
    });

    if (error) return new NextResponse(error.message, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return new NextResponse(err?.message || "Server error", { status: 500 });
  }
}
