"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { OSA_STANDARDS_CHECKLIST, OsaWalkthroughType } from "@/lib/osa-standards-checklist";

type Store = "Downpatrick" | "Kilkeel" | "Newcastle" | "Ballynahinch";
const STORES: Store[] = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"];

export default function OsaStandardsWalkthroughPage() {
  const router = useRouter();

  const [store, setStore] = React.useState<Store | "">("");
  const [walkthroughType, setWalkthroughType] = React.useState<OsaWalkthroughType>("pre_open");
  const [completedBy, setCompletedBy] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // checked[sectionIndex][itemIndex] = boolean
  const [checked, setChecked] = React.useState<boolean[][]>(
    () => OSA_STANDARDS_CHECKLIST.map((s) => s.items.map(() => false))
  );

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const totalItems = React.useMemo(
    () => OSA_STANDARDS_CHECKLIST.reduce((acc, s) => acc + s.items.length, 0),
    []
  );
  const checkedCount = React.useMemo(
    () => checked.reduce((acc, sec) => acc + sec.filter(Boolean).length, 0),
    [checked]
  );
  const allComplete = checkedCount === totalItems;

  function toggleItem(sectionIdx: number, itemIdx: number) {
    setChecked((prev) => {
      const next = prev.map((row) => row.slice());
      next[sectionIdx][itemIdx] = !next[sectionIdx][itemIdx];
      return next;
    });
  }

  function toggleSection(sectionIdx: number, value: boolean) {
    setChecked((prev) => {
      const next = prev.map((row) => row.slice());
      next[sectionIdx] = next[sectionIdx].map(() => value);
      return next;
    });
  }

  async function onSubmit() {
    setError(null);

    if (!store) return setError("Please select a store.");
    if (completedBy.trim().length < 2) return setError("Please enter who completed the walkthrough.");
    if (!allComplete) return setError("All line items must be ticked before submitting.");

    const sectionsPayload = OSA_STANDARDS_CHECKLIST.map((section, sIdx) => ({
      title: section.title,
      items: section.items.map((label, iIdx) => ({
        label,
        checked: checked[sIdx]?.[iIdx] ?? false,
      })),
      completed: checked[sIdx]?.every(Boolean) ?? false,
    }));

    setSubmitting(true);
    try {
      const res = await fetch("/api/osa-standards/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store,
          walkthrough_type: walkthroughType,
          completed_by: completedBy.trim(),
          notes: notes.trim() ? notes.trim() : null,
          sections: sectionsPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Submit failed");

      router.push("/success");
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wrap">
      <div className="banner">
        <div className="container">
          <h1 className="bar__title">OSA Standards Walkthrough</h1>
          <p className="muted">Tick-only • Twice daily (Pre-Open & Handover)</p>
        </div>
      </div>

      <div className="container stack">
        <div className="card card--raised">
          <div className="grid">
            <label className="lbl">
              Store
              <select className="controls" value={store} onChange={(e) => setStore(e.target.value as any)}>
                <option value="">Select…</option>
                {STORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="lbl">
              Walkthrough
              <div className="controls" style={{ display: "flex", gap: 12, alignItems: "center", padding: 10 }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="radio"
                    name="wtType"
                    checked={walkthroughType === "pre_open"}
                    onChange={() => setWalkthroughType("pre_open")}
                  />
                  Pre-Open
                </label>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="radio"
                    name="wtType"
                    checked={walkthroughType === "handover"}
                    onChange={() => setWalkthroughType("handover")}
                  />
                  Handover
                </label>
              </div>
            </label>

            <label className="lbl">
              Completed by
              <input
                className="controls"
                value={completedBy}
                onChange={(e) => setCompletedBy(e.target.value)}
                placeholder="Name"
              />
            </label>

            <label className="lbl">
              Notes (optional)
              <input
                className="controls"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything to flag?"
              />
            </label>
          </div>

          <div className="card__bar" style={{ marginTop: 12 }}>
            <div className="pill">
              Progress: <strong>{checkedCount}</strong> / {totalItems}
            </div>
            <div className="section__chips">
              {allComplete ? (
                <span className="chip chip--teal">All complete</span>
              ) : (
                <span className="chip chip--gold">Incomplete</span>
              )}
            </div>
          </div>

          {error ? <p className="muted" style={{ color: "#b91c1c", marginTop: 10 }}>{error}</p> : null}

          <div className="inlineSubmitTop">
            <button className="btn btn--brand btn--lg" disabled={submitting} onClick={onSubmit}>
              {submitting ? "Submitting…" : "Submit walkthrough"}
            </button>
          </div>
        </div>

        {OSA_STANDARDS_CHECKLIST.map((section, sIdx) => {
          const secChecked = checked[sIdx] ?? [];
          const secDone = secChecked.length > 0 && secChecked.every(Boolean);
          return (
            <div key={section.title} className="card card--section">
              <div className="section__head">
                <div className="section__titlewrap">
                  <h2 className="section__title">{section.title}</h2>
                  <div className="section__sub">
                    {secChecked.filter(Boolean).length}/{secChecked.length} ticked
                  </div>
                </div>
                <div className="section__chips">
                  {secDone ? <span className="chip chip--teal">Complete</span> : <span className="chip chip--gold">In progress</span>}
                  <button
                    className="btn btn--ghost"
                    type="button"
                    onClick={() => toggleSection(sIdx, !secDone)}
                    title={secDone ? "Untick section" : "Tick section"}
                  >
                    {secDone ? "Untick all" : "Tick all"}
                  </button>
                </div>
              </div>

              <div className="checks">
                {section.items.map((label, iIdx) => (
                  <label key={label} className="check__row">
                    <input
                      type="checkbox"
                      checked={checked[sIdx]?.[iIdx] ?? false}
                      onChange={() => toggleItem(sIdx, iIdx)}
                    />
                    <span className="check__text">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        <div className="inlineSubmitBottom">
          <button className="btn btn--brand btn--lg" disabled={submitting} onClick={onSubmit}>
            {submitting ? "Submitting…" : "Submit walkthrough"}
          </button>
        </div>
      </div>
    </div>
  );
}
