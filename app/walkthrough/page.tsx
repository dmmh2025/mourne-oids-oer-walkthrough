"use client";
import * as React from "react";

/**
 * Mourne-oids OER Walkthrough (with Store + Email + Save)
 * - Sections total = 75 pts (capped per section)
 * - Service points = 25 pts (ADT, Extreme Lates %, SBR %)
 * - Predicted OER = 75 + 25 = 100
 * - Includes Store + Email fields; POSTs to /api/submit
 */

type Item = { id: string; label: string; points: number };
type Section = { id: string; title: string; max: number; items: Item[] };

const SECTIONS: Section[] = [
  {
    id: "temps",
    title: "Temps",
    max: 18,
    items: [
      { id: "cooking_temps_ok", label: "Cooking temps within tolerance", points: 3 },
      { id: "holding_temps_ok", label: "Hot & cold holding temps correct", points: 5 },
      { id: "probe_in_use", label: "Probe used & sanitised correctly", points: 5 },
      { id: "records_up_to_date", label: "Records complete & on time", points: 5 },
    ],
  },
  {
    id: "sanitation",
    title: "Sanitation",
    max: 18,
    items: [
      { id: "handwash_stations", label: "Handwash stations stocked & clean", points: 4 },
      { id: "food_contact_surfaces", label: "Food-contact surfaces sanitised", points: 6 },
      { id: "floors_walls_ceiling", label: "Floors/walls/ceilings clean & maintained", points: 4 },
      { id: "waste_management", label: "Waste managed & pest-proofed", points: 4 },
    ],
  },
  {
    id: "uniform",
    title: "Uniform & Appearance",
    max: 8,
    items: [
      { id: "team_uniform_ok", label: "Team in full clean uniform & PPE", points: 4 },
      { id: "driver_vehicle_ok", label: "Driver vehicle clean & in good condition", points: 4 },
    ],
  },
  {
    id: "great_remake",
    title: "Great/Remake Controls",
    max: 16,
    items: [
      { id: "breaded_sides_ok", label: "Breaded sides process followed", points: 4 },
      { id: "make_line_portioning", label: "Correct portioning on make-line", points: 6 },
      { id: "cut_cam_quality", label: "Cut-cam quality within spec (docking/topping)", points: 6 },
    ],
  },
  {
    id: "prp",
    title: "PRP (Pre-Req Programs)",
    max: 15,
    items: [
      { id: "prp_sides", label: "PRP complete incl. sides checks", points: 5 },
      { id: "allergen_control", label: "Allergen control in place (posters, process)", points: 5 },
      { id: "stock_rotation", label: "FIFO/rotation/date labels correct", points: 5 },
    ],
  },
];

// --- Service Points (OER spec ~ 25 total) ---
function scoreService(adtMin: number | "", extremeLatePct: number | "", sbrPct: number | "") {
  // ADT: up to 15 points
  let adtPts = 0;
  if (adtMin !== "" && typeof adtMin === "number") {
    if (adtMin <= 23) adtPts = 15;
    else if (adtMin <= 24) adtPts = 13;
    else if (adtMin <= 25) adtPts = 11;
    else if (adtMin <= 27) adtPts = 8;
    else if (adtMin <= 30) adtPts = 5;
    else adtPts = 0;
  }

  // Extreme lates: <= 1.5% = 5 points
  let xlatePts = 0;
  if (extremeLatePct !== "" && typeof extremeLatePct === "number") {
    if (extremeLatePct <= 1.5) xlatePts = 5;
    else if (extremeLatePct <= 3) xlatePts = 3;
    else xlatePts = 0;
  }

  // SBR: >= 75% = 5 points
  let sbrPts = 0;
  if (sbrPct !== "" && typeof sbrPct === "number") {
    if (sbrPct >= 85) sbrPts = 5;
    else if (sbrPct >= 75) sbrPts = 4;
    else if (sbrPct >= 65) sbrPts = 2;
    else sbrPts = 0;
  }

  return { adtPts, xlatePts, sbrPts, total: adtPts + xlatePts + sbrPts };
}

export default function WalkthroughPage() {
  // NEW: store + email
  const [store, setStore] = React.useState("");
  const [email, setEmail] = React.useState("");

  // Checklist + service inputs
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [adt, setAdt] = React.useState<number | "">("");
  const [extLate, setExtLate] = React.useState<number | "">("");
  const [sbr, setSbr] = React.useState<number | "">("");

  // Save status
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<{ ok?: boolean; id?: string; error?: string }>({});

  // Scoring
  const sectionScores = SECTIONS.map((sec) => {
    const raw = sec.items.reduce((sum, it) => sum + (checked[it.id] ? it.points : 0), 0);
    return { id: sec.id, title: sec.title, raw, max: sec.max, capped: Math.min(raw, sec.max) };
  });
  const walkthroughTotal = sectionScores.reduce((sum, s) => sum + s.capped, 0); // out of 75
  const service = scoreService(adt, extLate, sbr); // out of 25
  const predicted = walkthroughTotal + service.total; // out of 100

  async function handleSave() {
    try {
      setSaving(true);
      setResult({});

      // simple validation
      if (!store) {
        setResult({ error: "Please choose a store." });
        return;
      }
      if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        setResult({ error: "Please enter a valid email or leave it blank." });
        return;
      }

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: checked,
          section_total: walkthroughTotal,
          adt,
          extreme_lates: extLate,
          sbr,
          service_total: service.total,
          predicted,
          store,
          user_email: email || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      setResult({ ok: true, id: data.id });

      // (Optional) reset checkboxes but keep store/email
      // setChecked({});
      // setAdt(""); setExtLate(""); setSbr("");
    } catch (e: any) {
      setResult({ error: e.message || "Error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>🍕 Mourne-oids OER Walkthrough</h1>
      <p style={{ marginTop: 0 }}>
        Tick what’s in place before open; enter service metrics; get a predicted OER score. Save to store results.
      </p>

      {/* NEW: Store + Email */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "16px 0" }}>
        <div>
          <label>Store</label>
          <select
            value={store}
            onChange={(e) => setStore(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          >
            <option value="">— Select store —</option>
            <option value="Downpatrick">Downpatrick</option>
            <option value="Kilkeel">Kilkeel</option>
            <option value="Newcastle">Newcastle</option>
          </select>
        </div>
        <div>
          <label>Your email (for receipt)</label>
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </div>
      </div>

      {SECTIONS.map((sec) => (
        <div key={sec.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, margin: "16px 0" }}>
          <h2 style={{ marginTop: 0 }}>
            {sec.title} <small>({sec.max} pts max)</small>
          </h2>
          {sec.items.map((it) => (
            <label key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
              <input
                type="checkbox"
                checked={!!checked[it.id]}
                onChange={(e) => setChecked((c) => ({ ...c, [it.id]: e.target.checked }))}
              />
              <span>
                {it.label} <em style={{ opacity: 0.6 }}>({it.points} pts)</em>
              </span>
            </label>
          ))}
          <div style={{ fontWeight: 600, marginTop: 8 }}>
            Section score: {sectionScores.find((s) => s.id === sec.id)?.capped} / {sec.max}
          </div>
        </div>
      ))}

      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, margin: "16px 0" }}>
        <h2 style={{ marginTop: 0 }}>Service Points (25 max)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label>ADT (mins)</label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 24.0"
              value={adt}
              onChange={(e) => setAdt(e.target.value === "" ? "" : Number(e.target.value))}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
            <div style={{ fontSize: 12, opacity: 0.7 }}>≤25 = up to 15 pts</div>
          </div>
          <div>
            <label>Extreme Lates %</label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 1.2"
              value={extLate}
              onChange={(e) => setExtLate(e.target.value === "" ? "" : Number(e.target.value))}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
            <div style={{ fontSize: 12, opacity: 0.7 }}>≤1.5% = 5 pts</div>
          </div>
          <div>
            <label>Single Bag Runs %</label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 78"
              value={sbr}
              onChange={(e) => setSbr(e.target.value === "" ? "" : Number(e.target.value))}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
            <div style={{ fontSize: 12, opacity: 0.7 }}>≥75% = 5 pts</div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <strong>Service points:</strong> {service.total} / 25
          <span style={{ opacity: 0.7 }}> (ADT {service.adtPts}, XLates {service.xlatePts}, SBR {service.sbrPts})</span>
        </div>
      </div>

      <div style={{ background: "#f8f8f8", borderRadius: 12, padding: 16 }}>
        <div>
          <strong>Walkthrough total:</strong> {walkthroughTotal} / 75
        </div>
        <div>
          <strong>Predicted OER:</strong> {predicted} / 100
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{ marginTop: 12, padding: "10px 16px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
      >
        {saving ? "Saving…" : "Save to Supabase"}
      </button>

      {!!result.ok && <p style={{ color: "green" }}>Saved ✅ (ID: {result.id})</p>}
      {!!result.error && <p style={{ color: "crimson" }}>Error: {result.error}</p>}

      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        MVP note: no login yet; submissions are open insert-only. We’ll lock down by user/store next.
      </p>
    </div>
  );
}
