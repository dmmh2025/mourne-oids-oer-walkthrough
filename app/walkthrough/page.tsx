"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

// SECTION DEFINITIONS
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

export default function WalkthroughPage() {
  const [sections, setSections] = React.useState<Record<string, Record<string, boolean>>>({});
  const [store, setStore] = React.useState("");
  const [userEmail, setUserEmail] = React.useState("");
  const [adt, setAdt] = React.useState("");
  const [sbr, setSbr] = React.useState("");
  const [extremes, setExtremes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  // Handle section toggles
  function toggle(sectionKey: string, itemKey: string) {
    setSections((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        [itemKey]: !prev[sectionKey]?.[itemKey],
      },
    }));
  }

  // Calculate scores
  const walkthroughScore = React.useMemo(() => {
    return SECTIONS.reduce((sum, sec) => {
      const checkedCount = Object.values(sections[sec.key] || {}).filter(Boolean).length;
      const ratio = checkedCount / sec.items.length;
      return sum + Math.round(sec.max * ratio);
    }, 0);
  }, [sections]);

  const adtNum = parseFloat(adt) || 0;
  const sbrNum = parseFloat(sbr) || 0;
  const extNum = parseFloat(extremes) || 0;

  // SERVICE POINTS
  const adtPoints =
    adtNum > 30 ? 0 :
    adtNum > 28 ? 4 :
    adtNum > 27 ? 6 :
    adtNum > 26 ? 8 :
    adtNum > 25 ? 10 : 15;

  const sbrPoints =
    sbrNum < 50 ? 0 :
    sbrNum < 70 ? 3 :
    sbrNum < 75 ? 4 : 5;

  const extremePoints =
    extNum > 30 ? 0 :
    extNum > 25 ? 2 :
    extNum > 20 ? 3 :
    extNum > 15 ? 4 : 5;

  const serviceTotal = adtPoints + sbrPoints + extremePoints;
  const predicted = walkthroughScore + serviceTotal;

  // ✅ SUBMIT + REDIRECT TO SUCCESS
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

      // ✅ Redirect to success page
      setMsg("✅ Walkthrough saved! Redirecting…");
      const params = new URLSearchParams({
        store,
        predicted: String(predicted),
        walkthrough: String(walkthroughScore),
        service: String(serviceTotal),
      }).toString();

      setTimeout(() => {
        window.location.href = `/success?${params}`;
      }, 1000);
    } catch (err: any) {
      setMsg(`❌ ${err.message || "Failed to save"}`);
    } finally {
      setSaving(false);
    }
  }

  // RENDER
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <h1 style={{ textAlign: "center" }}>Daily OER Walkthrough</h1>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label>
            Store:
            <select value={store} onChange={(e) => setStore(e.target.value)} style={{ marginLeft: 8, padding: 6 }}>
              <option value="">Select Store</option>
              <option value="Downpatrick">Downpatrick</option>
              <option value="Kilkeel">Kilkeel</option>
              <option value="Newcastle">Newcastle</option>
            </select>
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>
            Your Email:
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              style={{ marginLeft: 8, padding: 6, width: 260 }}
            />
          </label>
        </div>

        {SECTIONS.map((sec) => (
          <div key={sec.key} style={{ marginBottom: 20, border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            <h3>{sec.title}</h3>
            {sec.items.map((i) => (
              <label key={i.key} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  checked={!!sections[sec.key]?.[i.key]}
                  onChange={() => toggle(sec.key, i.key)}
                />{" "}
                {i.label}
              </label>
            ))}
          </div>
        ))}

        <h3>Service Metrics</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <label>
            ADT (mins): <input type="number" value={adt} onChange={(e) => setAdt(e.target.value)} style={{ width: 80 }} />
          </label>
          <label>
            SBR (%): <input type="number" value={sbr} onChange={(e) => setSbr(e.target.value)} style={{ width: 80 }} />
          </label>
          <label>
            Extremes (/1000): <input type="number" value={extremes} onChange={(e) => setExtremes(e.target.value)} style={{ width: 80 }} />
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <strong>Walkthrough:</strong> {walkthroughScore}/75 |{" "}
          <strong>Service:</strong> {serviceTotal}/25 |{" "}
          <strong>Predicted:</strong> {predicted}/100
        </div>

        {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: 20,
            background: "#006491",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {saving ? "Saving..." : "Save Walkthrough"}
        </button>
      </form>
    </main>
  );
}
