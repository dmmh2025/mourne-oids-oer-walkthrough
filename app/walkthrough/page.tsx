"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { OSA_STANDARDS_CHECKLIST } from "@/lib/osa-standards-checklist";

/**
 * This page intentionally preserves the legacy Mourne-oids walkthrough UI shell
 * (banner, sticky bar, typography, buttons, spacing, colours).
 * Only the inner content is replaced with the OSA Standards tick-only checklist.
 */

type Store = "" | "Downpatrick" | "Kilkeel" | "Newcastle" | "Ballynahinch";
type WalkthroughType = "pre_open" | "handover";

export default function WalkthroughPage() {
  const router = useRouter();

  // Details
  const [store, setStore] = React.useState<Store>("");
  const [name, setName] = React.useState("");
  const [walkthroughType, setWalkthroughType] = React.useState<WalkthroughType>("pre_open");

  // Collapsible sections (default open)
  const [open, setOpen] = React.useState<boolean[]>(
    () => OSA_STANDARDS_CHECKLIST.map(() => true)
  );
  const toggleSection = (idx: number) =>
    setOpen((prev) => prev.map((o, i) => (i === idx ? !o : o)));
  const setAll = (val: boolean) => setOpen(OSA_STANDARDS_CHECKLIST.map(() => val));

  // Tick state: key = `${sectionId}:${itemIndex}`
  const [ticks, setTicks] = React.useState<Record<string, boolean>>({});

  const allKeys = React.useMemo(() => {
    const keys: string[] = [];
    for (const section of OSA_STANDARDS_CHECKLIST) {
      section.items.forEach((_, idx) => keys.push(`${section.id}:${idx}`));
    }
    return keys;
  }, []);

  const totalChecks = allKeys.length;

  const doneChecks = React.useMemo(() => {
    let n = 0;
    for (const k of allKeys) if (ticks[k] === true) n += 1;
    return n;
  }, [allKeys, ticks]);

  const allComplete = React.useMemo(() => {
    if (!store) return false;
    if (!name.trim()) return false;
    if (!walkthroughType) return false;
    return doneChecks === totalChecks && totalChecks > 0;
  }, [store, name, walkthroughType, doneChecks, totalChecks]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (!store) return alert("Please select a store.");
      if (!name.trim()) return alert("Please enter your name.");
      if (!walkthroughType) return alert("Please select Pre-Open or Handover.");

      if (doneChecks !== totalChecks) {
        return alert("Please complete every checklist item before submitting.");
      }

      // Build a structured payload grouped by section
      const sectionsPayload = OSA_STANDARDS_CHECKLIST.map((sec) => ({
        id: sec.id,
        title: sec.title,
        items: sec.items.map((label, idx) => ({
          label,
          done: ticks[`${sec.id}:${idx}`] === true,
        })),
      }));

      const res = await fetch("/api/osa-standards/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store,
          completedBy: name.trim(),
          walkthroughType, // "pre_open" | "handover"
          sections: sectionsPayload,
          completedAt: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        alert(`Submit failed: ${msg || res.statusText}`);
        return;
      }

      // Keep UX simple: return to hub (or you can route to /success if you prefer)
      router.push("/hub");
    } catch (err: any) {
      alert(`Submit error: ${err?.message || String(err)}`);
    }
  }

  /* ---------- UI (legacy shell preserved) ---------- */
  return (
    <main className="wrap">
      {/* Top sticky bar */}
      <div className="sticky">
        <div className="sticky__inner">
          <div className="sticky__left">
            <span className="chip chip--blue">
              Checks {doneChecks}/{totalChecks}
            </span>
            <span className="chip chip--teal">
              Type {walkthroughType === "pre_open" ? "Pre-Open" : "Handover"}
            </span>
            <span className={`chip ${allComplete ? "chip--green" : "chip--grey"}`}>
              {allComplete ? "Ready to submit" : "In progress"}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn--ghost" onClick={() => router.back()}>
              Back
            </button>
            <a href="/" className="btn btn--ghost">
              Home
            </a>
          </div>
        </div>
      </div>

      {/* Banner */}
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <section className="container">
        <h1>OSA Standards Walkthrough</h1>

        {/* Quick note */}
        <div className="legend card">
          <div className="legend__row">
            <span className="legend__stars">
              Tick every item. Submit twice daily: <b>Pre-Open</b> and <b>Handover</b>.
            </span>
          </div>
        </div>

        {/* THE FORM */}
        <form id="walkForm" onSubmit={onSubmit} className="stack">
          {/* ---- TOP SUBMIT ---- */}
          <div className="inlineSubmitTop">
            <button
              type="button"
              className="btn btn--brand btn--lg"
              onClick={() =>
                (document.getElementById("walkForm") as HTMLFormElement | null)?.requestSubmit()
              }
            >
              Submit Walkthrough
            </button>
          </div>

          {/* Details */}
          <div className="card card--raised">
            <div className="grid">
              <label className="lbl">
                Store
                <select value={store} onChange={(e) => setStore(e.target.value as Store)}>
                  <option value="">Select a store...</option>
                  <option value="Downpatrick">Downpatrick</option>
                  <option value="Kilkeel">Kilkeel</option>
                  <option value="Newcastle">Newcastle</option>
                  <option value="Ballynahinch">Ballynahinch</option>
                </select>
              </label>

              <label className="lbl">
                Walkthrough type
                <select
                  value={walkthroughType}
                  onChange={(e) => setWalkthroughType(e.target.value as WalkthroughType)}
                >
                  <option value="pre_open">Pre-Open</option>
                  <option value="handover">Handover</option>
                </select>
              </label>

              <label className="lbl">
                Completed by
                <input
                  type="text"
                  placeholder="Type your name…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Expand/Collapse controls */}
          <div className="controls">
            <button type="button" className="btn" onClick={() => setAll(true)}>
              Expand all
            </button>
            <button type="button" className="btn" onClick={() => setAll(false)}>
              Collapse all
            </button>
          </div>

          {/* Sections */}
          <div className="stack">
            {OSA_STANDARDS_CHECKLIST.map((sec, si) => {
              const doneInSection = sec.items.reduce(
                (acc, _, idx) => acc + (ticks[`${sec.id}:${idx}`] ? 1 : 0),
                0
              );
              const sectionFull = doneInSection === sec.items.length && sec.items.length > 0;

              return (
                <div key={sec.id} className="card card--section">
                  <div className="section__head">
                    <div className="section__badge" />
                    <div className="section__titlewrap">
                      <div className="section__title">{sec.title}</div>
                      <div className="section__sub">
                        {doneInSection}/{sec.items.length} checks
                      </div>
                    </div>
                    <div className="section__chips">
                      <span className={`chip ${sectionFull ? "chip--green" : "chip--grey"}`}>
                        {sectionFull ? "Complete" : "In progress"}
                      </span>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => toggleSection(si)}
                      >
                        {open[si] ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  {open[si] && (
                    <div className="checks">
                      {sec.items.map((label, ii) => {
                        const key = `${sec.id}:${ii}`;
                        const checked = ticks[key] === true;

                        return (
                          <div key={key} className={`check ${ii % 2 ? "check--alt" : ""}`}>
                            <label className="check__row">
                              <input
                                className="bigbox"
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setTicks((prev) => ({ ...prev, [key]: e.target.checked }))
                                }
                              />
                              <span className="check__label">
                                <span className="check__text">{label}</span>
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ---- BOTTOM SUBMIT ---- */}
          <div className="inlineSubmitBottom">
            <button
              type="button"
              className="btn btn--brand btn--lg"
              onClick={() =>
                (document.getElementById("walkForm") as HTMLFormElement | null)?.requestSubmit()
              }
            >
              Submit Walkthrough
            </button>
          </div>
        </form>
      </section>

      {/* Floating Action Submit (bottom-right) */}
      <button
        className="fab"
        onClick={() =>
          (document.getElementById("walkForm") as HTMLFormElement | null)?.requestSubmit()
        }
        aria-label="Submit walkthrough"
      >
        ✓ Submit
      </button>

      {/* ---- Legacy CSS preserved (light touch: no removals, only safe adds) ---- */}
      <style jsx>{`
        :root {
          --bg: #f2f5f9;
          --paper: #ffffff;
          --line: #e5e7eb;
          --muted: #6b7280;
          --text: #1a1a1a;
          --brand: #006491;
          --brand-dk: #00517a;
          --accent: #0ea5e9;
          --green-ink: #15803d;
          --blue: #e6f0fb;
          --teal: #e6fbf6;
          --gold: #fff6e0;
          --green: #eaf8ee;
          --grey: #f3f4f6;
          --shadow-strong: 0 14px 28px rgba(2, 6, 23, 0.1), 0 2px 6px rgba(2, 6, 23, 0.06);
          --shadow-card: 0 10px 18px rgba(2, 6, 23, 0.08), 0 1px 3px rgba(2, 6, 23, 0.06);
        }

        .wrap {
          background: var(--bg);
          min-height: 100dvh;
          color: var(--text);
        }
        .wrap * {
          color: var(--text);
        }
        h1,
        h2,
        h3,
        .section__title,
        .lbl,
        .check__text,
        .bar__title {
          color: #0e1116 !important;
        }
        .muted,
        small,
        .section__sub {
          color: #4b5563 !important;
        }

        .banner {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 6px 0 10px;
          border-bottom: 3px solid #006491;
          background: #fff;
          box-shadow: var(--shadow-card);
        }
        .banner img {
          max-width: 92%;
          height: auto;
          display: block;
        }

        .container {
          max-width: 880px;
          margin: 0 auto;
          padding: 16px;
        }
        h1 {
          font-size: 22px;
          margin: 14px 0 12px;
          text-align: center;
          font-weight: 800;
          letter-spacing: 0.2px;
        }

        .stack {
          display: grid;
          gap: 16px;
        }

        .card {
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 14px;
          box-shadow: var(--shadow-card);
        }
        .card--raised {
          box-shadow: var(--shadow-strong);
        }
        .card--section {
          padding: 0;
          overflow: hidden;
          border: 1px solid #d8dee7;
          box-shadow: var(--shadow-strong);
        }

        .legend {
          font-size: 14px;
        }
        .legend__row {
          display: flex;
          justify-content: center;
        }
        .legend__stars {
          color: var(--muted);
        }

        .grid {
          display: grid;
          gap: 12px;
        }
        @media (min-width: 640px) {
          .grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        .lbl {
          display: grid;
          gap: 6px;
          font-weight: 700;
        }

        input[type="text"],
        input[type="number"],
        select {
          border: 2px solid #d7dbe3;
          border-radius: 12px;
          padding: 12px 14px;
          outline: none;
          font-size: 16px;
          background: #fff;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
        }
        input:focus,
        select:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 4px rgba(0, 100, 145, 0.15);
        }

        .controls {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .section__head {
          display: grid;
          grid-template-columns: 8px 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 14px 14px;
          background: linear-gradient(90deg, #ffffff, #f7fbff);
          border-bottom: 1px solid #dde3ec;
        }
        .section__badge {
          width: 8px;
          height: 100%;
          background: linear-gradient(#0ea5e9, #006491);
          border-radius: 0 6px 6px 0;
        }
        .section__titlewrap {
          display: grid;
          gap: 4px;
        }
        .section__title {
          font-weight: 900;
          letter-spacing: 0.2px;
        }
        .section__sub {
          color: var(--muted);
          font-size: 13px;
        }
        .section__chips {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .sticky {
          position: sticky;
          top: 0;
          z-index: 70;
          backdrop-filter: saturate(180%) blur(6px);
          background: rgba(255, 255, 255, 0.92);
          border-bottom: 1px solid var(--line);
          box-shadow: 0 2px 10px rgba(2, 6, 23, 0.06);
          pointer-events: auto;
        }
        .sticky__inner {
          max-width: 980px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 12px;
        }
        .sticky__left {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          align-items: center;
        }

        .checks {
          display: grid;
        }
        .check {
          padding: 12px;
          border-top: 1px solid #edf0f5;
          background: #ffffff;
          pointer-events: auto;
        }
        .check--alt {
          background: #fafcff;
        }
        .check__row {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 10px;
          align-items: start;
        }
        .bigbox {
          width: 20px;
          height: 20px;
          transform: scale(1.15);
          accent-color: var(--brand);
          margin-top: 2px;
        }
        .check__label {
          display: flex;
          align-items: start;
          gap: 8px;
          flex-wrap: wrap;
        }
        .check__text {
          font-weight: 700;
          line-height: 1.3;
        }

        .btn {
          background: #fff;
          border: 2px solid #d7dbe3;
          padding: 10px 14px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
          pointer-events: auto;
          position: relative;
          z-index: 2;
        }
        .btn--brand {
          background: var(--brand);
          color: #fff;
          border-color: var(--brand-dk);
        }
        .btn--brand:hover {
          background: var(--brand-dk);
        }
        .btn--ghost {
          background: #fff;
        }
        .btn--lg {
          padding: 14px 18px;
          font-size: 17px;
          border-radius: 14px;
        }

        .chip {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #fff;
          font-size: 13px;
          font-weight: 800;
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.8);
        }
        .chip--blue {
          background: #e6f0fb;
        }
        .chip--teal {
          background: #e6fbf6;
        }
        .chip--green {
          background: #e9f9f1;
          color: #15803d;
          border-color: #bfe9cf;
        }
        .chip--grey {
          background: #f3f4f6;
        }

        .inlineSubmitTop,
        .inlineSubmitBottom {
          text-align: center;
        }
        .inlineSubmitTop {
          margin-top: 4px;
        }
        .inlineSubmitBottom {
          margin: 10px 0 0;
        }

        .fab {
          position: fixed;
          right: 16px;
          bottom: 16px;
          z-index: 90;
          background: var(--brand);
          color: #fff;
          border: 2px solid var(--brand-dk);
          border-radius: 14px;
          padding: 14px 18px;
          font-weight: 900;
          box-shadow: 0 10px 18px rgba(2, 6, 23, 0.18);
          cursor: pointer;
          pointer-events: auto;
        }
      `}</style>
    </main>
  );
}
