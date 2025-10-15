"use client";
export const dynamic = "force-dynamic";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

/**
 * SECTION DEFINITIONS (75 pts total)
 * Edit section labels/items here
 */
const SECTIONS: {
  key: string;
  title: string;
  max: number;
  items: { key: string; label: string }[];
}[] = [
  {
    key: "exterior",
    title: "Exterior & Entry",
    max: 10,
    items: [
      { key: "signage", label: "Signage lit/visible" },
      { key: "windows", label: "Windows & doors clean" },
      { key: "entrance", label: "Entrance clear & safe" },
      { key: "posters", label: "Current promos displayed" },
    ],
  },
  {
    key: "front",
    title: "Front of House",
    max: 12,
    items: [
      { key: "counter", label: "Counter spotless & stocked" },
      { key: "uniforms", label: "Team in full uniform & badges" },
      { key: "handwash", label: "Handwash sink stocked (soap/towel)" },
      { key: "temp_logs", label: "Today’s temp logs started" },
      { key: "pos_ready", label: "POS online, receipt paper" },
    ],
  },
  {
    key: "makeline",
    title: "Makeline & Toppings",
    max: 14,
    items: [
      { key: "prep_levels", label: "Prep levels sufficient" },
      { key: "dates", label: "Use-by labels correct" },
      { key: "utensils", label: "Utensils clean & stored" },
      { key: "food_safety", label: "Cold-hold ≤ 5°C" },
      { key: "sanitiser", label: "Sanitiser buckets @ correct ppm" },
    ],
  },
  {
    key: "ovens",
    title: "Ovens & Cookline",
    max: 13,
    items: [
      { key: "oven_on", label: "Oven on & at temp" },
      { key: "screens", label: "Screens/cleaning complete" },
      { key: "spare_parts", label: "Peels, cutters, spares ready" },
      { key: "safety", label: "No hazards / clear walkways" },
    ],
  },
  {
    key: "back",
    title: "Back of House",
    max: 14,
    items: [
      { key: "dough", label: "Dough checked & rotated" },
      { key: "chiller", label: "Chillers/freezers in range" },
      { key: "cleaning", label: "Daily cleaning started" },
      { key: "waste", label: "Waste areas tidy & sealed" },
      { key: "deliveries", label: "Deliveries put away" },
    ],
  },
  {
    key: "service_ready",
    title: "Service Readiness",
    max: 12,
    items: [
      { key: "staffing", label: "Staffing level OK" },
      { key: "headsets", label: "Headsets charged/working" },
      { key: "drivers", label: "Drivers briefed, bags ready" },
      { key: "brief", label: "Team brief done" },
    ],
  },
]; // 10+12+14+13+14+12 = 75

// ==== Service scoring bands (TOTAL 25 pts) ====
// ADT (mins) → max 15 pts
function scoreADT(adt: number | null): number | null {
  if (adt == null || Number.isNaN(adt)) return null;
  if (adt > 30) return 0;
  if (adt > 28 && adt <= 30) return 4;
  if (adt > 27 && adt <= 28) return 6;
  if (adt > 26 && adt <= 27) return 8;
  if (adt > 25 && adt <= 26) return 10;
  // Under or equal 25 mins
  return 15;
}

// SBR (%) → max 5 pts
function scoreSBR(sbr: number | null): number | null {
  if (sbr == null || Number.isNaN(sbr)) return null;
  if (sbr < 50) return 0;
  if (sbr < 70) return 3;
  if (sbr < 75) return 4;
  return 5; // 75% and above
}

// Extremes (per 1000 orders) → max 5 pts
function scoreExtremes(perThousand: number | null): number | null {
  if (perThousand == null || Number.isNaN(perThousand)) return null;
  if (perThousand > 30) return 0;
  if (perThousand > 25) return 2;      // 25.01–30
  if (perThousand > 20) return 3;      // 20.01–25
  if (perThousand > 15) return 4;      // 15.01–20
  return 5;                            // 0–15
}

// helper for predicted badge colour
function colourForPredicted(v: number) {
  if (v >= 85) return "#065f46"; // green
  if (v >= 70) return "#92400e"; // amber
  return "#7f1d1d";              // red
}

type SectionState = Record<string, boolean>;

export default function WalkthroughPage() {
  // store dropdown
  const [store, setStore] = React.useState("");
  const stores = ["Downpatrick", "Kilkeel", "Newcastle"];

  // optional email
  const [userEmail, setUserEmail] = React.useState("");

  // KPIs
  const [adt, setAdt] = React.useState<string | number>("");
  const [extPerThousand, setExtPerThousand] = React.useState<string | number>(""); // extremes per 1000
  const [sbr, setSbr] = React.useState<string | number>("");

  // sections
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

  // walkthrough score (/75)
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

  // per-metric points + total service (/25)
  const adtNum = adt === "" ? null : Number(adt);
  const extNum = extPerThousand === "" ? null : Number(extPerThousand);
  const sbrNum = sbr === "" ? null : Number(sbr);

  const adtPts = scoreADT(adtNum);
  const extPts = scoreExtremes(extNum);
  const sbrPts = scoreSBR(sbrNum);

  const serviceTotal =
    (adtPts ?? 0) + (extPts ?? 0) + (sbrPts ?? 0); // if any missing, those count as 0

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
      // payload sections (for DB)
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
          adt: adtNum,                                // minutes
          extreme_lates: extNum,                      // per 1000
          sbr: sbrNum,                                // percent
          service_total: serviceTotal,                // /25 from bands
          predicted,                                  // /100
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
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>🍕 Daily OER Walkthrough</h1>
        <p style={{ margin: "6px 0 0 0", color: "#475569" }}>
          Pick your store, tick the checklist, add ADT / SBR / Extremes (per 1000). Service points are calculated for you.
        </p>
      </header>

      {/* Score bar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#fff",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <Badge label="Walkthrough" value={`${walkthroughScore}/75`} />
        <Badge label="Service" value={`${serviceTotal}/25`} />
        <Badge
          label="Predicted"
          value={`${predicted}/100`}
          strong
          color={colourForPredicted(predicted)}
        />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <small style={{ color: "#6b7280" }}>
            Green ≥85 • Amber ≥70 • Red &lt;70
          </small>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        {/* Store + email */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            Store
            <select
              value={store}
              onChange={(e) => setStore(e.target.value)}
              required
              style={input()}
            >
              <option value="" disabled>Select a store…</option>
              <option>Downpatrick</option>
              <option>Kilkeel</option>
              <option>Newcastle</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Your email (optional)
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="you@company.com"
              style={input()}
            />
          </label>
        </div>

        {/* KPIs per rubric */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            ADT (mins)
            <input
              type="number"
              step="0.01"
              value={adt as number | string}
              onChange={(e) => setAdt(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 26.4"
              style={input()}
            />
            <small style={{ color: "#6b7280" }}>
              Points: {adtPts == null ? "—" : adtPts} / 15
            </small>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            SBR (%)
            <input
              type="number"
              step="0.01"
              value={sbr as number | string}
              onChange={(e) => setSbr(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 78"
              style={input()}
            />
            <small style={{ color: "#6b7280" }}>
              Points: {sbrPts == null ? "—" : sbrPts} / 5
            </small>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Extremes (per 1000 orders)
            <input
              type="number"
              step="0.01"
              value={extPerThousand as number | string}
              onChange={(e) =>
                setExtPerThousand(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="e.g. 18.3"
              style={input()}
            />
            <small style={{ color: "#6b7280" }}>
              Points: {extPts == null ? "—" : extPts} / 5
            </small>
          </label>
        </div>

        {/* Sections */}
        <div style={{ display: "grid", gap: 12 }}>
          {SECTIONS.map((sec) => {
            const state = sections[sec.key];
            const checkedCount = sec.items.filter((i) => state[i.key]).length;
            const secScore = Math.round((checkedCount / sec.items.length) * sec.max);

            return (
              <section
                key={sec.key}
                style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", padding: 12 }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                  <h3 style={{ margin: 0 }}>{sec.title}</h3>
                  <span style={{ fontWeight: 700 }}>{secScore} / {sec.max}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                  {sec.items.map((it) => (
                    <label key={it.key} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 8, border: "1px solid #f1f5f9", borderRadius: 10 }}>
                      <input
                        type="checkbox"
                        checked={!!state[it.key]}
                        onChange={() => toggleItem(sec.key, it.key)}
                        style={{ marginTop: 4 }}
                      />
                      <span>{it.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#006491", color: "white", fontWeight: 700, cursor: "pointer" }}
        >
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

// UI bits
function input(): React.CSSProperties {
  return { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none" };
}
function Badge(props: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: "#f1f5f9",
        border: "1px solid #e5e7eb",
        color: props.color || "#111827",
        fontWeight: props.strong ? 800 : 600,
      }}
    >
      <span style={{ opacity: 0.7 }}>{props.label}</span>
      <span>{props.value}</span>
    </span>
  );
}
