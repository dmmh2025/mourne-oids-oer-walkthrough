"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/supabaseClient";

/**
 * Sections and weights (sum to 75).
 * Score per section = (checked items / total items) * section.points (rounded).
 */
type Item = { label: string; done: boolean };
type Section = { title: string; points: number; items: Item[] };

const SECTIONS: Section[] = [
  {
    title: "Dough Management",
    points: 11, // +1 moved from APP
    items: [
      { label: "Correct dough rotation (FIFO), no out-of-date", done: false },
      { label: "Dough balls correctly tempered / proofed", done: false },
      { label: "Cold chain maintained (walk-in → line)", done: false },
      { label: "Waste recorded / lids on totes / no contamination", done: false },
    ],
  },
  {
    title: "Application (APP)",
    points: 7, // 8 originally, -1 to Dough
    items: [
      { label: "Right sauce, cheese & topping weights used", done: false },
      { label: "Even coverage to the edge / no bare patches", done: false },
      { label: "Correct cutting & portioning in cut table", done: false },
      { label: "Pest control checks complete (log updated)", done: false },
    ],
  },
  {
    title: "Temps",
    points: 6, // increased to 6 incl. cooking temps
    items: [
      { label: "Walk-in temp in range and logged", done: false },
      { label: "Makeline temps in range and logged", done: false },
      { label: "Cooking temps checked & recorded", done: false },
    ],
  },
  {
    title: "Great / Remake Quality",
    points: 22, // increased incl. breaded sides
    items: [
      { label: "Pizza appearance meets brand spec", done: false },
      { label: "Box labels correct / seals applied", done: false },
      { label: "Order completeness checked at hot rack", done: false },
      { label: "Breaded sides cooked correctly (golden, crisp)", done: false },
    ],
  },
  {
    title: "Hygiene & Back of House",
    points: 10,
    items: [
      { label: "Sinks/handwash/saniflow clean & stocked", done: false },
      { label: "Colour-coded cleaning in use", done: false },
      { label: "Waste managed; no build-up in prep areas", done: false },
      { label: "Floors, walls, units clean (no grease)", done: false },
    ],
  },
  {
    title: "CSR / Front of House",
    points: 8,
    items: [
      { label: "Counter clean & clutter-free", done: false },
      { label: "Screens, tablets & printers clean", done: false },
      { label: "Customer area tidy (tables, bins, signage)", done: false },
    ],
  },
  {
    title: "Routing & Delivery",
    points: 6,
    items: [
      { label: "Hot rack organised; proper rotation", done: false },
      { label: "Routes optimised; driver briefed", done: false },
      { label: "Delivery bags clean & heated", done: false },
    ],
  },
  {
    title: "Uniform & Brand Standards",
    points: 5, // renamed + drivers vehicle check
    items: [
      { label: "Team in clean uniform, hats, name badges", done: false },
      { label: "Hand hygiene observed regularly", done: false },
      { label: "Drivers’ vehicles clean & road-safe", done: false },
    ],
  },
];

// ----- Service Scoring (25 points total) -----

function pointsForADT(mins: number) {
  if (mins < 25) return 15;
  if (mins <= 26) return 10;
  if (mins <= 27) return 8;
  if (mins <= 28) return 6;
  if (mins <= 30) return 4;
  return 0;
}

function pointsForSBR(pct: number) {
  if (pct >= 75) return 5;
  if (pct >= 70) return 4;
  if (pct >= 50) return 3;
  return 0;
}

function pointsForExtremes(perThousand: number) {
  if (perThousand <= 15) return 5;
  if (perThousand <= 20) return 4;
  if (perThousand <= 25) return 3;
  if (perThousand <= 30) return 2;
  return 0;
}

// ----- Stars (based on total %) -----
function starsForPercent(p: number) {
  if (p >= 90) return 5;
  if (p >= 80) return 4;
  if (p >= 70) return 3;
  if (p >= 60) return 2;
  if (p >= 50) return 1;
  return 0;
}

// Utility
function clampNum(n: number) {
  return Number.isFinite(n) ? n : 0;
}

export default function WalkthroughPage() {
  const router = useRouter();

  // Details
  const [store, setStore] = React.useState<"Downpatrick" | "Kilkeel" | "Newcastle" | "">("");
  const [name, setName] = React.useState("");

  // Service inputs (strings for inputs -> numbers for calc)
  const [adt, setAdt] = React.useState("");
  const [sbr, setSbr] = React.useState("");
  const [extremes, setExtremes] = React.useState("");

  // Sections state
  const [sections, setSections] = React.useState<Section[]>(
    SECTIONS.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) }))
  );

  // Collapse control (all open initially)
  const [open, setOpen] = React.useState<boolean[]>(SECTIONS.map(() => true));
  function toggleSection(idx: number) {
    setOpen((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  }
  function setAll(val: boolean) {
    setOpen(SECTIONS.map(() => val));
  }

  // Derived: section scores (proportional) and totals
  const sectionScores = React.useMemo(() => {
    return sections.map((s) => {
      const total = s.items.length || 0;
      const done = s.items.filter((i) => i.done).length;
      const pct = total ? done / total : 0;
      return Math.round(pct * s.points);
    });
  }, [sections]);

  const sectionTotal = sectionScores.reduce((a, b) => a + b, 0); // /75
  const adtNum = clampNum(parseFloat(adt));
  const sbrNum = clampNum(parseFloat(sbr));
  const extremesNum = clampNum(parseFloat(extremes));
  const serviceADT = pointsForADT(adtNum);
  const serviceSBR = pointsForSBR(sbrNum);
  const serviceExt = pointsForExtremes(extremesNum);
  const serviceTotal = serviceADT + serviceSBR + serviceExt; // /25

  const predicted = sectionTotal + serviceTotal; // /100
  const stars = starsForPercent(predicted);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!store) {
      alert("Please select a store.");
      return;
    }
    if (!name.trim()) {
      alert("Please enter your name.");
      return;
    }

    try {
      // Save to API (and Supabase) then redirect to success
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store,
          name,
          adt: adtNum,
          sbr: sbrNum,
          extremes: extremesNum,
          sections, // full detail with items + done flags
          section_total: sectionTotal,
          service_total: serviceTotal,
          predicted,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        alert(`Submit failed: ${msg}`);
        return;
      }

      // Success → go to success page (shows banner + grade)
      router.push(
        `/success?store=${encodeURIComponent(store)}&name=${encodeURIComponent(
          name
        )}&predicted=${predicted}&stars=${stars}`
      );
    } catch (err: any) {
      alert(`Submit failed: ${err?.message || "network error"}`);
    }
  }

  return (
    <main>
      {/* Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "12px 0",
          background: "#fff",
          borderBottom: "3px solid #006491",
        }}
      >
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
          style={{ maxWidth: "90%", height: "auto", display: "block" }}
        />
      </div>

      {/* Content */}
      <section className="container" style={{ display: "grid", gap: 16 }}>
        <h1 style={{ fontSize: 22, marginTop: 8 }}>Daily OER Walkthrough</h1>

        {/* Details */}
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          <div className="card" style={{ display: "grid", gap: 8 }}>
            <label style={{ fontWeight: 600 }}>Store</label>
            <select
              value={store}
              onChange={(e) => setStore(e.target.value as any)}
            >
              <option value="">Select a store...</option>
              <option value="Downpatrick">Downpatrick</option>
              <option value="Kilkeel">Kilkeel</option>
              <option value="Newcastle">Newcastle</option>
            </select>

            <label style={{ fontWeight: 600, marginTop: 6 }}>Your Name</label>
            <input
              type="text"
              placeholder="Type your name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Service inputs */}
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <strong>Service Snapshot</strong>

            <div style={{ display: "grid", gap: 6 }}>
              <label>ADT (minutes)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="e.g. 24.75"
                value={adt}
                onChange={(e) => setAdt(e.target.value)}
              />
              <small style={{ color: "var(--muted)" }}>
                Points: {serviceADT} / 15
              </small>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>SBR (%)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="e.g. 82.5"
                value={sbr}
                onChange={(e) => setSbr(e.target.value)}
              />
              <small style={{ color: "var(--muted)" }}>
                Points: {serviceSBR} / 5
              </small>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Extremes (per 1000)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="e.g. 12.5"
                value={extremes}
                onChange={(e) => setExtremes(e.target.value)}
              />
              <small style={{ color: "var(--muted)" }}>
                Points: {serviceExt} / 5
              </small>
            </div>

            <div className="badge" style={{ marginTop: 4 }}>
              Service total: <b style={{ marginLeft: 6 }}>{serviceTotal} / 25</b>
            </div>
          </div>

          {/* Section controls */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setAll(true)}>Expand all</button>
            <button type="button" onClick={() => setAll(false)}>Collapse all</button>
          </div>

          {/* Sections: collapsible, vertical checks */}
          <div style={{ display: "grid", gap: 12 }}>
            {sections.map((sec, si) => {
              const totalItems = sec.items.length;
              const doneItems = sec.items.filter((i) => i.done).length;
              const score = sectionScores[si];

              return (
                <div key={sec.title} className="card" style={{ padding: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: 12,
                      borderBottom: "1px solid var(--softline)",
                      background:
                        doneItems === totalItems && totalItems > 0
                          ? "rgba(0,128,0,.05)"
                          : "#fff",
                    }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong>{sec.title}</strong>
                      <small style={{ color: "var(--muted)" }}>
                        {doneItems}/{totalItems} checks · {score}/{sec.points} pts
                      </small>
                    </div>
                    <button type="button" onClick={() => toggleSection(si)} style={{ fontSize: 13 }}>
                      {open[si] ? "Hide" : "Show"}
                    </button>
                  </div>

                  {open[si] && (
                    <div style={{ padding: 12, display: "grid", gap: 10 }}>
                      {sec.items.map((it, ii) => (
                        <label key={ii} style={{ display: "flex", gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={it.done}
                            onChange={(e) =>
                              setSections((prev) => {
                                const next = [...prev];
                                next[si] = { ...next[si] };
                                next[si].items = [...next[si].items];
                                next[si].items[ii] = {
                                  ...next[si].items[ii],
                                  done: e.target.checked,
                                };
                                return next;
                              })
                            }
                          />
                          <span>{it.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Live totals + star grade */}
          <div className="card" style={{ display: "grid", gap: 8 }}>
            <div>
              <b>Walkthrough total:</b> {sectionTotal}/75
            </div>
            <div>
              <b>Service total:</b> {serviceTotal}/25
            </div>
            <div style={{ fontSize: 18 }}>
              <b>Predicted OER:</b> {predicted}/100 &nbsp;·&nbsp;{" "}
              {"★".repeat(stars)}
              {"☆".repeat(5 - stars)}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="brand" type="submit">Submit & View Report</button>
            <a href="/"><button type="button">Back to Home</button></a>
          </div>
        </form>
      </section>
    </main>
  );
}
