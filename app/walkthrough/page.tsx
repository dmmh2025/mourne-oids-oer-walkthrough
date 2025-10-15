"use client";
export const dynamic = "force-dynamic";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

/**
 * Walkthrough sections — TOTAL = 75
 * (Your requested increases applied; other sections lightly reduced to keep total at 75.)
 */
const SECTIONS: {
  key: string;
  title: string;
  max: number;
  items: { key: string; label: string }[];
}[] = [
  // LEFT COLUMN
  {
    key: "temperature_records",
    title: "Temperature Records",
    max: 6, // was 3 (+ cooking temps)
    items: [
      { key: "complete_pre_open", label: "Complete and upload PRE-OPEN" },
      { key: "cooking_temps", label: "Cooking temperatures recorded & in range" },
    ],
  },
  {
    key: "shelf_life",
    title: "Shelf Life",
    max: 3,
    items: [
      { key: "dated_within_shelf", label: "All products (incl. staff food) dated & within shelf life" },
    ],
  },
  {
    key: "hand_washing",
    title: "Hand Washing",
    max: 3,
    items: [
      { key: "sinks_stocked_20s", label: "Sinks stocked (soap/towels); washing for 20 seconds" },
    ],
  },
  {
    key: "sanitation",
    title: "Sanitation",
    max: 4, // trimmed (was 5)
    items: [
      { key: "surfaces_2h", label: "Food surfaces/utensils sanitised every 2h (clock running)" },
      { key: "can_opener", label: "Can opener clean, rust-free; cleaned after each use" },
      { key: "smallwares_clean", label: "Bubble popper/shakers/squeeze bottles/keyboards clean for open" },
      { key: "sink_concentration", label: "Sanitiser sink correct concentration (test strip checked)" },
      { key: "bottles_filled", label: "Fresh sanitiser bottles filled each morning" },
      { key: "spray_only_prep", label: "ONLY sanitiser spray in food prep area" },
      { key: "tubs_changed", label: "Dip tubs/silicon/foil/squeeze bottles/gluten kit changed daily" },
      { key: "nothing_on_floor", label: "Nothing stored on dough trays/ directly on floor" },
    ],
  },
  {
    key: "great_remake",
    title: "Great/Remake Criteria (scored in Product Section)",
    max: 22, // was 20 (+ breaded sides)
    items: [
      { key: "no_day1_dough", label: "NO DAY 1 dough in use — swap with other stores" },
      { key: "bubble_popper_use", label: "Use bubble popper when needed; clean after every use" },
      { key: "no_sauce_cheese_crust", label: "No sauce or cheese on the crust" },
      { key: "breaded_sides", label: "Breaded sides cooked correctly (time/temp/quality)" },
      { key: "five_star_follow", label: "5★ Pizzas — follow Sell/Remake: RIM / SIZE / PORTION / PLACEMENT / BAKE" },
    ],
  },
  {
    key: "dough",
    title: "Dough",
    max: 4, // trimmed (was 5)
    items: [
      { key: "mixed_trays_out", label: "Mixed trays dated; all sizes out at all times (incl. VEGAN)" },
      { key: "covered_clean_tray", label: "All dough covered with a clean/sanitised tray" },
      { key: "discard_blown", label: "Discard blown dough immediately and replace" },
      { key: "plan_created", label: "Dough plan created for day and used" },
    ],
  },
  {
    key: "approved_product",
    title: "Approved Product & Procedures",
    max: 8, // was 2 (+ pest control)
    items: [
      { key: "bins_max_2h", label: "Makeline bins MAX 2 hours of product (≤ 1.5 full)" },
      { key: "gf_kit_black_bottom", label: "GF kit set; toppings in black tubs on bottom row" },
      { key: "no_out_of_products", label: "No out-of-products anywhere (no stickers/bars)" },
      { key: "allergen_poster", label: "Allergen poster (QR) displayed; leaflets available" },
      { key: "plant_based_order", label: "Plant-based procedures followed (PB cheese not over first catch tray)" },
      { key: "separate_scrapers", label: "Separate scrapers for veg/meat doughballs used" },
      { key: "back_door_closed", label: "Back door securely closed at ALL TIMES" },
      { key: "pest_control", label: "Pest control: checks complete, traps in place, no activity" },
    ],
  },

  // RIGHT COLUMN
  {
    key: "uniform_grooming",
    title: "Uniform & Brand Standards",
    max: 5, // stays 5 (+ drivers vehicle)
    items: [
      { key: "black_trousers", label: "Jet black trousers/jeans — no leggings/joggers/combat" },
      { key: "plain_undershirt", label: "Plain white/black undershirts; no visible writing/logos" },
      { key: "no_jumpers", label: "No jumpers/hoodies/jackets under Domino’s jacket" },
      { key: "clean_shaven", label: "Clean shaven or beard with clean lines" },
      { key: "no_piercings", label: "No visible piercings (not covered with plasters)" },
      { key: "drivers_vehicle", label: "Drivers vehicle clean/road-legal (lights/plates/insurance)" },
    ],
  },
  {
    key: "store_interior",
    title: "Store Interior / Customer View",
    max: 6, // trimmed (was 8)
    items: [
      { key: "toilets_lined_bin", label: "Toilets: lined bin with lid" },
      { key: "customer_view_clean", label: "Everything in customer view clean and tidy" },
      { key: "no_staff_food_view", label: "No staff food/drink in customer view (cut table/hot rack/driver table)" },
      { key: "bins_lids_clean", label: "All bins in customer view have lids and are clean" },
    ],
  },
  {
    key: "outside_entry",
    title: "Outside Entry",
    max: 2, // trimmed (was 3)
    items: [{ key: "no_branded_rubbish", label: "No branded rubbish; refuse bins not overflowing" }],
  },
  {
    key: "baking_equipment",
    title: "Baking Equipment",
    max: 2, // trimmed (was 3)
    items: [
      { key: "oven_clean", label: "Oven clean (not yellowing) — hood/filters/belt/frame" },
      { key: "screens_pans_clean", label: "Screens & pans clean, good repair, no carbon build-up" },
      { key: "wedge_gpb_clean", label: "Wedge/GPB pans cleaned daily & dried through oven pre-open" },
    ],
  },
  {
    key: "hotbags",
    title: "Hotbags",
    max: 1, // trimmed (was 2)
    items: [{ key: "brushed_clean_no_rips", label: "Brushed out, clean patches, no rips (isolate if damaged)" }],
  },
  {
    key: "walk_in_cooler",
    title: "Walk-in Cooler",
    max: 1, // trimmed (was 2)
    items: [
      { key: "surfaces_clean", label: "Fan/floor/ceiling/walls & shelving clean (no mould/debris/rust)" },
      { key: "door_seal_handle", label: "Door seal good; handle clean — no food debris" },
    ],
  },
  {
    key: "makeline",
    title: "Makeline",
    max: 1, // trimmed (was 2)
    items: [
      { key: "fixtures_clean", label: "Cupboards/doors/handles/shelves/seals/lids clean & in good condition" },
      { key: "catch_trays_good", label: "Catch trays/grills/seals in good condition — no splits/tears/missing rails" },
    ],
  },
  {
    key: "safety_security",
    title: "Safety & Security",
    max: 6, // trimmed (was 7)
    items: [
      { key: "drivers_drop_cash", label: "Drivers dropping cash (if applicable)" },
      { key: "safe_utilised", label: "Safe utilised, secure & working — time delay in use (not day lock)" },
      { key: "front_till_locked", label: "Front till locked; no key left at counter — ≤ £100 total" },
    ],
  },
  {
    key: "prp",
    title: "PRP",
    max: 1, // trimmed (was 2)
    items: [
      { key: "prep_sheet_printed", label: "Prep sheet printed & used for FULL DAY’S TRADE" },
      { key: "all_items_available", label: "ALL ITEMS AVAILABLE (source pre-open if NO)" },
    ],
  },
]; // ← sums to 75

/** ===== Service scoring (TOTAL 25) =====
 * ADT (mins) — max 15 pts
 * SBR (%) — max 5 pts
 * Extremes per 1000 — max 5 pts
 */
function scoreADT(adt: number | null): number | null {
  if (adt == null || Number.isNaN(adt)) return null;
  if (adt > 30) return 0;
  if (adt > 28 && adt <= 30) return 4;
  if (adt > 27 && adt <= 28) return 6;
  if (adt > 26 && adt <= 27) return 8;
  if (adt > 25 && adt <= 26) return 10;
  return 15; // ≤25
}
function scoreSBR(sbr: number | null): number | null {
  if (sbr == null || Number.isNaN(sbr)) return null;
  if (sbr < 50) return 0;
  if (sbr < 70) return 3;
  if (sbr < 75) return 4;
  return 5; // ≥75%
}
function scoreExtremes(perThousand: number | null): number | null {
  if (perThousand == null || Number.isNaN(perThousand)) return null;
  if (perThousand > 30) return 0;
  if (perThousand > 25) return 2; // 25.01–30
  if (perThousand > 20) return 3; // 20.01–25
  if (perThousand > 15) return 4; // 15.01–20
  return 5; // 0–15
}
function colourForPredicted(v: number) {
  if (v >= 85) return "#065f46"; // green
  if (v >= 70) return "#92400e"; // amber
  return "#7f1d1d";              // red
}

type SectionState = Record<string, boolean>;

export default function WalkthroughPage() {
  // store dropdown + optional email
  const [store, setStore] = React.useState("");
  const [userEmail, setUserEmail] = React.useState("");
  const stores = ["Downpatrick", "Kilkeel", "Newcastle"];

  // KPIs
  const [adt, setAdt] = React.useState<string | number>("");
  const [extPerThousand, setExtPerThousand] = React.useState<string | number>("");
  const [sbr, setSbr] = React.useState<string | number>("");

  // sections state
  const [sections, setSections] = React.useState<Record<string, SectionState>>(
    () =>
      Object.fromEntries(
        SECTIONS.map((sec) => [
          sec.key,
          Object.fromEntries(sec.items.map((i) => [i.key, false])),
        ])
      )
  );

  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  // walkthrough (/75)
  const walkthroughScore = React.useMemo(() => {
    let total = 0;
    for (const sec of SECTIONS) {
      const state = sections[sec.key] || {};
      const checked = sec.items.filter((i) => state[i.key]).length;
      const perItem = sec.max / sec.items.length;
      total += perItem * checked;
    }
    return Math.round(total);
  }, [sections]);

  // service (/25)
  const adtNum = adt === "" ? null : Number(adt);
  const extNum = extPerThousand === "" ? null : Number(extPerThousand);
  const sbrNum = sbr === "" ? null : Number(sbr);

  const adtPts = scoreADT(adtNum);
  const extPts = scoreExtremes(extNum);
  const sbrPts = scoreSBR(sbrNum);
  const serviceTotal = (adtPts ?? 0) + (extPts ?? 0) + (sbrPts ?? 0);

  // predicted (/100)
  const predicted = walkthroughScore + serviceTotal;

  function toggleItem(sectionKey: string, itemKey: string) {
    setSections((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], [itemKey]: !prev[sectionKey][itemKey] },
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!supabaseUrl || !supabaseAnon) {
      setMsg("❌ Missing Supabase env vars.");
      return;
    }
    if (!store.trim()) {
      setMsg("❌ Please select your Store.");
      return;
    }

    setSaving(true);
    try {
      const payloadSections = SECTIONS.map((sec) => ({
        key: sec.key,
        title: sec.title,
        max: sec.max,
        items: sec.items.map((i) => ({
          key: i.key,
          label: i.label,
          checked: sections[sec.key]?.[i.key] ?? false,
        })),
      }));

      const { error } = await supabase.from("walkthrough_submissions").insert([
        {
          sections: payloadSections,
          section_total: walkthroughScore,
          adt: adtNum,
          extreme_lates: extNum,
          sbr: sbrNum,
          service_total: serviceTotal,
          predicted,
          store,
          user_email: userEmail || null,
        },
      ]);

      if (error) throw error;
      setMsg("✅ Walkthrough saved!");
    } catch (err: any) {
      setMsg(`❌ ${err.message || "Failed to save"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>🍕 Daily OER Walkthrough</h1>
        <p style={{ margin: "6px 0 0 0", color: "#475569" }}>
          Updated weights & checks applied. Service points auto-calc from ADT / SBR / Extremes.
        </p>
      </header>

      {/* Score bar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", marginBottom: 12, flexWrap: "wrap" }}>
        <Badge label="Walkthrough" value={`${walkthroughScore}/75`} />
        <Badge label="Service" value={`${serviceTotal}/25`} />
        <Badge label="Predicted" value={`${predicted}/100`} strong color={colourForPredicted(predicted)} />
        <div style={{ marginLeft: "auto" }}>
          <small style={{ color: "#6b7280" }}>Green ≥85 • Amber ≥70 • Red &lt;70</small>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        {/* Store + email */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            Store
            <select value={store} onChange={(e) => setStore(e.target.value)} required style={input()}>
              <option value="" disabled>Select a store…</option>
              <option>Downpatrick</option>
              <option>Kilkeel</option>
              <option>Newcastle</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Your email (optional)
            <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="you@company.com" style={input()} />
          </label>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            ADT (mins)
            <input type="number" step="0.01" value={adt as number | string} onChange={(e) => setAdt(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 26.4" style={input()} />
            <small style={{ color: "#6b7280" }}>Points: {adtPts == null ? "—" : adtPts} / 15</small>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            SBR (%)
            <input type="number" step="0.01" value={sbr as number | string} onChange={(e) => setSbr(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 78" style={input()} />
            <small style={{ color: "#6b7280" }}>Points: {sbrPts == null ? "—" : sbrPts} / 5</small>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Extremes (per 1000 orders)
            <input type="number" step="0.01" value={extPerThousand as number | string} onChange={(e) => setExtPerThousand(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 18.3" style={input()} />
            <small style={{ color: "#6b7280" }}>Points: {extPts == null ? "—" : extPts} / 5</small>
          </label>
        </div>

        {/* Sections */}
        <div style={{ display: "grid", gap: 12 }}>
          {SECTIONS.map((sec) => {
            const state = sections[sec.key];
            const checkedCount = sec.items.filter((i) => state[i.key]).length;
            const secScore = Math.round((checkedCount / sec.items.length) * sec.max);

            return (
              <section key={sec.key} style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                  <h3 style={{ margin: 0 }}>{sec.title}</h3>
                  <span style={{ fontWeight: 700 }}>{secScore} / {sec.max}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                  {sec.items.map((it) => (
                    <label key={it.key} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 8, border: "1px solid #f1f5f9", borderRadius: 10 }}>
                      <input type="checkbox" checked={!!state[it.key]} onChange={() => toggleItem(sec.key, it.key)} style={{ marginTop: 4 }} />
                      <span>{it.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <button type="submit" disabled={saving} style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#006491", color: "white", fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Saving…" : "Save Walkthrough"}
        </button>

        {msg && (
          <p style={{ margin: 0, color: msg.startsWith("✅") ? "#065f46" : "#7f1d1d", fontWeight: 600 }}>
            {msg}
          </p>
        )}
      </form>
    </main>
  );
}

// UI helpers
function input(): React.CSSProperties {
  return { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none" };
}
function Badge(props: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: "#f1f5f9", border: "1px solid #e5e7eb", color: props.color || "#111827", fontWeight: props.strong ? 800 : 600 }}>
      <span style={{ opacity: 0.7 }}>{props.label}</span>
      <span>{props.value}</span>
    </span>
  );
}
