"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STORES = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"];

type ShiftRow = {
  id: string;
  shift_date: string;
  day_name: string | null;
  store: string;
  forecast_sales: number | null;
  actual_sales: number | null;
  labour_pct: number | null;
  additional_hours: number | null;
  opening_manager: string | null;
  closing_manager: string | null;
  instores_scheduled: number | null;
  instores_actual: number | null;
  drivers_scheduled: number | null;
  drivers_actual: number | null;
  dot_pct: number | null;
  extremes_pct: number | null;
  sbr_pct: number | null;
  rnl_mins: number | null;
  food_var_pct: number | null;
};

export default function ServiceDashboardPage() {
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<"all" | string>("all");

  // % helpers
  const normalisePct = (v: number | null) => {
    if (v == null) return null;
    return v > 1 ? v / 100 : v; // 58 -> 0.58, 0.82 -> 0.82
  };

  // food variance helper
  // Damien's style: 0.6 -> 0.6%, not 60%
  const normaliseFoodVar = (v: number | null) => {
    if (v == null) return null;
    if (v <= 1) return v; // already tiny, treat as 0.6%
    return v / 100; // 30 -> 0.3, 6 -> 0.06
  };

  useEffect(() => {
    const load = async () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const dateStr = sixtyDaysAgo.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("service_shifts")
        .select("*")
        .gte("shift_date", dateStr)
        .order("shift_date", { ascending: false });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setRows((data || []) as ShiftRow[]);
      }
      setLoading(false);
    };

    load();
  }, []);

  // filter
  const filteredRows = useMemo(() => {
    if (selectedStore === "all") return rows;
    return rows.filter((r) => r.store === selectedStore);
  }, [rows, selectedStore]);

  // KPIs
  const kpis = useMemo(() => {
    if (filteredRows.length === 0) {
      return {
        totalActual: 0,
        totalForecast: 0,
        variancePct: 0,
        avgLabour: 0,
        avgDOT: 0,
        avgRnL: 0,
      };
    }

    let totalActual = 0;
    let totalForecast = 0;
    const labourVals: number[] = [];
    const dotVals: number[] = [];
    const rnlVals: number[] = [];

    for (const r of filteredRows) {
      if (r.actual_sales != null) totalActual += r.actual_sales;
      if (r.forecast_sales != null) totalForecast += r.forecast_sales;

      if (r.labour_pct != null) {
        const val = normalisePct(r.labour_pct);
        if (val != null) labourVals.push(val);
      }

      if (r.dot_pct != null) {
        const val = normalisePct(r.dot_pct);
        if (val != null) dotVals.push(val);
      }

      if (r.rnl_mins != null) rnlVals.push(r.rnl_mins);
    }

    const variancePct =
      totalForecast > 0 ? (totalActual - totalForecast) / totalForecast : 0;

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return {
      totalActual,
      totalForecast,
      variancePct,
      avgLabour: avg(labourVals),
      avgDOT: avg(dotVals),
      avgRnL: avg(rnlVals),
    };
  }, [filteredRows]);

  // per store
  const storeData = useMemo(() => {
    const out = STORES.map((storeName) => {
      const sr = filteredRows.filter((r) => r.store === storeName);
      if (sr.length === 0) {
        return {
          store: storeName,
          totalActual: 0,
          totalForecast: 0,
          variancePct: 0,
          avgLabour: 0,
          avgDOT: 0,
          avgSBR: 0,
          avgRnL: 0,
          avgFoodVar: 0,
        };
      }

      let totalActual = 0;
      let totalForecast = 0;
      const lab: number[] = [];
      const dot: number[] = [];
      const sbr: number[] = [];
      const rnl: number[] = [];
      const food: number[] = [];

      for (const r of sr) {
        if (r.actual_sales != null) totalActual += r.actual_sales;
        if (r.forecast_sales != null) totalForecast += r.forecast_sales;

        if (r.labour_pct != null) {
          const v = normalisePct(r.labour_pct);
          if (v != null) lab.push(v);
        }
        if (r.dot_pct != null) {
          const v = normalisePct(r.dot_pct);
          if (v != null) dot.push(v);
        }
        if (r.sbr_pct != null) {
          const v = normalisePct(r.sbr_pct);
          if (v != null) sbr.push(v);
        }
        if (r.rnl_mins != null) rnl.push(r.rnl_mins);
        if (r.food_var_pct != null) {
          const v = normaliseFoodVar(r.food_var_pct);
          if (v != null) food.push(v);
        }
      }

      const variancePct =
        totalForecast > 0 ? (totalActual - totalForecast) / totalForecast : 0;

      const avg = (arr: number[]) =>
        arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      return {
        store: storeName,
        totalActual,
        totalForecast,
        variancePct,
        avgLabour: avg(lab),
        avgDOT: avg(dot),
        avgSBR: avg(sbr),
        avgRnL: avg(rnl),
        avgFoodVar: avg(food),
      };
    });

    // rank by DOT, then labour
    out.sort((a, b) => {
      if (b.avgDOT !== a.avgDOT) return b.avgDOT - a.avgDOT;
      return a.avgLabour - b.avgLabour;
    });

    return out;
  }, [filteredRows]);

  // managers
  const managerData = useMemo(() => {
    const bucket: Record<
      string,
      {
        shifts: number;
        sales: number;
        labour: number[];
        dot: number[];
        sbr: number[];
        rnl: number[];
        food: number[];
      }
    > = {};

    for (const r of filteredRows) {
      const name = r.closing_manager || "Unknown";
      if (!bucket[name]) {
        bucket[name] = {
          shifts: 0,
          sales: 0,
          labour: [],
          dot: [],
          sbr: [],
          rnl: [],
          food: [],
        };
      }
      bucket[name].shifts += 1;
      if (r.actual_sales != null) bucket[name].sales += r.actual_sales;

      if (r.labour_pct != null) {
        const v = normalisePct(r.labour_pct);
        if (v != null) bucket[name].labour.push(v);
      }
      if (r.dot_pct != null) {
        const v = normalisePct(r.dot_pct);
        if (v != null) bucket[name].dot.push(v);
      }
      if (r.sbr_pct != null) {
        const v = normalisePct(r.sbr_pct);
        if (v != null) bucket[name].sbr.push(v);
      }
      if (r.rnl_mins != null) bucket[name].rnl.push(r.rnl_mins);
      if (r.food_var_pct != null) {
        const v = normaliseFoodVar(r.food_var_pct);
        if (v != null) bucket[name].food.push(v);
      }
    }

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const arr = Object.entries(bucket).map(([name, v]) => ({
      name,
      shifts: v.shifts,
      totalSales: v.sales,
      avgLabour: avg(v.labour),
      avgDOT: avg(v.dot),
      avgSBR: avg(v.sbr),
      avgRnL: avg(v.rnl),
      avgFoodVar: avg(v.food),
    }));

    // best DOT first
    arr.sort((a, b) => b.avgDOT - a.avgDOT);

    return arr;
  }, [filteredRows]);

  const handleBack = () => {
    if (typeof window !== "undefined") window.history.back();
  };

  return (
    <main className="wrap">
      {/* banner - same as other pages */}
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      {/* nav */}
      <div className="nav-row">
        <button onClick={handleBack} className="btn btn--ghost">
          ← Back
        </button>
        <a href="/" className="btn btn--brand">
          🏠 Home
        </a>
      </div>

      {/* heading */}
      <header className="header">
        <h1>Mourne-oids Service Dashboard</h1>
        <p className="subtitle">
          Daily service · labour · DOT · SBR · R&amp;L · Food variance
        </p>
      </header>

      {/* filters */}
      <section className="container wide">
        <div className="filters">
          <button
            onClick={() => setSelectedStore("all")}
            className={`btn ${selectedStore === "all" ? "btn--brand" : "btn--ghost"}`}
          >
            All stores
          </button>
          {STORES.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStore(s)}
              className={`btn ${selectedStore === s ? "btn--brand" : "btn--ghost"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* content */}
      <section className="container wide">
        {loading && <div className="card">Loading Mourne-oids data…</div>}
        {errorMsg && <div className="card error">Error: {errorMsg}</div>}

        {!loading && !errorMsg && (
          <>
            {/* KPI row */}
            <div className="kpi-grid">
              <div className="card kpi">
                <p className="kpi-title">Area Sales (£)</p>
                <p className="kpi-value">
                  £
                  {kpis.totalActual.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="kpi-sub">
                  {kpis.totalForecast
                    ? `vs £${kpis.totalForecast.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })} forecast`
                    : "No forecast recorded"}
                </p>
              </div>
              <div
                className={`card kpi ${
                  kpis.variancePct >= 0
                    ? "kpi--green"
                    : kpis.variancePct >= -0.05
                    ? "kpi--amber"
                    : "kpi--red"
                }`}
              >
                <p className="kpi-title">Variance %</p>
                <p className="kpi-value">
                  {(kpis.variancePct * 100).toFixed(1)}%
                </p>
                <p className="kpi-sub">Target: 0% or above</p>
              </div>
              <div
                className={`card kpi ${
                  kpis.avgLabour <= 0.25
                    ? "kpi--green"
                    : kpis.avgLabour <= 0.28
                    ? "kpi--amber"
                    : "kpi--red"
                }`}
              >
                <p className="kpi-title">Avg Labour %</p>
                <p className="kpi-value">
                  {(kpis.avgLabour * 100).toFixed(1)}%
                </p>
                <p className="kpi-sub">Target: 25%</p>
              </div>
              <div
                className={`card kpi ${
                  kpis.avgDOT >= 0.8
                    ? "kpi--green"
                    : kpis.avgDOT >= 0.75
                    ? "kpi--amber"
                    : "kpi--red"
                }`}
              >
                <p className="kpi-title">Avg DOT %</p>
                <p className="kpi-value">
                  {(kpis.avgDOT * 100).toFixed(0)}%
                </p>
                <p className="kpi-sub">Target: 80%+</p>
              </div>
            </div>

            {/* Store performance */}
            <h2 className="section-title">Store performance</h2>
            <div className="store-grid">
              {storeData.map((st) => (
                <div key={st.store} className="card store-card">
                  <div className="store-card__header">
                    <h3>{st.store}</h3>
                    <span
                      className={`pill ${
                        st.avgDOT >= 0.8
                          ? "pill--green"
                          : st.avgDOT >= 0.75
                          ? "pill--amber"
                          : "pill--red"
                      }`}
                    >
                      {Math.round(st.avgDOT * 100)}% DOT
                    </span>
                  </div>
                  <p className="metric">
                    Sales: £{st.totalActual.toLocaleString()}
                  </p>
                  <p className="metric muted">
                    Forecast:{" "}
                    {st.totalForecast
                      ? "£" + st.totalForecast.toLocaleString()
                      : "—"}
                  </p>
                  <p
                    className={`metric ${
                      st.variancePct >= 0
                        ? "pos"
                        : st.variancePct >= -0.05
                        ? "warn"
                        : "neg"
                    }`}
                  >
                    Var: {(st.variancePct * 100).toFixed(1)}%
                  </p>
                  <p className="metric">
                    Labour: {(st.avgLabour * 100).toFixed(1)}%
                  </p>
                  <p className="metric">
                    SBR: {(st.avgSBR * 100).toFixed(0)}%
                  </p>
                  <p className="metric">
                    R&amp;L: {st.avgRnL.toFixed(1)}m
                  </p>
                  <p className="metric">
                    Food var:{" "}
                    {st.avgFoodVar != null
                      ? st.avgFoodVar.toFixed(2) + "%"
                      : "—"}
                  </p>
                </div>
              ))}
            </div>

            {/* Manager leaderboard */}
            <h2 className="section-title">Manager / closing leaderboard</h2>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Manager</th>
                      <th>Shifts</th>
                      <th>Total Sales</th>
                      <th>Avg Labour</th>
                      <th>Avg DOT</th>
                      <th>Avg SBR</th>
                      <th>Avg R&amp;L</th>
                      <th>Food var</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerData.length === 0 && (
                      <tr>
                        <td colSpan={8} className="empty">
                          No manager data yet.
                        </td>
                      </tr>
                    )}
                    {managerData.map((mgr) => (
                      <tr key={mgr.name}>
                        <td>{mgr.name}</td>
                        <td>{mgr.shifts}</td>
                        <td>£{mgr.totalSales.toLocaleString()}</td>
                        <td
                          className={
                            mgr.avgLabour <= 0.25
                              ? "pos"
                              : mgr.avgLabour <= 0.28
                              ? "warn"
                              : "neg"
                          }
                        >
                          {(mgr.avgLabour * 100).toFixed(1)}%
                        </td>
                        <td
                          className={
                            mgr.avgDOT >= 0.8
                              ? "pos"
                              : mgr.avgDOT >= 0.75
                              ? "warn"
                              : "neg"
                          }
                        >
                          {(mgr.avgDOT * 100).toFixed(0)}%
                        </td>
                        <td>{(mgr.avgSBR * 100).toFixed(0)}%</td>
                        <td>{mgr.avgRnL.toFixed(1)}m</td>
                        <td>
                          {mgr.avgFoodVar != null
                            ? mgr.avgFoodVar.toFixed(2) + "%"
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>

      {/* Styles */}
      <style jsx>{`
        :root {
          --bg: #f2f5f9;
          --paper: #ffffff;
          --text: #0f172a;
          --muted: #475569;
          --brand: #006491;
          --brand-dark: #004b75;
          --shadow-card: 0 10px 18px rgba(2, 6, 23, 0.08),
            0 1px 3px rgba(2, 6, 23, 0.06);
          --green: #15803d;
          --amber: #d97706;
          --red: #b91c1c;
        }

        .wrap {
          background: var(--bg);
          min-height: 100dvh;
          color: var(--text);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-bottom: 40px;
        }

        .banner {
          display: flex;
          justify-content: center;
          align-items: center;
          background: #fff;
          border-bottom: 3px solid var(--brand);
          box-shadow: var(--shadow-card);
          width: 100%;
        }

        .banner img {
          max-width: 92%;
          height: auto;
          display: block;
        }

        .nav-row {
          width: 100%;
          max-width: 1100px;
          display: flex;
          gap: 10px;
          justify-content: flex-start;
          margin-top: 16px;
          padding: 0 16px;
        }

        .header {
          text-align: center;
          margin: 16px 16px 16px;
        }

        .header h1 {
          font-size: 26px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .subtitle {
          color: var(--muted);
          font-size: 14px;
          font-weight: 500;
        }

        .container {
          width: 100%;
          max-width: 420px;
          margin-top: 18px;
          display: flex;
          justify-content: center;
        }

        .container.wide {
          max-width: 1100px;
          flex-direction: column;
          gap: 16px;
        }

        .filters {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .btn {
          display: inline-block;
          text-align: center;
          padding: 10px 14px;
          border-radius: 14px;
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
          border: 2px solid transparent;
          transition: background 0.2s, transform 0.1s;
          cursor: pointer;
        }

        .btn--brand {
          background: var(--brand);
          border-color: var(--brand-dark);
          color: #fff;
          box-shadow: var(--shadow-card);
        }

        .btn--ghost {
          background: #fff;
          border-color: rgba(0, 0, 0, 0.02);
          color: var(--text);
        }

        .btn--brand:hover,
        .btn--ghost:hover {
          transform: translateY(-1px);
        }

        .card {
          background: var(--paper);
          border-radius: 18px;
          box-shadow: var(--shadow-card);
          padding: 16px 18px;
          border: 1px solid rgba(0, 0, 0, 0.03);
        }

        .card.error {
          background: #fee2e2;
          border: 1px solid #fca5a5;
          color: #991b1b;
        }

        .kpi-grid {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .kpi {
          min-height: 112px;
        }

        .kpi-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--muted);
          margin-bottom: 6px;
        }

        .kpi-value {
          font-size: 24px;
          font-weight: 800;
        }

        .kpi-sub {
          font-size: 12px;
          color: var(--muted);
          margin-top: 6px;
        }

        .kpi--green {
          border-left: 5px solid #22c55e;
        }
        .kpi--amber {
          border-left: 5px solid #f97316;
        }
        .kpi--red {
          border-left: 5px solid #ef4444;
        }

        .section-title {
          font-size: 16px;
          font-weight: 700;
          margin: 10px 0 6px;
        }

        .store-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .store-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .store-card h3 {
          font-size: 15px;
          font-weight: 700;
        }

        .pill {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 999px;
        }
        .pill--green {
          background: rgba(34, 197, 94, 0.12);
          color: #166534;
        }
        .pill--amber {
          background: rgba(249, 115, 22, 0.12);
          color: #9a3412;
        }
        .pill--red {
          background: rgba(239, 68, 68, 0.12);
          color: #991b1b;
        }

        .metric {
          font-size: 13px;
          margin-bottom: 2px;
        }
        .metric.muted {
          color: var(--muted);
        }
        .metric.pos {
          color: #166534;
        }
        .metric.warn {
          color: #b45309;
        }
        .metric.neg {
          color: #b91c1c;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        thead {
          background: #eff3f6;
        }

        th,
        td {
          text-align: left;
          padding: 8px 6px;
        }

        tbody tr:nth-child(even) {
          background: #f8fafc;
        }

        td.pos {
          color: #166534;
          font-weight: 600;
        }
        td.warn {
          color: #b45309;
          font-weight: 600;
        }
        td.neg {
          color: #b91c1c;
          font-weight: 600;
        }

        .empty {
          text-align: center;
          padding: 16px 6px;
          color: var(--muted);
        }

        .footer {
          text-align: center;
          margin-top: 36px;
          color: var(--muted);
          font-size: 13px;
        }

        /* responsive */
        @media (max-width: 1100px) {
          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .store-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 700px) {
          .store-grid {
            grid-template-columns: 1fr;
          }
          .container.wide {
            max-width: 94%;
          }
          .filters {
            justify-content: flex-start;
          }
          .nav-row {
            max-width: 94%;
          }
        }
      `}</style>
    </main>
  );
}
