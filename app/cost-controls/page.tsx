"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

type RangeMode = "today" | "previous_day" | "this_week" | "this_month" | "custom";

type CostRow = {
  id: string;
  store: string;
  shift_date: string; // YYYY-MM-DD
  manager_name: string;

  // Raw £ amounts from Supabase (NOT displayed)
  sales_gbp: number;
  labour_cost_gbp: number;
  ideal_food_cost_gbp: number;
  actual_food_cost_gbp: number;

  created_at?: string | null;
};

function isYYYYMMDD(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function toYYYYMMDDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
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

// Monday 00:00 local (UK-style)
function startOfThisWeekLocal() {
  const d = startOfTodayLocal();
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

function startOfThisMonthLocal() {
  const d = startOfTodayLocal();
  d.setDate(1);
  return d;
}

function startOfNextMonthLocal() {
  const d = startOfThisMonthLocal();
  d.setMonth(d.getMonth() + 1);
  return d;
}

function fmtShortDate(yyyyMMdd: string) {
  if (!isYYYYMMDD(yyyyMMdd)) return yyyyMMdd;
  const d = new Date(yyyyMMdd + "T00:00:00");
  if (isNaN(d.getTime())) return yyyyMMdd;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// expects decimal form (0.28). We use this for labour% and food% (and variance as percentage points).
function fmtPct(n: number, dp = 1) {
  if (!isFinite(n)) return "—";
  return (n * 100).toFixed(dp) + "%";
}

type Agg = {
  name: string; // store or manager
  days: number;

  // kept internally for weighting + tiebreaks (NOT displayed)
  sales: number;
  labour: number;
  idealFood: number;
  actualFood: number;

  labourPct: number; // labour £ / sales £ over the period
  foodVarPctSales: number; // (actual% - ideal%) over the period, i.e. (actual£-ideal£)/sales£
};

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normaliseRow(r: any): CostRow {
  const id = String(r.id ?? r.uuid ?? cryptoRandomFallback());
  const store = String(r.store ?? r.store_name ?? r.shop ?? "").trim() || "Unknown";
  const shift_date = String(r.shift_date ?? r.date ?? r.shiftDay ?? r.shift_day ?? "").slice(0, 10);
  const manager_name =
    String(r.manager_name ?? r.manager ?? r.shift_manager ?? r.user ?? "Unknown").trim() || "Unknown";

  const sales_gbp = num(r.sales_gbp ?? r.sales ?? r.net_sales ?? 0);
  const labour_cost_gbp = num(r.labour_cost_gbp ?? r.labour_gbp ?? r.labour_cost ?? r.labour ?? 0);
  const ideal_food_cost_gbp = num(r.ideal_food_cost_gbp ?? r.ideal_food ?? r.ideal_food_gbp ?? 0);
  const actual_food_cost_gbp = num(r.actual_food_cost_gbp ?? r.actual_food ?? r.actual_food_gbp ?? 0);

  const created_at = r.created_at ? String(r.created_at) : null;

  return {
    id,
    store,
    shift_date,
    manager_name,
    sales_gbp,
    labour_cost_gbp,
    ideal_food_cost_gbp,
    actual_food_cost_gbp,
    created_at,
  };
}

// fallback if id not present (shouldn’t happen, but avoids React key crashes)
function cryptoRandomFallback() {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return String(Date.now()) + "_" + Math.random().toString(16).slice(2);
}

export default function CostControlsPage() {
  const router = useRouter();

  const [rangeMode, setRangeMode] = useState<RangeMode>("today");
  const [customFrom, setCustomFrom] = useState<string>(() => toYYYYMMDDLocal(startOfTodayLocal()));
  const [customTo, setCustomTo] = useState<string>(() => toYYYYMMDDLocal(startOfTodayLocal()));

  const rangeWindow = useMemo(() => {
    if (rangeMode === "today") {
      const from = toYYYYMMDDLocal(startOfTodayLocal());
      const to = toYYYYMMDDLocal(startOfTomorrowLocal());
      return { from, to, label: "Today" };
    }

    if (rangeMode === "previous_day") {
      const d = startOfTodayLocal();
      d.setDate(d.getDate() - 1);
      const from = toYYYYMMDDLocal(d);
      const toD = new Date(d);
      toD.setDate(toD.getDate() + 1);
      const to = toYYYYMMDDLocal(toD);
      return { from, to, label: "Previous day" };
    }

    if (rangeMode === "this_week") {
      const fromD = startOfThisWeekLocal();
      const toD = startOfNextWeekLocal();
      return {
        from: toYYYYMMDDLocal(fromD),
        to: toYYYYMMDDLocal(toD),
        label: `This week (${fmtShortDate(toYYYYMMDDLocal(fromD))} → ${fmtShortDate(
          toYYYYMMDDLocal(new Date(toD.getTime() - 1))
        )})`,
      };
    }

    if (rangeMode === "this_month") {
      const fromD = startOfThisMonthLocal();
      const toD = startOfNextMonthLocal();
      return {
        from: toYYYYMMDDLocal(fromD),
        to: toYYYYMMDDLocal(toD),
        label: `This month (${fromD.toLocaleString("en-GB", { month: "long" })})`,
      };
    }

    const safeFrom = customFrom;
    const safeTo = customTo;
    const toD = new Date(safeTo + "T00:00:00");
    toD.setDate(toD.getDate() + 1);
    const to = toYYYYMMDDLocal(toD);
    return { from: safeFrom, to, label: `Custom (${fmtShortDate(safeFrom)} → ${fmtShortDate(safeTo)})` };
  }, [rangeMode, customFrom, customTo]);

  const [rows, setRows] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      if (!supabase) throw new Error("Supabase client not available");

      const { data, error } = await supabase
        .from("cost_control_entries")
        .select("*")
        .gte("shift_date", rangeWindow.from)
        .lt("shift_date", rangeWindow.to)
        .order("shift_date", { ascending: false });

      if (error) {
        throw new Error(
          [
            error.message,
            error.code ? `code: ${error.code}` : null,
            // @ts-ignore
            error.details ? `details: ${error.details}` : null,
            // @ts-ignore
            error.hint ? `hint: ${error.hint}` : null,
          ]
            .filter(Boolean)
            .join(" | ")
        );
      }

      const normalised = (data || []).map(normaliseRow);

      const missingShiftDate = normalised.some((r) => !r.shift_date || r.shift_date.length < 10);
      if (missingShiftDate) {
        setErr(
          "Loaded rows, but some entries are missing a valid shift_date. Check table column names/types (expected shift_date as YYYY-MM-DD)."
        );
      }

      setRows(normalised);
    } catch (e: any) {
      setErr(e?.message || "Failed to load cost control entries");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeWindow.from, rangeWindow.to]);

  const storeAgg = useMemo(() => aggregate(rows, "store"), [rows]);
  const mgrAgg = useMemo(() => aggregate(rows, "manager_name"), [rows]);

  const topStoreLabour = storeAgg.slice().sort((a, b) => a.labourPct - b.labourPct)[0] || null;
  const topStoreFood = storeAgg.slice().sort((a, b) => a.foodVarPctSales - b.foodVarPctSales)[0] || null;

  return (
    <main className="wrap">
      <div className="banner">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <div className="shell">
        <div className="topbar">
          <button className="navbtn" type="button" onClick={() => router.back()}>
            ← Back
          </button>
          <div className="topbar-spacer" />
          <button className="navbtn solid" type="button" onClick={() => router.push("/")}>
            🏠 Home
          </button>
        </div>

        <header className="header">
          <h1>Cost Controls</h1>
          <p className="subtitle">
            Labour % + Food Variance % (Actual − Ideal) • weighted by total sales • period: <b>{rangeWindow.label}</b>
          </p>
        </header>

        <section className="rangeCard" aria-label="Date range">
          <div className="chips">
            <button type="button" className={`chip ${rangeMode === "today" ? "active" : ""}`} onClick={() => setRangeMode("today")}>
              Today
            </button>
            <button
              type="button"
              className={`chip ${rangeMode === "previous_day" ? "active" : ""}`}
              onClick={() => setRangeMode("previous_day")}
            >
              Previous day
            </button>
            <button type="button" className={`chip ${rangeMode === "this_week" ? "active" : ""}`} onClick={() => setRangeMode("this_week")}>
              This week
            </button>
            <button type="button" className={`chip ${rangeMode === "this_month" ? "active" : ""}`} onClick={() => setRangeMode("this_month")}>
              This month
            </button>
            <button type="button" className={`chip ${rangeMode === "custom" ? "active" : ""}`} onClick={() => setRangeMode("custom")}>
              Custom
            </button>
          </div>

          {rangeMode === "custom" && (
            <div className="customDates">
              <label className="field">
                <span>From</span>
                <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
              </label>
              <label className="field">
                <span>To</span>
                <input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} />
              </label>
              <button className="navbtn" type="button" onClick={load}>
                Apply
              </button>
            </div>
          )}

          <div className="rangeRight">
            <button className="navbtn" type="button" onClick={load}>
              Refresh
            </button>
          </div>
        </section>

        {err && <div className="alert">❌ {err}</div>}
        {loading && <div className="alert muted">Loading…</div>}

        {!loading && !err && (
          <>
            <section className="highlights">
              <div className="highlightsHead">
                <h2>Highlights</h2>
                <p>Best performers in the selected period</p>
              </div>

              <div className="highlightsGrid">
                <div className="hlCard">
                  <div className="hlTop">
                    <span className="hlTitle">🏆 Best Labour</span>
                    <span className="hlPill">Weighted</span>
                  </div>
                  <div className="hlMain">
                    <div className="hlName">{topStoreLabour ? topStoreLabour.name : "No data"}</div>
                    <div className="hlMeta">
                      Labour: <b>{topStoreLabour ? fmtPct(topStoreLabour.labourPct, 1) : "—"}</b>
                    </div>
                  </div>
                </div>

                <div className="hlCard">
                  <div className="hlTop">
                    <span className="hlTitle">🥇 Best Food Variance</span>
                    <span className="hlPill">Weighted</span>
                  </div>
                  <div className="hlMain">
                    <div className="hlName">{topStoreFood ? topStoreFood.name : "No data"}</div>
                    <div className="hlMeta">
                      Variance: <b>{topStoreFood ? fmtPct(topStoreFood.foodVarPctSales, 2) : "—"}</b>
                    </div>
                  </div>
                </div>

                <div className="hlCard">
                  <div className="hlTop">
                    <span className="hlTitle">📦 Entries</span>
                    <span className="hlPill">Data</span>
                  </div>
                  <div className="hlMain">
                    <div className="hlName">{rows.length}</div>
                    <div className="hlMeta">
                      Range: <b>{rangeWindow.label}</b>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="boards">
              <div className="board">
                <div className="boardHead">
                  <h2>Store Rankings</h2>
                  <p>Ranked by lower labour% then lower food variance% (Actual − Ideal)</p>
                </div>

                <div className="tableWrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>Rank</th>
                        <th>Store</th>
                        <th style={{ width: 130 }}>Days</th>
                        <th style={{ width: 170 }}>Labour %</th>
                        <th style={{ width: 210 }}>Food Var %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storeAgg.map((a, idx) => (
                        <tr key={a.name}>
                          <td className="rank">{idx + 1}</td>
                          <td className="name">{a.name}</td>
                          <td className="num">{a.days}</td>
                          <td className="num">{fmtPct(a.labourPct, 1)}</td>
                          <td className="num">{fmtPct(a.foodVarPctSales, 2)}</td>
                        </tr>
                      ))}
                      {storeAgg.length === 0 && (
                        <tr>
                          <td className="empty" colSpan={5}>
                            No cost control entries found for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="board">
                <div className="boardHead">
                  <h2>Manager Rankings</h2>
                  <p>Ranked by lower labour% then lower food variance% (Actual − Ideal)</p>
                </div>

                <div className="tableWrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>Rank</th>
                        <th>Manager</th>
                        <th style={{ width: 130 }}>Days</th>
                        <th style={{ width: 170 }}>Labour %</th>
                        <th style={{ width: 210 }}>Food Var %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mgrAgg.map((a, idx) => (
                        <tr key={a.name}>
                          <td className="rank">{idx + 1}</td>
                          <td className="name">{a.name}</td>
                          <td className="num">{a.days}</td>
                          <td className="num">{fmtPct(a.labourPct, 1)}</td>
                          <td className="num">{fmtPct(a.foodVarPctSales, 2)}</td>
                        </tr>
                      ))}
                      {mgrAgg.length === 0 && (
                        <tr>
                          <td className="empty" colSpan={5}>
                            No cost control entries found for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <footer className="footer">
        <p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>

      <style jsx>{`
        :root {
          --text: #0f172a;
          --muted: #64748b;
          --brand: #006491;
          --brand-dark: #004b75;
          --shadow: 0 16px 40px rgba(0, 0, 0, 0.05);
        }

        .wrap {
          min-height: 100dvh;
          background:
            radial-gradient(circle at top, rgba(0, 100, 145, 0.08), transparent 45%),
            linear-gradient(180deg, #e3edf4 0%, #f2f5f9 30%, #f2f5f9 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          color: var(--text);
          padding-bottom: 40px;
        }

        .banner {
          display: flex;
          justify-content: center;
          align-items: center;
          background: #fff;
          border-bottom: 3px solid var(--brand);
          box-shadow: 0 12px 35px rgba(2, 6, 23, 0.08);
          width: 100%;
        }

        .banner img {
          max-width: min(1160px, 92%);
          height: auto;
          display: block;
        }

        .shell {
          width: min(1100px, 94vw);
          margin-top: 18px;
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: saturate(160%) blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 1.5rem;
          box-shadow: var(--shadow);
          padding: 18px 22px 26px;
        }

        .topbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .topbar-spacer {
          flex: 1;
        }

        .navbtn {
          border-radius: 14px;
          border: 2px solid var(--brand);
          background: #fff;
          color: var(--brand);
          font-weight: 900;
          font-size: 14px;
          padding: 8px 12px;
          cursor: pointer;
          box-shadow: 0 6px 14px rgba(0, 100, 145, 0.12);
          transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease, border-color 0.15s ease;
        }
        .navbtn:hover {
          background: var(--brand);
          color: #fff;
          transform: translateY(-1px);
        }
        .navbtn.solid {
          background: var(--brand);
          color: #fff;
        }
        .navbtn.solid:hover {
          background: var(--brand-dark);
          border-color: var(--brand-dark);
        }

        .header {
          text-align: center;
          margin-bottom: 12px;
        }
        .header h1 {
          font-size: clamp(2rem, 3vw, 2.3rem);
          font-weight: 900;
          letter-spacing: -0.015em;
          margin: 0;
        }
        .subtitle {
          margin: 6px 0 0;
          color: var(--muted);
          font-weight: 700;
          font-size: 0.95rem;
        }

        .rangeCard {
          margin-top: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;

          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
        }

        .chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .chip {
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: #fff;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 900;
          font-size: 13px;
          cursor: pointer;
          color: #0f172a;
          transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;
        }
        .chip:hover {
          transform: translateY(-1px);
          border-color: rgba(0, 100, 145, 0.28);
        }
        .chip.active {
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
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
          font-weight: 900;
          color: #334155;
        }

        input[type="date"] {
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.14);
          padding: 8px 10px;
          font-weight: 800;
          background: #fff;
        }

        .rangeRight {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .alert {
          margin-top: 12px;
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 800;
          background: rgba(254, 242, 242, 0.9);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #7f1d1d;
          word-break: break-word;
        }
        .alert.muted {
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(15, 23, 42, 0.1);
          color: #334155;
        }

        .highlights {
          margin-top: 16px;
        }
        .highlightsHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-bottom: 10px;
        }
        .highlightsHead h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
        }
        .highlightsHead p {
          margin: 0;
          font-size: 12px;
          color: var(--muted);
          font-weight: 800;
        }
        .highlightsGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .hlCard {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 18px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          padding: 12px 14px;
        }
        .hlTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }
        .hlTitle {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: #0f172a;
        }
        .hlPill {
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.1);
          border: 1px solid rgba(0, 100, 145, 0.16);
          color: #004b75;
          white-space: nowrap;
        }
        .hlName {
          font-size: 18px;
          font-weight: 900;
          color: #0f172a;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .hlMeta {
          font-size: 13px;
          color: #334155;
          font-weight: 800;
        }

        .boards {
          margin-top: 16px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .boardHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-bottom: 10px;
        }
        .boardHead h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
        }
        .boardHead p {
          margin: 0;
          font-size: 12px;
          color: var(--muted);
          font-weight: 800;
        }

        .tableWrap {
          overflow-x: auto;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
        }

        .table {
          width: 100%;
          border-collapse: collapse;
        }
        th,
        td {
          padding: 12px 12px;
          text-align: left;
          font-size: 13px;
        }
        th {
          background: rgba(0, 100, 145, 0.08);
          font-weight: 900;
          letter-spacing: 0.02em;
        }
        tr + tr td {
          border-top: 1px solid rgba(15, 23, 42, 0.06);
        }

        td.num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          font-weight: 900;
        }
        td.rank,
        td.name {
          font-weight: 900;
        }
        td.empty {
          padding: 16px 12px;
          color: #475569;
          font-weight: 800;
        }

        .footer {
          text-align: center;
          margin-top: 18px;
          color: #94a3b8;
          font-size: 0.8rem;
        }

        @media (max-width: 980px) {
          .highlightsGrid {
            grid-template-columns: 1fr;
          }
          .highlightsHead,
          .boardHead {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}

function aggregate(rows: CostRow[], key: "store" | "manager_name"): Agg[] {
  const bucket: Record<string, CostRow[]> = {};

  for (const r of rows) {
    const name = String((r as any)[key] || "").trim() || "Unknown";
    if (!bucket[name]) bucket[name] = [];
    bucket[name].push(r);
  }

  const out: Agg[] = Object.entries(bucket).map(([name, items]) => {
    const sales = sum(items.map((x) => Number(x.sales_gbp || 0)));
    const labour = sum(items.map((x) => Number(x.labour_cost_gbp || 0)));
    const idealFood = sum(items.map((x) => Number(x.ideal_food_cost_gbp || 0)));
    const actualFood = sum(items.map((x) => Number(x.actual_food_cost_gbp || 0)));

    // Labour % over the whole period
    const labourPct = sales > 0 ? labour / sales : 0;

    // ✅ Correct food %s over the whole period
    const idealFoodPct = sales > 0 ? idealFood / sales : 0;
    const actualFoodPct = sales > 0 ? actualFood / sales : 0;

    // ✅ Food variance over the whole period (Actual − Ideal)
    const foodVarPctSales = actualFoodPct - idealFoodPct;

    const days = new Set(items.map((x) => x.shift_date)).size;

    return {
      name,
      days,
      sales,
      labour,
      idealFood,
      actualFood,
      labourPct,
      foodVarPctSales,
    };
  });

  // Rank: lower labour% best, tie-break lower food variance% best, then higher sales (not displayed)
  out.sort((a, b) => {
    if (a.labourPct !== b.labourPct) return a.labourPct - b.labourPct;
    if (a.foodVarPctSales !== b.foodVarPctSales) return a.foodVarPctSales - b.foodVarPctSales;
    return b.sales - a.sales;
  });

  return out;
}
