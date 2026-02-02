"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

type Row = {
  store: string;
  walkthrough_type: "pre_open" | "handover";
  completed_at: string;
  completed_by: string;
  is_admin_override?: boolean;
};

const STORES = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"] as const;

type RangeMode = "today" | "previous_day" | "this_week" | "custom";

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function fmtDateLabel(d: Date) {
  try {
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "";
  }
}

function startOfTodayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfTomorrowLocal() {
  const d = startOfTodayLocal();
  d.setDate(d.getDate() + 1);
  return d;
}

function startOfYesterdayLocal() {
  const d = startOfTodayLocal();
  d.setDate(d.getDate() - 1);
  return d;
}

// Monday 00:00 local (week starts Monday)
function startOfThisWeekLocal() {
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfNextWeekLocal() {
  const d = startOfThisWeekLocal();
  d.setDate(d.getDate() + 7);
  return d;
}

function toYYYYMMDDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

// Turn YYYY-MM-DD (local) into ISO boundaries that work with timestamptz
function startOfLocalDateISO(yyyyMMdd: string) {
  const [y, m, d] = yyyyMMdd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  return dt.toISOString();
}
function startOfNextLocalDateISO(yyyyMMdd: string) {
  const [y, m, d] = yyyyMMdd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  dt.setDate(dt.getDate() + 1);
  return dt.toISOString();
}

export default function OsaStandardsCompletionPanel() {
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [error, setError] = React.useState<string>("");

  // Date mode + custom dates
  const [rangeMode, setRangeMode] = React.useState<RangeMode>("today");
  const [customFrom, setCustomFrom] = React.useState<string>(() =>
    toYYYYMMDDLocal(startOfTodayLocal())
  );
  const [customTo, setCustomTo] = React.useState<string>(() =>
    toYYYYMMDDLocal(startOfTodayLocal())
  );

  // Compute current query window (inclusive start, exclusive end)
  const window = React.useMemo(() => {
    if (rangeMode === "today") {
      const fromD = startOfTodayLocal();
      const toD = startOfTomorrowLocal();
      return {
        from: fromD.toISOString(),
        to: toD.toISOString(),
        label: "Today",
      };
    }

    if (rangeMode === "previous_day") {
      const fromD = startOfYesterdayLocal();
      const toD = startOfTodayLocal();
      return {
        from: fromD.toISOString(),
        to: toD.toISOString(),
        label: `Previous day (${fmtDateLabel(fromD)})`,
      };
    }

    if (rangeMode === "this_week") {
      const fromD = startOfThisWeekLocal();
      const toD = startOfNextWeekLocal();
      return {
        from: fromD.toISOString(),
        to: toD.toISOString(),
        label: `This week (${fmtDateLabel(fromD)} → ${fmtDateLabel(
          new Date(toD.getTime() - 1)
        )})`,
      };
    }

    // custom (inclusive dates)
    const from = startOfLocalDateISO(customFrom);
    const to = startOfNextLocalDateISO(customTo);
    return {
      from,
      to,
      label: `Custom (${customFrom} → ${customTo})`,
    };
  }, [rangeMode, customFrom, customTo]);

  async function load() {
    try {
      setError("");
      setLoading(true);

      if (!supabase) throw new Error("Supabase client not available");

      const { data, error } = await supabase
        .from("osa_standards_walkthroughs")
        .select(
          "store, walkthrough_type, completed_at, completed_by, is_admin_override"
        )
        .gte("completed_at", window.from)
        .lt("completed_at", window.to)
        .order("completed_at", { ascending: false });

      if (error) throw error;

      setRows((data || []) as Row[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load status");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // refresh every minute
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window.from, window.to]);

  // Build per-store status (latest entry in range for each type)
  const byStore = React.useMemo(() => {
    const map: Record<
      string,
      {
        pre_open?: Row;
        handover?: Row;
        last?: Row;
      }
    > = {};

    for (const s of STORES) map[s] = {};

    for (const r of rows) {
      if (!map[r.store]) map[r.store] = {};

      const slot = r.walkthrough_type === "pre_open" ? "pre_open" : "handover";

      // rows are ordered newest first, so first hit is latest
      if (!map[r.store][slot]) map[r.store][slot] = r;
      if (!map[r.store].last) map[r.store].last = r;
    }

    return map;
  }, [rows]);

  const badge = (ok: boolean) => (ok ? "🟢 Complete" : "🔴 Missing");

  return (
    <div className="osaCard">
      <div className="osaHeader">
        <div>
          <div className="osaTitle">OSA Standards Walkthrough — {window.label}</div>
          <div className="osaSub">
            Completion tracker for <b>Pre-Open</b> and <b>Handover</b>.
          </div>
        </div>
        <button className="osaBtn" type="button" onClick={load}>
          Refresh
        </button>
      </div>

      {/* Range selector */}
      <div className="rangeBar" role="group" aria-label="Date range">
        <div className="chips">
          <button
            type="button"
            className={`chip ${rangeMode === "today" ? "chipActive" : ""}`}
            onClick={() => setRangeMode("today")}
          >
            Today
          </button>

          <button
            type="button"
            className={`chip ${rangeMode === "previous_day" ? "chipActive" : ""}`}
            onClick={() => setRangeMode("previous_day")}
          >
            Previous day
          </button>

          <button
            type="button"
            className={`chip ${rangeMode === "this_week" ? "chipActive" : ""}`}
            onClick={() => setRangeMode("this_week")}
          >
            This week
          </button>

          <button
            type="button"
            className={`chip ${rangeMode === "custom" ? "chipActive" : ""}`}
            onClick={() => setRangeMode("custom")}
          >
            Custom
          </button>
        </div>

        {rangeMode === "custom" && (
          <div className="customDates">
            <label className="field">
              <span>From</span>
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </label>

            <label className="field">
              <span>To</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </label>

            <button className="osaBtn secondary" type="button" onClick={load}>
              Apply
            </button>
          </div>
        )}
      </div>

      {error && <div className="osaError">Error: {error}</div>}

      {loading ? (
        <div className="osaLoading">Loading…</div>
      ) : (
        <div className="osaGrid">
          {STORES.map((s) => {
            const pre = byStore[s]?.pre_open;
            const han = byStore[s]?.handover;
            const last = byStore[s]?.last;

            return (
              <div key={s} className="osaTile">
                <div className="osaStore">{s}</div>

                <div className="osaRow">
                  <div className="osaKey">Pre-Open</div>
                  <div className="osaVal">{badge(!!pre)}</div>
                  <div className="osaMeta">
                    {pre ? `${fmtTime(pre.completed_at)} · ${pre.completed_by}` : ""}
                  </div>
                </div>

                <div className="osaRow">
                  <div className="osaKey">Handover</div>
                  <div className="osaVal">{badge(!!han)}</div>
                  <div className="osaMeta">
                    {han ? `${fmtTime(han.completed_at)} · ${han.completed_by}` : ""}
                  </div>
                </div>

                <div className="osaFooter">
                  <span className="osaFootKey">Last:</span>{" "}
                  <span className="osaFootVal">
                    {last
                      ? `${last.walkthrough_type === "pre_open" ? "Pre-Open" : "Handover"} · ${fmtTime(
                          last.completed_at
                        )} · ${last.completed_by}${
                          last.is_admin_override ? " (override)" : ""
                        }`
                      : "No submissions in this period"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .osaCard {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
          background: #fff;
          box-shadow: 0 10px 18px rgba(2, 6, 23, 0.06),
            0 1px 3px rgba(2, 6, 23, 0.06);
          margin: 14px 0;
        }
        .osaHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .osaTitle {
          font-weight: 900;
          font-size: 16px;
          color: #0e1116;
        }
        .osaSub {
          margin-top: 2px;
          font-size: 13px;
          color: #4b5563;
        }
        .osaBtn {
          background: #fff;
          border: 2px solid #d7dbe3;
          padding: 8px 12px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .osaBtn.secondary {
          border-color: #c7d2fe;
        }

        /* range controls */
        .rangeBar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin: 6px 0 10px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          background: linear-gradient(180deg, #ffffff, #f8fbff);
        }

        .chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .chip {
          border: 1px solid rgba(0, 0, 0, 0.06);
          background: #fff;
          border-radius: 999px;
          padding: 7px 12px;
          font-weight: 900;
          font-size: 13px;
          cursor: pointer;
          color: #0e1116;
          transition: transform 0.12s ease, background 0.12s ease,
            border 0.12s ease;
        }

        .chip:hover {
          transform: translateY(-1px);
          border-color: rgba(0, 100, 145, 0.25);
        }

        .chipActive {
          background: rgba(0, 100, 145, 0.1);
          border-color: rgba(0, 100, 145, 0.25);
          color: #004b75;
        }

        .customDates {
          display: flex;
          gap: 10px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .field {
          display: grid;
          gap: 4px;
          font-size: 12px;
          font-weight: 900;
          color: #334155;
        }

        input[type="date"] {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 7px 9px;
          font-size: 13px;
          font-weight: 800;
          background: #fff;
        }

        .osaError {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #9f1239;
          padding: 10px 12px;
          border-radius: 12px;
          font-weight: 700;
          margin: 8px 0;
        }
        .osaLoading {
          color: #4b5563;
          padding: 10px 2px;
          font-weight: 700;
        }
        .osaGrid {
          display: grid;
          gap: 12px;
        }
        @media (min-width: 700px) {
          .osaGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1000px) {
          .osaGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .osaTile {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 12px;
          background: linear-gradient(180deg, #ffffff, #f8fbff);
        }
        .osaStore {
          font-weight: 900;
          margin-bottom: 8px;
          color: #0e1116;
        }
        .osaRow {
          display: grid;
          grid-template-columns: 90px 1fr;
          gap: 6px 10px;
          align-items: center;
          padding: 8px 0;
          border-top: 1px solid #edf0f5;
        }
        .osaRow:first-of-type {
          border-top: none;
          padding-top: 0;
        }
        .osaKey {
          font-weight: 800;
          color: #0e1116;
        }
        .osaVal {
          font-weight: 900;
          color: #0e1116;
        }
        .osaMeta {
          grid-column: 2 / 3;
          color: #4b5563;
          font-size: 12px;
          font-weight: 700;
        }
        .osaFooter {
          margin-top: 10px;
          border-top: 1px solid #edf0f5;
          padding-top: 10px;
          color: #4b5563;
          font-size: 12px;
          font-weight: 700;
        }
        .osaFootKey {
          font-weight: 900;
          color: #0e1116;
        }
        .osaFootVal {
          color: #4b5563;
        }
      `}</style>
    </div>
  );
}
