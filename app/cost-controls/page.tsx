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

// ✅ Removed "today" (current day is never complete)
type RangeMode = "previous_day" | "this_week" | "this_month" | "custom";

type CostRow = {
  id: string;
  store: string;
  shift_date: string; // YYYY-MM-DD
  manager_name: string;

  // Stored in Supabase as £ values (not displayed)
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

// expects decimal form (0.25 = 25%)
function fmtPct(n: number, dp = 2) {
  if (!isFinite(n)) return "—";
  return (n * 100).toFixed(dp) + "%";
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cryptoRandomFallback() {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return crypto.randomUUID();
  } catch {}
  return String(Date.now()) + "_" + Math.random().toString(16).slice(2);
}

function normaliseRow(r: any): CostRow {
  const id = String(r.id ?? r.uuid ?? cryptoRandomFallback());
  const store =
    String(r.store ?? r.store_name ?? r.shop ?? "").trim() || "Unknown";
  const shift_date = String(
    r.shift_date ?? r.date ?? r.shiftDay ?? r.shift_day ?? ""
  ).slice(0, 10);
  const manager_name =
    String(
      r.manager_name ?? r.manager ?? r.shift_manager ?? r.user ?? "Unknown"
    ).trim() || "Unknown";

  const sales_gbp = num(r.sales_gbp ?? r.sales ?? r.net_sales ?? 0);
  const labour_cost_gbp = num(
    r.labour_cost_gbp ?? r.labour_gbp ?? r.labour_cost ?? r.labour ?? 0
  );
  const ideal_food_cost_gbp = num(
    r.ideal_food_cost_gbp ?? r.ideal_food ?? r.ideal_food_gbp ?? 0
  );
  const actual_food_cost_gbp = num(
    r.actual_food_cost_gbp ?? r.actual_food ?? r.actual_food_gbp ?? 0
  );

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

type Agg = {
  name: string; // store or manager
  days: number;

  // Internal sums for correct weighting (NOT displayed)
  sales: number;
  labour: number;
  idealFood: number;
  actualFood: number;

  // Displayed metrics
  labourPct: number; // labour / sales
  foodVarPctSales: number; // (actual - ideal) / sales

  // Ranking helpers
  labourDelta: number; // amount ABOVE target (0 if <= target). Lower is better.
  foodVarAbs: number; // absolute distance to 0. Lower is better.
};

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

// Targets
const LABOUR_TARGET = 0.25; // 25%
const FOODVAR_MIN = -0.0025; // -0.25%
const FOODVAR_MAX = 0.0025; // +0.25%

function aggregate(rows: CostRow[], key: "store" | "manager_name"): Agg[] {
  const bucket: Record<string, CostRow[]> = {};

  for (const r of rows) {
    const name = String((r as any)[key] || "").trim() || "Unknown";
    if (!bucket[name]) bucket[name] = [];
    bucket[name].push(r);
  }

  return Object.entries(bucket).map(([name, items]) => {
    const sales = sum(items.map((x) => Number(x.sales_gbp || 0)));
    const labour = sum(items.map((x) => Number(x.labour_cost_gbp || 0)));
    const idealFood = sum(items.map((x) => Number(x.ideal_food_cost_gbp || 0)));
    const actualFood = sum(items.map((x) => Number(x.actual_food_cost_gbp || 0)));

    const labourPct = sales > 0 ? labour / sales : 0;
    const foodVarPctSales = sales > 0 ? (actualFood - idealFood) / sales : 0;

    const days = new Set(items.map((x) => x.shift_date)).size;

    const labourDelta = Math.max(0, labourPct - LABOUR_TARGET);
    const foodVarAbs = Math.abs(foodVarPctSales);

    return {
      name,
      days,
      sales,
      labour,
      idealFood,
      actualFood,
      labourPct,
      foodVarPctSales,
      labourDelta,
      foodVarAbs,
    };
  });
}

// ✅ Labour ranking: <=25% first, then lowest labour%, then sales tiebreak
function sortByLabour(a: Agg, b: Agg) {
  if (a.labourDelta !== b.labourDelta) return a.labourDelta - b.labourDelta;
  if (a.labourPct !== b.labourPct) return a.labourPct - b.labourPct;
  return b.sales - a.sales;
}

// ✅ Food ranking: closest to 0% wins, then sales tiebreak
function sortByFood(a: Agg, b: Agg) {
  if (a.foodVarAbs !== b.foodVarAbs) return a.foodVarAbs - b.foodVarAbs;
  return b.sales - a.sales;
}

export default function CostControlsPage() {
  const router = useRouter();

  // Default to previous_day (today is never complete)
  const [rangeMode, setRangeMode] = useState<RangeMode>("previous_day");
  const [customFrom, setCustomFrom] = useState<string>(() =>
    toYYYYMMDDLocal(startOfTodayLocal())
  );
  const [customTo, setCustomTo] = useState<string>(() =>
    toYYYYMMDDLocal(startOfTodayLocal())
  );

  const rangeWindow = useMemo(() => {
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
        label: `This week (${fmtShortDate(
          toYYYYMMDDLocal(fromD)
        )} → ${fmtShortDate(
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
        label: `This month (${fromD.toLocaleString("en-GB", {
          month: "long",
        })})`,
      };
    }

    // custom
    const safeFrom = customFrom;
    const safeTo = customTo;
    const toD = new Date(safeTo + "T00:00:00");
    toD.setDate(toD.getDate() + 1);
    const to = toYYYYMMDDLocal(toD);
    return {
      from: safeFrom,
      to,
      label: `Custom (${fmtShortDate(safeFrom)} → ${fmtShortDate(safeTo)})`,
    };
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

      const missingShiftDate = normalised.some(
        (r) => !r.shift_date || r.shift_date.length < 10
      );
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

  const storeBase = useMemo(() => aggregate(rows, "store"), [rows]);
  const mgrBase = useMemo(() => aggregate(rows, "manager_name"), [rows]);

  const storeLabour = useMemo(
    () => storeBase.slice().sort(sortByLabour),
    [storeBase]
  );
  const storeFood = useMemo(() => storeBase.slice().sort(sortByFood), [storeBase]);

  const mgrLabour = useMemo(() => mgrBase.slice().sort(sortByLabour), [mgrBase]);
  const mgrFood = useMemo(() => mgrBase.slice().sort(sortByFood), [mgrBase]);

  const topStoreLabour = storeLabour[0] || null;
  const topStoreFood = storeFood[0] || null;

  return (
    <main className="wrap">
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <div className="shell">
        <div className="topbar">
          <button className="navbtn" type="button" onClick={() => router.back()}>
            ← Back
          </button>
          <div className="topbar-spacer" />
          <button
            className="navbtn solid"
            type="button"
            onClick={() => router.push("/")}
          >
            🏠 Home
          </button>
        </div>

        <header className="header">
          <h1>Cost Controls</h1>
          <p className="subtitle">
            Targets — Labour <b>≤ {fmtPct(LABOUR_TARGET, 0)}</b> and Food Variance
            band{" "}
            <b>
              {fmtPct(FOODVAR_MIN, 2)} → {fmtPct(FOODVAR_MAX, 2)}
            </b>{" "}
            • period: <b>{rangeWindow.label}</b>
          </p>
        </header>

        <section className="filter-card" aria-label="Date range">
          <div className="quick-row">
            <button
              type="button"
              className={`quick ${rangeMode === "previous_day" ? "active" : ""}`}
              onClick={() => setRangeMode("previous_day")}
            >
              Previous day
            </button>
            <button
              type="button"
              className={`quick ${rangeMode === "this_week" ? "active" : ""}`}
              onClick={() => setRangeMode("this_week")}
            >
              This week
            </button>
            <button
              type="button"
              className={`quick ${rangeMode === "this_month" ? "active" : ""}`}
              onClick={() => setRangeMode("this_month")}
            >
              This month
            </button>
            <button
              type="button"
              className={`quick ${rangeMode === "custom" ? "active" : ""}`}
              onClick={() => setRangeMode("custom")}
            >
              Custom
            </button>
          </div>

          {rangeMode === "custom" && (
            <div className="custom-grid">
              <label className="date-field">
                <span>From</span>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </label>
              <label className="date-field">
                <span>To</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </label>
              <button className="navbtn" type="button" onClick={load}>
                Apply
              </button>
            </div>
          )}

          <div className="filter-actions">
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

              <div className="podium-grid">
                <div className="podium-card">
                  <div className="podium-top">
                    <span className="metric-title">🏆 Labour Winner</span>
                    <span className="pill neutral">≤ 25% then lowest</span>
                  </div>
                  <div className="podium-metrics">
                    <div className="podium-name">
                      {topStoreLabour ? topStoreLabour.name : "No data"}
                    </div>
                    <div className="metric-row">
                      Labour:{" "}
                      <b>
                        {topStoreLabour
                          ? fmtPct(topStoreLabour.labourPct, 1)
                          : "—"}
                      </b>
                    </div>
                  </div>
                </div>

                <div className="podium-card">
                  <div className="podium-top">
                    <span className="metric-title">🥇 Food Winner</span>
                    <span className="pill neutral">Closest to 0%</span>
                  </div>
                  <div className="podium-metrics">
                    <div className="podium-name">
                      {topStoreFood ? topStoreFood.name : "No data"}
                    </div>
                    <div className="metric-row">
                      Variance:{" "}
                      <b>
                        {topStoreFood
                          ? fmtPct(topStoreFood.foodVarPctSales, 2)
                          : "—"}
                      </b>
                    </div>
                  </div>
                </div>

                <div className="podium-card">
                  <div className="podium-top">
                    <span className="metric-title">📦 Entries</span>
                    <span className="pill neutral">Data</span>
                  </div>
                  <div className="podium-metrics">
                    <div className="podium-name">{rows.length}</div>
                    <div className="metric-row">
                      Range: <b>{rangeWindow.label}</b>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="boards">
              {/* STORES - LABOUR */}
              <div className="board">
                <div className="boardHead">
                  <h2>Store • Labour Rankings</h2>
                  <p>≤ 25% first → lowest labour% wins</p>
                </div>
                <div className="podium-grid">
                  {storeLabour.map((a, idx) => (
                    <div key={a.name} className={`podium-card rank-${idx + 1}`}>
                      <div className="podium-top">
                        <span className="rank-badge">Rank #{idx + 1}</span>
                      </div>
                      <div className="podium-name">{a.name}</div>
                      <div className="podium-metrics">
                        <p>
                          <span>Days</span>
                          <span className="pill neutral">{a.days}</span>
                        </p>
                        <p>
                          <span>Labour %</span>
                          <span className="pill neutral">{fmtPct(a.labourPct, 1)}</span>
                        </p>
                        <p>
                          <span>Food Var %</span>
                          <span className="pill neutral">{fmtPct(a.foodVarPctSales, 2)}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                  {storeLabour.length === 0 && (
                    <div className="podium-card">
                      <div className="podium-metrics">
                        <p className="empty">No cost control entries found for this period.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* STORES - FOOD */}
              <div className="board">
                <div className="boardHead">
                  <h2>Store • Food Rankings</h2>
                  <p>Closest to 0% food variance wins</p>
                </div>
                <div className="podium-grid">
                  {storeFood.map((a, idx) => (
                    <div key={a.name} className={`podium-card rank-${idx + 1}`}>
                      <div className="podium-top">
                        <span className="rank-badge">Rank #{idx + 1}</span>
                      </div>
                      <div className="podium-name">{a.name}</div>
                      <div className="podium-metrics">
                        <p>
                          <span>Days</span>
                          <span className="pill neutral">{a.days}</span>
                        </p>
                        <p>
                          <span>Food Var %</span>
                          <span className="pill neutral">{fmtPct(a.foodVarPctSales, 2)}</span>
                        </p>
                        <p>
                          <span>Labour %</span>
                          <span className="pill neutral">{fmtPct(a.labourPct, 1)}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                  {storeFood.length === 0 && (
                    <div className="podium-card">
                      <div className="podium-metrics">
                        <p className="empty">No cost control entries found for this period.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* MANAGERS - LABOUR */}
              <div className="board">
                <div className="boardHead">
                  <h2>Manager • Labour Rankings</h2>
                  <p>≤ 25% first → lowest labour% wins</p>
                </div>

                <div className="table-wrap">
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
                      {mgrLabour.map((a, idx) => (
                        <tr key={a.name}>
                          <td className="rank">{idx + 1}</td>
                          <td className="name">{a.name}</td>
                          <td className="num">{a.days}</td>
                          <td className="num">{fmtPct(a.labourPct, 1)}</td>
                          <td className="num">{fmtPct(a.foodVarPctSales, 2)}</td>
                        </tr>
                      ))}
                      {mgrLabour.length === 0 && (
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

              {/* MANAGERS - FOOD */}
              <div className="board">
                <div className="boardHead">
                  <h2>Manager • Food Rankings</h2>
                  <p>Closest to 0% food variance wins</p>
                </div>

                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>Rank</th>
                        <th>Manager</th>
                        <th style={{ width: 130 }}>Days</th>
                        <th style={{ width: 210 }}>Food Var %</th>
                        <th style={{ width: 170 }}>Labour %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mgrFood.map((a, idx) => (
                        <tr key={a.name}>
                          <td className="rank">{idx + 1}</td>
                          <td className="name">{a.name}</td>
                          <td className="num">{a.days}</td>
                          <td className="num">{fmtPct(a.foodVarPctSales, 2)}</td>
                          <td className="num">{fmtPct(a.labourPct, 1)}</td>
                        </tr>
                      ))}
                      {mgrFood.length === 0 && (
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
        .wrap {
          min-height: 100dvh;
          background: radial-gradient(circle at top, rgba(0, 100, 145, 0.08), transparent 45%), linear-gradient(180deg, #e3edf4 0%, #f2f5f9 30%, #f2f5f9 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          color: #0f172a;
          padding-bottom: 40px;
        }
        .banner { display:flex; justify-content:center; align-items:center; background:#fff; border-bottom:3px solid #006491; box-shadow:0 12px 35px rgba(2,6,23,.08); width:100%; }
        .banner img { max-width:min(1160px,92%); height:auto; display:block; }
        .shell { width:min(1100px,94vw); margin-top:18px; background:rgba(255,255,255,.65); backdrop-filter:saturate(160%) blur(6px); border:1px solid rgba(255,255,255,.22); border-radius:1.5rem; box-shadow:0 16px 40px rgba(0,0,0,.05); padding:18px 22px 26px; }
        .topbar { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
        .topbar-spacer { flex:1; }
        .navbtn { border-radius:14px; border:2px solid #006491; background:#fff; color:#006491; font-weight:900; font-size:14px; padding:8px 12px; cursor:pointer; box-shadow:0 6px 14px rgba(0,100,145,.12); }
        .navbtn.solid { background:#006491; color:#fff; }
        .header { text-align:center; margin-bottom:12px; }
        .header h1 { font-size:clamp(2rem,3vw,2.3rem); font-weight:900; margin:0; }
        .subtitle { margin:6px 0 0; color:#64748b; font-weight:700; font-size:.95rem; }

        .filter-card { margin-top:14px; display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center; padding:12px 14px; border-radius:16px; background:rgba(255,255,255,.9); border:1px solid rgba(0,100,145,.14); box-shadow:0 12px 28px rgba(2,6,23,.05); }
        .quick-row { display:flex; gap:8px; flex-wrap:wrap; }
        .quick { border:1px solid rgba(15,23,42,.08); background:#fff; border-radius:999px; padding:8px 12px; font-weight:900; font-size:13px; cursor:pointer; color:#0f172a; }
        .quick.active { background:rgba(0,100,145,.1); border-color:rgba(0,100,145,.25); color:#004b75; }
        .custom-grid { display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; grid-column:1 / -1; }
        .date-field { display:flex; flex-direction:column; gap:6px; font-size:12px; font-weight:900; color:#334155; }
        input[type="date"] { border-radius:12px; border:1px solid rgba(15,23,42,.14); padding:8px 10px; font-weight:800; background:#fff; }
        .filter-actions { display:flex; gap:10px; align-items:center; }

        .alert { margin-top:12px; border-radius:14px; padding:12px 14px; font-weight:800; background:rgba(254,242,242,.9); border:1px solid rgba(239,68,68,.25); color:#7f1d1d; word-break:break-word; }
        .alert.muted { background:rgba(255,255,255,.85); border:1px solid rgba(15,23,42,.1); color:#334155; }

        .highlights, .boards { margin-top:16px; }
        .highlightsHead, .boardHead, .section-head { display:flex; justify-content:space-between; align-items:flex-end; gap:10px; margin-bottom:10px; }
        .highlightsHead h2, .boardHead h2 { margin:0; font-size:15px; font-weight:900; }
        .highlightsHead p, .boardHead p { margin:0; font-size:12px; color:#64748b; font-weight:800; }

        .podium-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
        .podium-card { background:rgba(255,255,255,.92); border-radius:18px; border:1px solid rgba(0,100,145,.14); box-shadow:0 12px 28px rgba(2,6,23,.05); padding:12px 14px; }
        .podium-card.rank-1 { border-color: rgba(34,197,94,0.35); }
        .podium-card.rank-2 { border-color: rgba(245,158,11,0.35); }
        .podium-card.rank-3 { border-color: rgba(249,115,22,0.35); }
        .podium-top { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
        .rank-badge { display:inline-flex; align-items:center; height:26px; padding:0 10px; border-radius:999px; background:rgba(0,100,145,.1); border:1px solid rgba(0,100,145,.18); color:#004b75; font-weight:800; font-size:12px; }
        .metric-title { font-size:12px; font-weight:900; letter-spacing:.02em; text-transform:uppercase; color:#0f172a; }
        .podium-name { font-size:18px; font-weight:900; color:#0f172a; margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .podium-metrics { display:grid; gap:6px; }
        .metric-row { font-size:13px; color:#334155; font-weight:800; }
        .podium-metrics p { margin:0; display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:13px; color:#334155; }

        .pill { font-size:11px; font-weight:700; padding:4px 10px; border-radius:999px; border:1px solid rgba(15,23,42,.12); background:rgba(241,245,249,.9); color:#334155; white-space:nowrap; }
        .pill.green { background:rgba(34,197,94,.12); border-color:rgba(34,197,94,.25); color:#166534; }
        .pill.amber { background:rgba(245,158,11,.14); border-color:rgba(245,158,11,.28); color:#92400e; }
        .pill.red { background:rgba(239,68,68,.12); border-color:rgba(239,68,68,.26); color:#991b1b; }
        .pill.neutral { background:rgba(0,100,145,.1); border-color:rgba(0,100,145,.2); color:#004b75; }

        .boards { display:grid; gap:16px; }
        .table-wrap { overflow-x:auto; border-radius:16px; border:1px solid rgba(15,23,42,.08); background:rgba(255,255,255,.9); box-shadow:0 12px 28px rgba(2,6,23,.05); }
        .table { width:100%; border-collapse:collapse; }
        .table th, .table td { padding:12px; text-align:left; font-size:13px; }
        .table th { background:rgba(0,100,145,.08); font-weight:900; letter-spacing:.02em; }
        .table tr + tr td { border-top:1px solid rgba(15,23,42,.06); }
        td.num { text-align:right; font-variant-numeric:tabular-nums; font-weight:900; }
        td.rank, td.name { font-weight:900; }
        td.empty { padding:16px 12px; color:#475569; font-weight:800; }

        .footer { text-align:center; margin-top:18px; color:#94a3b8; font-size:.8rem; }
        @media (max-width: 980px) { .podium-grid { grid-template-columns:1fr; } .highlightsHead, .boardHead { flex-direction:column; align-items:flex-start; } .filter-card { grid-template-columns:1fr; } }
      `}</style>
    </main>
  );
}
