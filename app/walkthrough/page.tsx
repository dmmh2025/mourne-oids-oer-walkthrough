"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

// ===== Walkthrough SECTIONS (example set you’re using now; keep/edit as needed) =====
const SECTIONS = [
  {
    key: "temps",
    title: "Temperatures (6 points)",
    max: 6,
    items: [
      { key: "fridge", label: "All fridges within range" },
      { key: "freezer", label: "All freezers within range" },
      { key: "cooking", label: "Cooking temps within tolerance" },
    ],
  },
  {
    key: "app",
    title: "Appearance & Pest Control (8 points)",
    max: 8,
    items: [
      { key: "clean", label: "Store clean & tidy" },
      { key: "bins", label: "Bins clean & emptied" },
      { key: "pest", label: "Pest control log up to date" },
    ],
  },
  {
    key: "dough",
    title: "Dough Management (6 points)",
    max: 6,
    items: [
      { key: "rotation", label: "Correct rotation and dating" },
      { key: "proof", label: "Proofing dough correctly" },
      { key: "doughplan", label: "Dough plan followed" },
    ],
  },
  {
    key: "greatremake",
    title: "Great/Remake & Breaded Sides (22 points)",
    max: 22,
    items: [
      { key: "cutcam", label: "Cut cam in use" },
      { key: "quality", label: "Pizza quality standards met" },
      { key: "breaded", label: "Breaded sides checked and correct" },
    ],
  },
  {
    key: "uniform",
    title: "Uniform & Brand Standards (5 points)",
    max: 5,
    items: [
      { key: "uniform", label: "Uniform clean and correct" },
      { key: "vehicle", label: "Drivers vehicle clean and branded" },
    ],
  },
  {
    key: "sanitation",
    title: "Sanitation & Cleanliness (10 points)",
    max: 10,
    items: [
      { key: "surfaces", label: "Food contact surfaces sanitised" },
      { key: "handwash", label: "Handwash stations stocked" },
      { key: "toilets", label: "Toilets clean and stocked" },
      { key: "equipment", label: "Equipment clean and stored" },
    ],
  },
  {
    key: "prp",
    title: "PRP & Checklists (18 points)",
    max: 18,
    items: [
      { key: "checklist", label: "DomFD checklist complete" },
      { key: "sides", label: "Sides & dips prepped correctly" },
      { key: "training", label: "Training logs up to date" },
    ],
  },
];

// ===== Service scoring (your bands) =====
// ADT (mins) → 15 max
function scoreADT(n: number) {
  if (n > 30) return 0;
  if (n > 28) return 4;
  if (n > 27) return 6;
  if (n > 26) return 8;
  if (n > 25) return 10;
  return 15;
}
// SBR (%) → 5 max
function scoreSBR(n: number) {
  if (n < 50) return 0;
  if (n < 70) return 3;
  if (n < 75) return 4;
  return 5;
}
// Extremes (/1000) → 5 max
function scoreExtremes(n: number) {
  if (n > 30) return 0;
  if (n > 25) return 2;
  if (n > 20) return 3;
  if (n > 15) return 4;
  return 5;
}

// Star grading based on overall % (Predicted /100)
function starsForPercent(p: number) {
  if (p >= 90) return 5;
  if (p >= 80) return 4;
  if (p >= 70) return 3;
  if (p >= 60) return 2;
  if (p >= 50) return 1;
  return 0;
}

export default function WalkthroughPage() {
  const [sections, setSections] = React.useState<Record<string, Record<string, boolean>>>({});
  const [store, setStore] = React.useState("");
  const [userEmail, setUserEmail] = React.useState("");

  const [adt, setAdt] = React.useState("");
  const [sbr, setSbr] = React.useState("");
  const [extremes, setExtremes] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  // Toggle items
  function toggle(sectionKey: string, itemKey: string) {
    setSections((prev) => ({
      ...prev,
      [sectionKey]: { ...(prev[sectionKey] || {}), [itemKey]: !prev[sectionKey]?.[itemKey] },
    }));
  }

  // Walkthrough (/75)
  const walkthroughScore = React.useMemo(() => {
    return SECTIONS.reduce((sum, sec) => {
      const checked = Object.values(sections[sec.key] || {}).filter(Boolean).length;
      const ratio = checked / sec.items.length;
      return sum + Math.round(sec.max * ratio);
    }, 0);
  }, [sections]);

  // Service (/25)
  const adtNum = adt === "" ? NaN : Number(adt);
  const sbrNum = sbr === "" ? NaN : Number(sbr);
  const extNum = extremes === "" ? NaN : Number(extremes);

  const adtPts = Number.isNaN(adtNum) ? 0 : scoreADT(adtNum);
  const sbrPts = Number.isNaN(sbrNum) ? 0 : scoreSBR(sbrNum);
  const extPts = Number.isNaN(extNum) ? 0 : scoreExtremes(extNum);

  const serviceTotal = adtPts + sbrPts + extPts;

  // Predicted (/100) + stars
  const predicted = walkthroughScore + serviceTotal;
  const starCount = starsForPercent(predicted);

  // Submit → save + redirect to /success
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
          adt: Number.isNaN(adtNum) ? null : adtNum,
          extreme_lates: Number.isNaN(extNum) ? null : extNum,
          sbr: Number.isNaN(sbrNum) ? null : sbrNum,
          service_total: serviceTotal,
          predicted,
          store,
          user_email: userEmail || null,
        },
      ]);
      if (error) throw error;

      setMsg("✅ Walkthrough saved! Redirecting…");
      const params = new URLSearchParams({
        store,
        predicted: String(predicted),
        walkthrough: String(walkthroughScore),
        service: String(serviceTotal),
      }).toString();
      setTimeout(() => (window.location.href = `/success?${params}`), 900);
    } catch (err: any) {
      setMsg(`❌ ${err.message || "Failed to save"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: 20 }}>
      {/* Banner (optional – add if you want it on this page too)
      <div style={{ marginBottom: 12 }}>
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids OER" style={{ width: "100%", height: "auto", borderRadius: 12 }} />
      </div> */}

      <header style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Daily OER Walkthrough</h1>
        <p style={{ margin: "6px 0 0 0", color: "#475569" }}>
          Pick your store, tick the checklist, add ADT / SBR / Extremes (/1000). Service points are calculated for you.
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
        <Badge label="Predicted" value={`${predicted}/100`} strong />
        <Badge
          label="Grade"
          value={`${"★".repeat(starCount)}${"☆".repeat(5 - starCount)} (${starCount}-Star)`}
          strong
        />

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {/* New star legend (replaces Green/Amber/Red) */}
          <small style={{ color: "#6b7280" }}>
            90%+ = 5★ • 80–89.99% = 4★ • 70–79.99% = 3★ • 60–69.99% = 2★ • 50–59.99% = 1★ • &lt;50% = 0★
          </small>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={submit}>
        {/* Store + email */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            Store
            <select value={store} onChange={(e) => setStore(e.target.value)} required style={input()}>
              <option value="">Select Store…</option>
              <option value="Downpatrick">Downpatrick</option>
              <option value="Kilkeel">Kilkeel</option>
              <option value="Newcastle">Newcastle</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Your Email (optional)
            <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="you@company.com" style={input()} />
          </label>
        </div>

        {/* Sections */}
        {SECTIONS.map((sec) => (
          <section key={sec.key} style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", padding: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>{sec.title}</h3>
              {/* live per-section score */}
              <span style={{ fontWeight: 700 }}>
                {Math.round(
                  ((Object.values(sections[sec.key] || {}).filter(Boolean).length || 0) / sec.items.length) * sec.max
                )}{" "}
                / {sec.max}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              {sec.items.map((i) => (
                <label key={i.key} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input
                    type="checkbox"
                    checked={!!sections[sec.key]?.[i.key]}
                    onChange={() => toggle(sec.key, i.key)}
                    style={{ marginTop: 4 }}
                  />
                  <span>{i.label}</span>
                </label>
              ))}
            </div>
          </section>
        ))}

        {/* Service metrics */}
        <h3>Service Metrics</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <label>
            ADT (mins):{" "}
            <input type="number" value={adt} onChange={(e) => setAdt(e.target.value)} style={{ width: 90, padding: 6, marginLeft: 6 }} />
          </label>
          <label>
            SBR (%):{" "}
            <input type="number" value={sbr} onChange={(e) => setSbr(e.target.value)} style={{ width: 90, padding: 6, marginLeft: 6 }} />
          </label>
          <label>
            Extremes (/1000):{" "}
            <input
              type="number"
              value={extremes}
              onChange={(e) => setExtremes(e.target.value)}
              style={{ width: 110, padding: 6, marginLeft: 6 }}
            />
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <strong>Walkthrough:</strong> {walkthroughScore}/75 &nbsp;|&nbsp;
          <strong>Service:</strong> {serviceTotal}/25 &nbsp;|&nbsp;
          <strong>Predicted:</strong> {predicted}/100 &nbsp;|&nbsp;
          <strong>Grade:</strong> {"★".repeat(starCount)}
          {"☆".repeat(5 - starCount)} ({starCount}-Star)
        </div>

        {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: 16,
            background: "#006491",
            color: "white",
            border: "1px solid #004e73",
            padding: "10px 16px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          {saving ? "Saving..." : "Save Walkthrough"}
        </button>
      </form>
    </main>
  );
}

// UI helpers
function input(): React.CSSProperties {
  return { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none" };
}
function Badge(props: { label: string; value: string; strong?: boolean }) {
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
        color: "#111827",
        fontWeight: props.strong ? 800 : 600,
      }}
    >
      <span style={{ opacity: 0.7 }}>{props.label}</span>
      <span>{props.value}</span>
    </span>
  );
}
