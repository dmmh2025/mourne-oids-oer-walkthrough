"use client";
export const dynamic = "force-dynamic";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

/**
 * SECTION DEFINITIONS
 * Edit labels / items here. Each item is worth equal points within its section.
 * Section max points must sum to 75.
 */
const SECTIONS: {
  key: string;
  title: string;
  max: number; // points for the whole section
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
      { key: "food_safety", label: "Cold-hold <= 5°C" },
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

type SectionState = Record<string, boolean>; // itemKey -> checked

export default function WalkthroughPage() {
  // store + email + KPIs
  const [store, setStore] = React.useState("");
  const [userEmail, setUserEmail] = React.useState("");
  const [adt, setAdt] = React.useState<string | number>("");
  const [xl, setXl] = React.useState<string | number>(""); // extreme lates %
  const [sbr, setSbr] = React.useState<string | number>("");

  // service score (out of 25)
  const [service, setService] = React.useState(0);

  // section states
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

  // compute walkthrough (out of 75) + predicted
  const walkthroughScore = React.useMemo(() => {
    let total = 0;
    for (const sec of SECTIONS) {
      const state = sections[sec.key] || {};
      const checked = sec.items.filter((i) => state[i.key]).length;
      const perItem = sec.max / sec.items.length; // equally weighted
      total += perItem * checked;
    }
    return Math.round(total);
  }, [sections]);

  const predicted = walkthroughScore + Number(service || 0);

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
      setMsg("❌ Please enter your Store.");
      return;
    }

    setSaving(true);
    try {
      // Build compact JSON for DB
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
          sections: payloadSections, // jsonb
          section_total: walkthroughScore,
          adt: adt === "" ? null : Number(adt),
          extreme_lates: xl === "" ? null : Number(xl),
          sbr: sbr === "" ? null : Number(sbr),
          service_total: Number(service || 0),
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
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>🍕 Daily OER Walkthrough</h1>
        <p style={{ margin: "6px 0 0 0", color: "#475569" }}>
          Tick items that are OER-ready. Scoring updates live.
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
        <Badge label="Service" value={`${service}/25`} />
        <Badge
          label="Predicted"
          value={`${predicted}/100`}
          strong
          color={predicted >= 85 ? "#065f46" : predicted >= 70 ? "#92400e" : "#7f1d1d"}
        />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <small style={{ color: "#6b7280" }}>
            Green ≥85 • Amber ≥70 • Red &lt;70
          </small>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        {/* Header fields */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            Store
            <input
              value={store}
              onChange={(e) => setStore(e.target.value)}
              required
              placeholder="Downpatrick / Kilkeel / Newcastle"
              style={input()}
            />
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

        {/* KPI fields */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            ADT (mins)
            <input
              type="number"
              step="0.1"
              value={adt as number | string}
              onChange={(e) =>
                setAdt(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="e.g. 24.2"
              style={input()}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Extreme Lates %
            <input
              type="number"
              step="0.1"
              value={xl as number | string}
              onChange={(e) =>
                setXl(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="e.g. 1.3"
              style={input()}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            SBR %
            <input
              type="number"
              step="0.1"
              value={sbr as number | string}
              onChange={(e) =>
                setSbr(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="e.g. 82"
              style={input()}
            />
          </label>
        </div>

        {/* Service score */}
        <label style={{ display: "grid", gap: 6 }}>
          Service Points (0–25)
          <input
            type="number"
            min={0}
            max={25}
            value={service}
            onChange={(e) => setService(Number(e.target.value))}
            placeholder="e.g. 20"
            style={input()}
          />
        </label>

        {/* Sections */}
        <div style={{ display: "grid", gap: 12 }}>
          {SECTIONS.map((sec) => {
            const state = sections[sec.key];
            const checkedCount = sec.items.filter((i) => state[i.key]).length;
            const secScore = Math.round((checkedCount / sec.items.length) * sec.max);

            return (
              <section
                key={sec.key}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "white",
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    gap: 8,
                  }}
                >
                  <h3 style={{ margin: 0 }}>{sec.title}</h3>
                  <span style={{ fontWeight: 700 }}>
                    {secScore} / {sec.max}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: 10,
                  }}
                >
                  {sec.items.map((it) => (
                    <label
                      key={it.key}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                        padding: 8,
                        border: "1px solid #f1f5f9",
                        borderRadius: 10,
                      }}
                    >
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
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#006491",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {saving ? "Saving…" : "Save Walkthrough"}
        </button>

        {msg && (
          <p
            style={{
              margin: 0,
              color: msg.startsWith("✅") ? "#065f46" : "#7f1d1d",
              fontWeight: 600,
            }}
          >
            {msg}
          </p>
        )}
      </form>
    </main>
  );
}

// Small UI helpers
function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    outline: "none",
  };
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
