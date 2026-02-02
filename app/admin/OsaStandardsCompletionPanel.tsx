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

type DateRange = "today" | "yesterday" | "wtd" | "custom";

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function isYYYYMMDD(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function toYYYYMMDDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

// convert local YYYY-MM-DD to ISO boundary (timestamptz-safe)
function startOfLocalDateISO(yyyyMMdd: string) {
  if (!isYYYYMMDD(yyyyMMdd)) return new Date().toISOString();
  const [y, m, d] = yyyyMMdd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  return dt.toISOString();
}
function startOfNextLocalDateISO(yyyyMMdd: string) {
  if (!isYYYYMMDD(yyyyMMdd)) return new Date().toISOString();
  const [y, m, d] = yyyyMMdd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  dt.setDate(dt.getDate() + 1);
  return dt.toISOString();
}

function startOfTodayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Monday 00:00 local (week starts Monday)
function startOfWeekLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  return x;
}

function formatShortDate(yyyyMMdd: string) {
  try {
    if (!isYYYYMMDD(yyyyMMdd)) return "—";
    const d = new Date(yyyyMMdd + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function OsaStandardsCompletionPanel() {
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [error, setError] = React.useState<string>("");

  // Dashboard-style date range controls
  const [dateRange, setDateRange] = React.useState<DateRange>("wtd");
  const [customFrom, setCustomFrom] = React.useState<string>(() => {
    const d = startOfTodayLocal();
    d.setDate(d.getDate() - 7);
    return toYYYYMMDDLocal(d);
  });
  const [customTo, setCustomTo] = React.useState<string>(() => toYYYYMMDDLocal(startOfTodayLocal()));

  const window = React.useMemo(() => {
    const now = new Date();

    if (dateRange === "today") {
      const from = startOfTodayLocal();
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      return {
        fromISO: from.toISOString(),
        toISO: to.toISOString(),
        label: "Today",
        fromLabel: toYYYYMMDDLocal(from),
        toLabel: toYYYYMMDDLocal(from),
      };
    }

    if (dateRange === "yesterday") {
      const to = startOfTodayLocal();
      const from = new Date(to);
      from.setDate(from.getDate() - 1);
      return {
        fromISO: from.toISOString(),
        toISO: to.toISOString(),
        label: "Yesterday",
        fromLabel: toYYYYMMDDLocal(from),
        toLabel: toYYYYMMDDLocal(from),
      };
    }

    if (dateRange === "wtd") {
      const monday = startOfWeekLocal(now);
      const to = new Date(now);
      // make "to" exclusive boundary = start of tomorrow local
      const toExcl = startOfTodayLocal();
      toExcl.setDate(toExcl.getDate() + 1);

      return {
        fromISO: monday.toISOString(),
        toISO: toExcl.toISOString(),
        label: "Week to date",
        fromLabel: toYYYYMMDDLocal(monday),
        toLabel: toYYYYMMDDLocal(now),
      };
    }

    // custom (inclusive end day)
    const fromISO = startOfLocalDateISO(customFrom);
    const toISO = startOfNextLocalDateISO(customTo);
    return {
      fromISO,
      toISO,
      label: "Custom",
      fromLabel: customFrom,
      toLabel: customTo,
    };
  }, [dateRange, customFrom, customTo]);

  const load = React.useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      if (!supabase) throw new Error("Supabase client not available");

      const { data, error } = await supabase
        .from("osa_standards_walkthroughs")
        .select("store, walkthrough_type, completed_at, completed_by, is_admin_override")
        .gte("completed_at", window.fromISO)
        .lt("completed_at", window.toISO)
        .order("completed_at", { ascending: false });

      if (error) throw error;
      setRows((data || []) as Row[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load status");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [window.fromISO, window.toISO]);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

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
      if (!map[r.store][slot]) map[r.store][slot] = r; // newest first
      if (!map[r.store].last) map[r.store].last = r;
    }

    return map;
  }, [rows]);

  const badge = (ok: boolean) => (ok ? "🟢 Complete" : "🔴 Missing");

  const periodLabel = React.useMemo(() => {
    if (dateRange === "custom") {
      return `Custom (${formatShortDate(window.fromLabel)} → ${formatShortDate(window.toLabel)})`;
    }
    if (dateRange === "wtd") {
      return `Week to date (${formatShortDate(window.fromLabel)} → ${formatShortDate(window.toLabel)})`;
    }
    return window.label;
  }, [dateRange, window.fromLabel, window.toLabel, window.label]);

  return (
    <div className="osaCard">
      {/* DASHBOARD-STYLE FILTER PANEL */}
      <div className="filters-panel card soft">
        <div className="filters-block">
          <p className="filters-title">Period</p>
          <div className="filters">
            <button
              type="button"
              onClick={() => setDateRange("today")}
              className={`chip small ${dateRange === "today" ? "chip--active" : ""}`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDateRange("yesterday")}
              className={`chip small ${dateRange === "yesterday" ? "chip--active" : ""}`}
            >
              Previous day
            </button>
            <button
              type="button"
              onClick={() => setDateRange("wtd")}
              className={`chip small ${dateRange === "wtd" ? "chip--active" : ""}`}
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => setDateRange("custom")}
              className={`chip small ${dateRange === "custom" ? "chip--active" : ""}`}
            >
              Custom
            </button>
          </div>
        </div>

        {dateRange === "custom" && (
          <div className="custom-row">
            <div className="date-field">
              <label>From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                max={customTo}
              />
            </div>
            <div className="date-field">
              <label>To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                min={customFrom}
              />
            </div>
            <button className="btn btn--brand" type="button" onClick={load}>
              Apply
            </button>
          </div>
        )}

        <div className="filters-block" style={{ marginLeft: "auto" as any }}>
          <p className="filters-title">Actions</p>
          <div className="filters">
            <button className="btn btn--ghost" type="button" onClick={load}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* HEADER */}
      <div className="osaHeader">
        <div>
          <div className="osaTitle">OSA Standards Walkthrough</div>
          <div className="osaSub">
            {periodLabel} • Completion tracker for <b>Pre-Open</b> and <b>Handover</b>.
          </div>
        </div>
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
                        )} · ${last.completed_by}${last.is_admin_override ? " (override)" : ""}`
                      : "No submissions in this period"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        :root {
          --bg: #f2f5f9;
          --paper: #ffffff;
          --text: #0f172a;
          --muted: #475569;
          --brand: #006491;
          --brand-dark: #004b75;
          --shadow-card: 0 10px 18px rgba(2, 6, 23, 0.08), 0 1px 3px rgba(2, 6, 23, 0.06);
          --border: rgba(15, 23, 42, 0.06);
        }

        .osaCard {
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(6px);
          box-shadow: var(--shadow-card);
          margin: 14px 0;
        }

        /* Dashboard-style filters */
        .card {
          background: #fff;
          border-radius: 18px;
          box-shadow: var(--shadow-card);
          border: 1px solid rgba(0, 0, 0, 0.02);
        }
        .card.soft {
          box-shadow: none;
          background: rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(0, 0, 0, 0.04);
        }

        .filters-panel {
          display: flex;
          gap: 24px;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .filters-block {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .filters-title {
          font-size: 12px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
          margin: 0;
        }

        .filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .chip {
          background: #fff;
          border: 1px solid rgba(0, 0, 0, 0.03);
          border-radius: 999px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          cursor: pointer;
          transition: 0.15s ease;
        }
        .chip.small {
          padding: 5px 11px;
          font-size: 12px;
        }
        .chip--active {
          background: var(--brand);
          color: #fff;
          border-color: #004b75;
          box-shadow: 0 6px 10px rgba(0, 100, 145, 0.26);
        }

        .custom-row {
          display: flex;
          gap: 12px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .date-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .date-field label {
          font-size: 12px;
          color: var(--muted);
          font-weight: 700;
        }

        .date-field input {
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 10px;
          padding: 6px 8px;
          font-size: 13px;
          font-weight: 700;
          background: #fff;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          text-align: center;
          padding: 10px 14px;
          border-radius: 14px;
          font-weight: 900;
          font-size: 14px;
          text-decoration: none;
          border: 2px solid transparent;
          transition: background 0.2s, transform 0.1s;
          cursor: pointer;
          white-space: nowrap;
        }

        .btn--brand {
          background: var(--brand);
          border-color: var(--brand-dark);
          color: #fff;
        }
        .btn--brand:hover {
          background: var(--brand-dark);
          transform: translateY(-1px);
        }

        .btn--ghost {
          background: #fff;
          border-color: rgba(0, 0, 0, 0.04);
          color: #0f172a;
        }
        .btn--ghost:hover {
          border-color: rgba(0, 100, 145, 0.25);
          transform: translateY(-1px);
        }

        .osaHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 6px;
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
          font-weight: 700;
        }

        .osaError {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #9f1239;
          padding: 10px 12px;
          border-radius: 12px;
          font-weight: 800;
          margin: 8px 0;
        }

        .osaLoading {
          color: #4b5563;
          padding: 10px 2px;
          font-weight: 800;
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

        @media (max-width: 720px) {
          .filters-panel {
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}
