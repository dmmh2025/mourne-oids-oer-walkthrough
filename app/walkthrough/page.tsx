"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase client ----
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

// ---------- Types ----------
type Item = { key: string; label: string; pts?: number };
type Section =
  | { key: string; title: string; max: number; items: Item[]; mode?: "normal" }
  | { key: "product_quality"; title: string; max: number; items: Item[]; mode: "all_or_nothing" };

type SectionState = Record<string, boolean>;

// ---------- Service scoring (unchanged) ----------
function scoreADT(n: number | null) {
  if (n == null || Number.isNaN(n)) return null;
  if (n > 30) return 0;
  if (n > 28) return 4;
  if (n > 27) return 6;
  if (n > 26) return 8;
  if (n > 25) return 10;
  return 15;
}
function scoreSBR(n: number | null) {
  if (n == null || Number.isNaN(n)) return null;
  if (n < 50) return 0;
  if (n < 70) return 3;
  if (n < 75) return 4;
  return 5;
}
function scoreExtremes(n: number | null) {
  if (n == null || Number.isNaN(n)) return null;
  if (n > 30) return 0;
  if (n > 25) return 2;
  if (n > 20) return 3;
  if (n > 15) return 4;
  return 5;
}
function starsForPercent(p: number) {
  if (p >= 90) return 5;
  if (p >= 80) return 4;
  if (p >= 70) return 3;
  if (p >= 60) return 2;
  if (p >= 50) return 1;
  return 0;
}

// ---------- New Sections & Points (total walkthrough = 75) ----------
// NOTE: We’ve set explicit weights per item to match your totals.
// If any weight differs from your doc, tell me which item and I’ll adjust the pts value.
const SECTIONS: Section[] = [
  // 1) FOOD SAFETY — 18 pts (6 × 3 pts)
  {
    key: "food_safety",
    title: "Food Safety",
    max: 18,
    mode: "normal",
    items: [
      { key: "temps_in_range", label: "Temps entered on time and within range", pts: 3 },
      { key: "within_shelf_life", label: "Products within shelf life", pts: 3 },
      { key: "proper_handwashing", label: "Proper handwashing", pts: 3 },
      { key: "sanitation_followed", label: "Sanitation procedures followed", pts: 3 },
      { key: "proper_cooking_temps", label: "Proper cooking temps", pts: 3 },
      { key: "pest_control_service", label: "4–6 week pest control service in place", pts: 3 },
    ],
  },
  // 2) PRODUCT — 12 pts (weights per your breakdown: 5+2+2+1+2)
  {
    key: "product",
    title: "Product",
    max: 12,
    mode: "normal",
    items: [
      { key: "dough_managed", label: "Dough properly managed", pts: 5 },
      { key: "bread_prepped", label: "Bread products properly prepared", pts: 2 },
      { key: "app", label: "Approved Products & Procedures (APP)", pts: 2 },
      { key: "sides_prepped", label: "All sides properly prepared", pts: 1 },
      { key: "prp_adequate", label: "Adequate PRP", pts: 2 },
    ],
  },
  // 3) IMAGE — 20 pts (weights chosen to total 20 neatly for mobile; tweakable)
  {
    key: "image",
    title: "Image",
    max: 20,
    mode: "normal",
    items: [
      { key: "uniform", label: "Team in proper uniform", pts: 3 },
      { key: "grooming", label: "Grooming standards", pts: 1 },
      { key: "store_interior", label: "Store interior clean", pts: 2 },
      { key: "customer_view", label: "Customer area and view", pts: 2 },
      { key: "outside", label: "Outside", pts: 2 },
      { key: "baking_equipment", label: "Baking Equipment", pts: 3 },
      { key: "delivery_bags", label: "Delivery bags", pts: 2 },
      { key: "signage_menu", label: "Signage & Menu", pts: 1 },
      { key: "walk_in_clean", label: "Walk-in clean", pts: 1 },
      { key: "makeline_clean", label: "Makeline clean", pts: 1 },
      { key: "delivery_vehicles", label: "Delivery vehicles", pts: 2 },
    ],
  },
  // 4) SAFETY & SECURITY — 5 pts (5 × 1 pt)
  {
    key: "safety_security",
    title: "Safety & Security",
    max: 5,
    mode: "normal",
    items: [
      { key: "drivers_cash_drops", label: "Drivers making cash drops", pts: 1 },
      { key: "caller_id_working", label: "Caller ID working", pts: 1 },
      { key: "safe_secure", label: "Safe secure", pts: 1 },
      { key: "till_under_100", label: "Till < £100", pts: 1 },
      { key: "drivers_safe", label: "Drivers safe", pts: 1 },
    ],
  },
  // 5) PRODUCT QUALITY — 20 pts (ALL OR NOTHING)
  {
    key: "product_quality",
    title: "Product Quality",
    max: 20,
    mode: "all_or_nothing",
    items: [
      { key: "rim", label: "RIM" },
      { key: "rise", label: "RISE" },
      { key: "size", label: "SIZE" },
      { key: "portion", label: "PORTION" },
      { key: "placement", label: "PLACEMENT" },
      { key: "bake", label: "BAKE" },
      { key: "bacon_check", label: "Bacon check" },
      { key: "no_sauce_cheese_crust", label: "No sauce & cheese on crust" },
    ],
  },
];

const STORAGE_KEY = "oer_walkthrough_v2";

// ---------- Page ----------
export default function WalkthroughPage() {
  // Store + Name
  const [store, setStore] = React.useState("");
  const [userName, setUserName] = React.useState("");
  const stores = ["Downpatrick", "Kilkeel", "Newcastle"];

  // KPIs
  const [adt, setAdt] = React.useState<string | number>("");
  const [extPerThousand, setExtPerThousand] = React.useState<string | number>("");
  const [sbr, setSbr] = React.useState<string | number>("");

  // Sections state
  const [sections, setSections] = React.useState<Record<string, SectionState>>(
    () =>
      Object.fromEntries(
        SECTIONS.map((sec) => [
          sec.key,
          Object.fromEntries(sec.items.map((i) => [i.key, false])),
        ])
      )
  );

  // UI
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(SECTIONS.map((s) => [s.key, true]))
  );
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  // Load autosave
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft) return;
      setStore(draft.store ?? "");
      setUserName(draft.userName ?? "");
      setAdt(draft.adt ?? "");
      setExtPerThousand(draft.extPerThousand ?? "");
      setSbr(draft.sbr ?? "");
      if (draft.sections) setSections(draft.sections);
    } catch {}
  }, []);

  // Persist autosave
  React.useEffect(() => {
    const payload = { store, userName, adt, extPerThousand, sbr, sections };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [store, userName, adt, extPerThousand, sbr, sections]);

  // Compute walkthrough score (/75)
  const walkthroughScore = React.useMemo(() => {
    let total = 0;

    for (const sec of SECTIONS) {
      const st = sections[sec.key] || {};
      const checked = sec.items.filter((i) => st[i.key]).map((i) => i.key);

      if (sec.key === "product_quality" && sec.mode === "all_or_nothing") {
        // All-or-nothing: all must be checked to earn 20, else 0
        const allChecked = sec.items.every((i) => !!st[i.key]);
        total += allChecked ? sec.max : 0;
      } else {
        // Sum explicit item weights (pts)
        const secPoints = sec.items
          .filter((i) => st[i.key])
          .reduce((sum, i) => sum + (i.pts ?? 0), 0);
        // clamp (safety)
        total += Math.min(secPoints, sec.max);
      }
    }
    return total;
  }, [sections]);

  // Service score (/25)
  const adtNum = adt === "" ? null : Number(adt);
  const extNum = extPerThousand === "" ? null : Number(extPerThousand);
  const sbrNum = sbr === "" ? null : Number(sbr);

  const adtPts = scoreADT(adtNum) ?? 0;
  const extPts = scoreExtremes(extNum) ?? 0;
  const sbrPts = scoreSBR(sbrNum) ?? 0;
  const serviceTotal = adtPts + extPts + sbrPts;

  // Predicted + stars
  const predicted = walkthroughScore + serviceTotal;
  const stars = starsForPercent(predicted);

  // Handlers
  function toggleItem(sectionKey: string, itemKey: string) {
    setSections((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], [itemKey]: !prev[sectionKey][itemKey] },
    }));
  }
  function setAllInSection(sectionKey: string, value: boolean) {
    const sec = SECTIONS.find((s) => s.key === sectionKey);
    if (!sec) return;
    setSections((prev) => ({
      ...prev,
      [sectionKey]: Object.fromEntries(sec.items.map((i) => [i.key, value])),
    }));
  }
  function expandAll(v: boolean) {
    setExpanded(Object.fromEntries(SECTIONS.map((s) => [s.key, v])));
  }
  function resetForm() {
    setSections(
      Object.fromEntries(
        SECTIONS.map((sec) => [
          sec.key,
          Object.fromEntries(sec.items.map((i) => [i.key, false])),
        ])
      )
    );
    setAdt("");
    setExtPerThousand("");
    setSbr("");
    setMsg(null);
  }

  // Submit -> Supabase -> redirect
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
    if (!userName.trim()) {
      setMsg("❌ Please enter your name.");
      return;
    }

    setSaving(true);
    try {
      const payloadSections = SECTIONS.map((sec) => ({
        key: sec.key,
        title: sec.title,
        max: sec.max,
        mode: sec.key === "product_quality" ? "all_or_nothing" : "normal",
        items: sec.items.map((i) => ({
          key: i.key,
          label: i.label,
          pts: i.pts ?? null,
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
          user_name: userName || null,
        },
      ]);
      if (error) throw error;

      setMsg("✅ Walkthrough saved! Redirecting…");

      // clear draft
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}

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
    <>
      <main style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
        {/* Banner with Domino's blue underline */}
        <div
          style={{
            borderBottom: "4px solid #006491",
            marginBottom: 12,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 6px 18px rgba(0,0,0,.06)",
          }}
        >
          <img
            src="/mourneoids_forms_header_1600x400.png"
            alt="Mourne-oids Header Banner"
            style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
          />
        </div>

        {/* Sticky score bar */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "white",
            paddingBottom: 8,
            marginBottom: 12,
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div
            className="stickybar"
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
              boxShadow: "0 2px 10px rgba(0,0,0,.04)",
              flexWrap: "wrap",
            }}
          >
            <Badge label="Walkthrough" value={`${walkthroughScore}/75`} />
            <Badge label="Service" value={`${serviceTotal}/25`} />
            <Badge label="Predicted" value={`${predicted}/100`} strong />
            <Badge label="Grade" value={`${"★".repeat(stars)}${"☆".repeat(5 - stars)} (${stars}-Star)`} strong />
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <small style={{ color: "#6b7280" }}>
                90%+ = 5★ • 80–89.99% = 4★ • 70–79.99% = 3★ • 60–69.99% = 2★ • 50–59.99% = 1★ • &lt;50% = 0★
              </small>
              <button onClick={() => expandAll(true)} type="button" style={ghostBtn()}>Expand all</button>
              <button onClick={() => expandAll(false)} type="button" style={ghostBtn()}>Collapse all</button>
            </div>
          </div>
        </div>

        <header style={{ marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>Daily OER Walkthrough</h1>
          <p style={{ margin: "6px 0 0 0", color: "#475569" }}>
            Tick each checklist. Add your ADT / SBR / Extremes to auto-calc Service points.
          </p>
        </header>

        {/* Form */}
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          {/* Store + Name (stacked on mobile via CSS) */}
          <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              Store
              <select value={store} onChange={(e) => setStore(e.target.value)} required style={input()}>
                <option value="" disabled>Select a store…</option>
                {["Downpatrick", "Kilkeel", "Newcastle"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Your Name
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                required
                style={input()}
              />
            </label>
          </div>

          {/* KPIs */}
          <div className="three-col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
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
              <small style={{ color: "#6b7280" }}>Points: {(scoreADT(adt === "" ? null : Number(adt)) ?? 0)} / 15</small>
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
              <small style={{ color: "#6b7280" }}>Points: {(scoreSBR(sbr === "" ? null : Number(sbr)) ?? 0)} / 5</small>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Extremes (per 1000 orders)
              <input
                type="number"
                step="0.01"
                value={extPerThousand as number | string}
                onChange={(e) => setExtPerThousand(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 18.3"
                style={input()}
              />
              <small style={{ color: "#6b7280" }}>Points: {(scoreExtremes(extPerThousand === "" ? null : Number(extPerThousand)) ?? 0)} / 5</small>
            </label>
          </div>

          {/* Sections (collapsible, items vertical) */}
          <div style={{ display: "grid", gap: 12 }}>
            {SECTIONS.map((sec) => {
              const state = sections[sec.key];
              const totalItems = sec.items.length;
              const checkedCount = sec.items.filter((i) => state[i.key]).length;

              // Section score preview
              let secScore = 0;
              if (sec.key === "product_quality" && sec.mode === "all_or_nothing") {
                secScore = checkedCount === totalItems ? sec.max : 0;
              } else {
                secScore = sec.items.reduce((sum, it) => sum + ((state[it.key] ? (it.pts ?? 0) : 0)), 0);
                if (secScore > sec.max) secScore = sec.max;
              }
              const pct = Math.round((checkedCount / totalItems) * 100);

              return (
                <section key={sec.key} style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white" }}>
                  {/* Header */}
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [sec.key]: !p[sec.key] }))}
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 12,
                      background: "white",
                      border: "none",
                      borderBottom: expanded[sec.key] ? "1px solid #eef2f7" : "none",
                      borderRadius: "12px 12px 0 0",
                      cursor: "pointer",
                    }}
                    aria-expanded={expanded[sec.key] ? "true" : "false"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 18 }}>{expanded[sec.key] ? "▾" : "▸"}</span>
                      <h3 style={{ margin: 0, fontSize: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sec.title}
                      </h3>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="progress" style={{ width: 160, height: 8, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "#0ea5e9" }} />
                      </div>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{checkedCount}/{totalItems}</span>
                      <span style={{ fontWeight: 700 }}>{secScore} / {sec.max}</span>
                    </div>
                  </button>

                  {/* Body */}
                  {expanded[sec.key] && (
                    <div style={{ padding: 12 }}>
                      {/* quick actions */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => setAllInSection(sec.key, true)} style={ghostBtn()}>Check all</button>
                        <button type="button" onClick={() => setAllInSection(sec.key, false)} style={ghostBtn()}>Clear all</button>
                      </div>

                      {/* Items as a single vertical column (mobile-friendly) */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                        {sec.items.map((it) => (
                          <label key={it.key} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 10, border: "1px solid #f1f5f9", borderRadius: 10 }}>
                            <input
                              type="checkbox"
                              checked={!!state?.[it.key]}
                              onChange={() => toggleItem(sec.key, it.key)}
                              style={{ marginTop: 4 }}
                            />
                            <div style={{ display: "grid", gap: 2 }}>
                              <span>{it.label}</span>
                              {"pts" in it && it.pts !== undefined && (
                                <small style={{ color: "#6b7280" }}>{it.pts} pts</small>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* Actions */}
          <div className="actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid #004e73",
                background: "#006491",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {saving ? "Saving…" : "Save Walkthrough"}
            </button>
            <button type="button" onClick={resetForm} style={ghostBtn()}>
              Reset form
            </button>
            {msg && (
              <span style={{ marginLeft: "auto", color: msg.startsWith("✅") ? "#065f46" : "#7f1d1d", fontWeight: 600 }}>
                {msg}
              </span>
            )}
          </div>
        </form>
      </main>

      {/* Mobile tweaks */}
      <style jsx global>{`
        @media (max-width: 640px) {
          main { padding: 12px; }
          .two-col { grid-template-columns: 1fr !important; }
          .three-col { grid-template-columns: 1fr !important; }
          .actions { flex-direction: column; align-items: stretch; }
          .actions button { width: 100%; }
          .progress { width: 120px !important; }
          .stickybar small { display: block; width: 100%; margin-top: 6px; }
          input, select, textarea { font-size: 16px; } /* prevent iOS zoom */
          label { gap: 4px !important; }
        }
      `}</style>
    </>
  );
}

// ---------- UI helpers ----------
function input(): React.CSSProperties {
  return { width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none" };
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
function ghostBtn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "white",
    color: "#111827",
    fontWeight: 700,
    cursor: "pointer",
  };
}
