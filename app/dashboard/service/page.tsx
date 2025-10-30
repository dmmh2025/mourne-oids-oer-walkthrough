"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

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

type DateRange = "yesterday" | "wtd" | "mtd" | "ytd" | "custom";

export default function ServiceDashboardPage() {
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<"all" | string>("all");
  const [dateRange, setDateRange] = useState<DateRange>("wtd");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const normalisePct = (v: number | null) => {
    if (v == null) return null;
    return v > 1 ? v / 100 : v;
  };

  const normaliseFoodVar = (v: number | null) => {
    if (v == null) return null;
    if (v <= 1) return v;
    return v / 100;
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

  // master date filter
  const dateFilteredRows = useMemo(() => {
    const now = new Date();

    if (dateRange === "yesterday") {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      return rows.filter((r) => r.shift_date === yStr);
    }

    if (dateRange === "wtd") {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);

      return rows.filter((r) => {
        const d = new Date(r.shift_date);
        return d >= monday && d <= now;
      });
    }

    if (dateRange === "mtd") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return rows.filter((r) => {
        const d = new Date(r.shift_date);
        return d >= first && d <= now;
      });
    }

    if (dateRange === "ytd") {
      const first = new Date(now.getFullYear(), 0, 1);
      return rows.filter((r) => {
        const d = new Date(r.shift_date);
        return d >= first && d <= now;
      });
    }

    if (dateRange === "custom") {
      if (!customFrom && !customTo) return rows;
      return rows.filter((r) => {
        const d = new Date(r.shift_date);
        if (customFrom) {
          const f = new Date(customFrom);
          f.setHours(0, 0, 0, 0);
          if (d < f) return false;
        }
        if (customTo) {
          const t = new Date(customTo);
          t.setHours(23, 59, 59, 999);
          if (d > t) return false;
        }
        return true;
      });
    }

    return rows;
  }, [rows, dateRange, customFrom, customTo]);

  // store filter
  const filteredRows = useMemo(() => {
    if (selectedStore === "all") return dateFilteredRows;
    return dateFilteredRows.filter((r) => r.store === selectedStore);
  }, [dateFilteredRows, selectedStore]);

  // area overview
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

      const labour = normalisePct(r.labour_pct);
      if (labour != null) labourVals.push(labour);

      const dot = normalisePct(r.dot_pct);
      if (dot != null) dotVals.push(dot);

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

  // store overview
  const storeData = useMemo(() => {
    return STORES.map((storeName) => {
      const rowsForStore = dateFilteredRows.filter(
        (r) => r.store === storeName
      );

      if (rowsForStore.length === 0) {
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

      const isSingleRowView =
        (dateRange === "yesterday" || dateRange === "custom") &&
        rowsForStore.length === 1;

      if (isSingleRowView) {
        const r = rowsForStore[0];

        const labour = normalisePct(r.labour_pct);
        const dot = normalisePct(r.dot_pct);
        const sbr = normalisePct(r.sbr_pct);
        const food = normaliseFoodVar(r.food_var_pct);

        const actual = r.actual_sales || 0;
        const forecast = r.forecast_sales || 0;
        const variance =
          forecast > 0 ? (actual - forecast) / forecast : 0;

        return {
          store: storeName,
          totalActual: actual,
          totalForecast: forecast,
          variancePct: variance,
          avgLabour: labour || 0,
          avgDOT: dot || 0,
          avgSBR: sbr || 0,
          avgRnL: r.rnl_mins || 0,
          avgFoodVar: food || 0,
        };
      }

      // average for period
      let totalActual = 0;
      let totalForecast = 0;
      const lab: number[] = [];
      const dot: number[] = [];
      const sbr: number[] = [];
      const rnl: number[] = [];
      const food: number[] = [];

      for (const r of rowsForStore) {
        if (r.actual_sales != null) totalActual += r.actual_sales;
        if (r.forecast_sales != null) totalForecast += r.forecast_sales;

        const l = normalisePct(r.labour_pct);
        const d = normalisePct(r.dot_pct);
        const s = normalisePct(r.sbr_pct);
        const f = normaliseFoodVar(r.food_var_pct);

        if (l != null) lab.push(l);
        if (d != null) dot.push(d);
        if (s != null) sbr.push(s);
        if (r.rnl_mins != null) rnl.push(r.rnl_mins);
        if (f != null) food.push(f);
      }

      const avg = (arr: number[]) =>
        arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      const variancePct =
        totalForecast > 0 ? (totalActual - totalForecast) / totalForecast : 0;

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
    }).sort((a, b) => {
      if (b.avgDOT !== a.avgDOT) return b.avgDOT - a.avgDOT;
      return a.avgLabour - b.avgLabour;
    });
  }, [dateFilteredRows, dateRange]);

  // manager overview
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

      const l = normalisePct(r.labour_pct);
      const d = normalisePct(r.dot_pct);
      const s = normalisePct(r.sbr_pct);
      const f = normaliseFoodVar(r.food_var_pct);

      if (l != null) bucket[name].labour.push(l);
      if (d != null) bucket[name].dot.push(d);
      if (s != null) bucket[name].sbr.push(s);
      if (r.rnl_mins != null) bucket[name].rnl.push(r.rnl_mins);
      if (f != null) bucket[name].food.push(f);
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

    arr.sort((a, b) => b.avgDOT - a.avgDOT);

    return arr;
  }, [filteredRows]);

  const handleBack = () => {
    if (typeof window !== "undefined") window.history.back();
  };

  const periodLabel =
    dateRange === "yesterday"
      ? "Yesterday"
      : dateRange === "wtd"
      ? "Week to date"
      : dateRange === "mtd"
      ? "Month to date"
      : dateRange === "ytd"
      ? "Year to date"
      : "Custom";

  return (
    <main className="wrap">
      {/* banner */}
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

      {/* header */}
      <header className="header">
        <h1>Mourne-oids Service Dashboard</h1>
        <p className="subtitle">
          Track sales, labour, DOT, SBR, R&amp;L and food variance — by store and by manager.
        </p>
      </header>

      {/* filters */}
      <section className="container wide">
        <div className="filters-panel card soft">
          <div className="filters-block">
            <p className="filters-title">Stores</p>
            <div className="filters">
              <button
                onClick={() => setSelectedStore("all")}
                className={`chip ${selectedStore === "all" ? "chip--active" : ""}`}
              >
                All stores
              </button>
              {STORES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedStore(s)}
                  className={`chip ${selectedStore === s ? "chip--active" : ""}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="filters-block">
            <p className="filters-title">Period</p>
            <div className="filters">
              <button
                onClick={() => setDateRange("yesterday")}
                className={`chip small ${dateRange === "yesterday" ? "chip--active" : ""}`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setDateRange("wtd")}
                className={`chip small ${dateRange === "wtd" ? "chip--active" : ""}`}
              >
                WTD
              </button>
              <button
                onClick={() => setDateRange("mtd")}
                className={`chip small ${dateRange === "mtd" ? "chip--active" : ""}`}
              >
                MTD
              </button>
              <button
                onClick={() => setDateRange("ytd")}
                className={`chip small ${dateRange === "ytd" ? "chip--active" : ""}`}
              >
                YTD
              </button>
              <button
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
                />
              </div>
              <div className="date-field">
                <label>To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* content */}
      <section className="container wide content">
        {loading && <div className="card">Loading Mourne-oids data…</div>}
        {errorMsg && <div className="card error">Error: {errorMsg}</div>}

        {!loading && !errorMsg && (
          <>
            {/* AREA OVERVIEW */}
            <div className="section-head">
              <h2>Area overview</h2>
              <p className="section-sub">{periodLabel}</p>
            </div>
            <div className="kpi-grid">
              <div className="card kpi">
                <p className="kpi-title">Sales (£)</p>
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

            {/* STORE OVERVIEW */}
            <div className="section-head mt">
              <h2>Store overview</h2>
              <p className="section-sub">{periodLabel}</p>
            </div>
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
                  <div className="store-rows">
                    <p className="metric">
                      <span>Sales</span>
                      <strong>£{st.totalActual.toLocaleString()}</strong>
                    </p>
                    <p className="metric">
                      <span>Forecast</span>
                      <strong>
                        {st.totalForecast
                          ? "£" + st.totalForecast.toLocaleString()
                          : "—"}
                      </strong>
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
                      <span>Variance</span>
                      <strong>{(st.variancePct * 100).toFixed(1)}%</strong>
                    </p>
                    <p className="metric">
                      <span>Labour</span>
                      <strong>{(st.avgLabour * 100).toFixed(1)}%</strong>
                    </p>
                    <p className="metric">
                      <span>SBR</span>
                      <strong>{(st.avgSBR * 100).toFixed(0)}%</strong>
                    </p>
                    <p className="metric">
                      <span>R&amp;L</span>
                      <strong>{st.avgRnL.toFixed(1)}m</strong>
                    </p>
                    <p className="metric">
                      <span>Food var</span>
                      <strong>
                        {st.avgFoodVar != null
                          ? st.avgFoodVar.toFixed(2) + "%"
                          : "—"}
                      </strong>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* MANAGER OVERVIEW */}
            <div className="section-head mt">
              <h2>Manager / closing overview</h2>
              <p className="section-sub">{periodLabel}</p>
            </div>
            <div className="card table-card">
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
                          No data for this period.
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

      {/* footer */}
      <footer className="footer">
        <p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>

      {/* styles */}
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
          --border: rgba(15, 23, 42, 0.06);
        }

        .wrap {
          background: var(--bg);
          min-height: 100dvh;
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
          margin: 16px 16px 8px;
        }

        .header h1 {
          font-size: 26px;
          font-weight: 900;
          color: var(--text);
        }

        .subtitle {
          color: var(--muted);
          font-size: 14px;
          margin-top: 3px;
        }

        .container {
          width: 100%;
          max-width: 420px;
          margin-top: 16px;
          display: flex;
          justify-content: center;
        }

        .container.wide {
          max-width: 1100px;
          flex-direction: column;
          gap: 16px;
        }

        .filters-panel {
          display: flex;
          gap: 24px;
          align-items: center;
          justify-content: space-between;
        }

        .filters-panel.soft {
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(4px);
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
          font-weight: 600;
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
          font-weight: 600;
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
          gap: 14px;
          align-items: flex-end;
        }

        .date-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .date-field label {
          font-size: 12px;
          color: var(--muted);
          font-weight: 500;
        }

        .date-field input {
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 10px;
          padding: 5px 8px;
          font-size: 13px;
        }

        .content {
          gap: 20px;
        }

        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
        }

        .section-head.mt {
          margin-top: 26px;
        }

        .section-head h2 {
          font-size: 16px;
          font-weight: 700;
        }

        .section-sub {
          font-size: 12px;
          color: var(--muted);
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .card {
          background: #fff;
          border-radius: 18px;
          box-shadow: var(--shadow-card);
          border: 1px solid rgba(0, 0, 0, 0.02);
        }

        .card.soft {
          box-shadow: none;
        }

        .kpi {
          padding: 14px 16px;
        }

        .kpi-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--muted);
          margin-bottom: 2px;
        }

        .kpi-value {
          font-size: 22px;
          font-weight: 800;
        }

        .kpi-sub {
          font-size: 12px;
          color: var(--muted);
          margin-top: 4px;
        }

        .kpi--green {
          border-left: 4px solid #22c55e;
        }
        .kpi--amber {
          border-left: 4px solid #f97316;
        }
        .kpi--red {
          border-left: 4px solid #ef4444;
        }

        .store-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .store-card {
          padding: 12px 14px 10px;
        }

        .store-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .store-rows {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .metric {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }
        .metric span {
          color: var(--muted);
        }
        .metric.pos strong {
          color: #166534;
        }
        .metric.warn strong {
          color: #b45309;
        }
        .metric.neg strong {
          color: #b91c1c;
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

        .table-card {
          padding: 0;
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
          background: #f0f4f8;
        }

        th,
        td {
          padding: 9px 10px;
          text-align: left;
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

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
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
        }

        .btn--ghost {
          background: #fff;
          border-color: rgba(0, 0, 0, 0.02);
          color: #0f172a;
        }

        .footer {
          text-align: center;
          margin-top: 36px;
          color: var(--muted);
          font-size: 13px;
        }

        @media (max-width: 1100px) {
          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .store-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .filters-panel {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 700px) {
          .store-grid {
            grid-template-columns: 1fr;
          }
          .container.wide {
            max-width: 94%;
          }
        }
      `}</style>
    </main>
  );
}
