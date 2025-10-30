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
  actual_instores: number | null;
  drivers_scheduled: number | null;
  actual_drivers: number | null;
  dot_pct: number | null;
  extremes_pct: number | null;
  sbr_pct: number | null;
  rnl_minutes: number | null;
  food_variance_pct: number | null;
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

      if (error) setErrorMsg(error.message);
      else setRows((data || []) as ShiftRow[]);
      setLoading(false);
    };
    load();
  }, []);

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
      return rows.filter((r) => new Date(r.shift_date) >= monday && new Date(r.shift_date) <= now);
    }
    if (dateRange === "mtd") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return rows.filter((r) => new Date(r.shift_date) >= first && new Date(r.shift_date) <= now);
    }
    if (dateRange === "ytd") {
      const first = new Date(now.getFullYear(), 0, 1);
      return rows.filter((r) => new Date(r.shift_date) >= first && new Date(r.shift_date) <= now);
    }
    if (dateRange === "custom") {
      return rows.filter((r) => {
        const d = new Date(r.shift_date);
        if (customFrom && d < new Date(customFrom)) return false;
        if (customTo && d > new Date(customTo)) return false;
        return true;
      });
    }
    return rows;
  }, [rows, dateRange, customFrom, customTo]);

  const filteredRows = useMemo(() => {
    if (selectedStore === "all") return dateFilteredRows;
    return dateFilteredRows.filter((r) => r.store === selectedStore);
  }, [dateFilteredRows, selectedStore]);

  // --- KPIs ---
  const kpis = useMemo(() => {
    if (!filteredRows.length)
      return { totalActual: 0, totalForecast: 0, variancePct: 0, avgLabour: 0, avgDOT: 0, avgRnL: 0 };

    let totalActual = 0;
    let totalForecast = 0;
    const labourVals: number[] = [];
    const dotVals: number[] = [];
    const rnlVals: number[] = [];

    for (const r of filteredRows) {
      totalActual += r.actual_sales || 0;
      totalForecast += r.forecast_sales || 0;
      const l = normalisePct(r.labour_pct);
      const d = normalisePct(r.dot_pct);
      if (l != null) labourVals.push(l);
      if (d != null) dotVals.push(d);
      if (r.rnl_minutes != null) rnlVals.push(r.rnl_minutes);
    }

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b) / arr.length : 0);
    const variancePct = totalForecast ? (totalActual - totalForecast) / totalForecast : 0;

    return {
      totalActual,
      totalForecast,
      variancePct,
      avgLabour: avg(labourVals),
      avgDOT: avg(dotVals),
      avgRnL: avg(rnlVals),
    };
  }, [filteredRows]);

  // --- Store breakdown ---
  const storeData = useMemo(() => {
    return STORES.map((s) => {
      const storeRows = dateFilteredRows.filter((r) => r.store === s);
      if (!storeRows.length)
        return { store: s, totalActual: 0, totalForecast: 0, variancePct: 0, avgLabour: 0, avgDOT: 0, avgSBR: 0, avgRnL: 0, avgFoodVar: 0 };

      let totalActual = 0;
      let totalForecast = 0;
      const l: number[] = [];
      const d: number[] = [];
      const sbr: number[] = [];
      const rnl: number[] = [];
      const food: number[] = [];

      for (const r of storeRows) {
        totalActual += r.actual_sales || 0;
        totalForecast += r.forecast_sales || 0;
        const L = normalisePct(r.labour_pct);
        const D = normalisePct(r.dot_pct);
        const S = normalisePct(r.sbr_pct);
        const F = normaliseFoodVar(r.food_variance_pct);
        if (L != null) l.push(L);
        if (D != null) d.push(D);
        if (S != null) sbr.push(S);
        if (r.rnl_minutes != null) rnl.push(r.rnl_minutes);
        if (F != null) food.push(F);
      }

      const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b) / arr.length : 0);
      const variancePct = totalForecast ? (totalActual - totalForecast) / totalForecast : 0;

      return {
        store: s,
        totalActual,
        totalForecast,
        variancePct,
        avgLabour: avg(l),
        avgDOT: avg(d),
        avgSBR: avg(sbr),
        avgRnL: avg(rnl),
        avgFoodVar: avg(food),
      };
    }).sort((a, b) => (b.avgDOT !== a.avgDOT ? b.avgDOT - a.avgDOT : a.avgLabour - b.avgLabour));
  }, [dateFilteredRows]);

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
      <div className="banner">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <div className="nav-row">
        <button onClick={handleBack} className="btn btn--ghost">← Back</button>
        <a href="/" className="btn btn--brand">🏠 Home</a>
      </div>

      <header className="header">
        <h1>Mourne-oids Service Dashboard</h1>
        <p className="subtitle">
          Track sales, labour, DOT, SBR, R&amp;L and food variance — by store and by manager.
        </p>
      </header>

      <section className="container wide content">
        {loading && <div className="card">Loading Mourne-oids data…</div>}
        {errorMsg && <div className="card error">Error: {errorMsg}</div>}

        {!loading && !errorMsg && (
          <>
            {/* === AREA OVERVIEW === */}
            <div className="section-head">
              <h2>Area overview</h2>
              <p className="section-sub">{periodLabel}</p>
            </div>
            <div className="kpi-grid">
              <div className="card kpi">
                <p className="kpi-title">Sales (£)</p>
                <p className="kpi-value">£{kpis.totalActual.toLocaleString()}</p>
                <p className="kpi-sub">vs £{kpis.totalForecast.toLocaleString()} forecast</p>
              </div>

              <div className={`card kpi ${kpis.variancePct >= 0 ? "kpi--green" : kpis.variancePct >= -0.05 ? "kpi--amber" : "kpi--red"}`}>
                <p className="kpi-title">Variance %</p>
                <p className="kpi-value">{(kpis.variancePct * 100).toFixed(1)}%</p>
              </div>

              <div className={`card kpi ${kpis.avgLabour <= 0.25 ? "kpi--green" : kpis.avgLabour <= 0.28 ? "kpi--amber" : "kpi--red"}`}>
                <p className="kpi-title">Avg Labour %</p>
                <p className="kpi-value">{(kpis.avgLabour * 100).toFixed(1)}%</p>
              </div>

              <div className={`card kpi ${kpis.avgDOT >= 0.8 ? "kpi--green" : kpis.avgDOT >= 0.75 ? "kpi--amber" : "kpi--red"}`}>
                <p className="kpi-title">Avg DOT %</p>
                <p className="kpi-value">{(kpis.avgDOT * 100).toFixed(0)}%</p>
              </div>
            </div>

            {/* === STORE OVERVIEW === */}
            <div className="section-head mt">
              <h2>Store overview</h2>
              <p className="section-sub">{periodLabel}</p>
            </div>
            <div className="store-grid">
              {storeData.map((st) => (
                <div key={st.store} className="card store-card">
                  <div className="store-card__header">
                    <h3>{st.store}</h3>
                    <span className={`pill ${st.avgDOT >= 0.8 ? "pill--green" : st.avgDOT >= 0.75 ? "pill--amber" : "pill--red"}`}>
                      {Math.round(st.avgDOT * 100)}% DOT
                    </span>
                  </div>
                  <div className="store-rows">
                    <p className="metric"><span>Sales</span> <strong>£{st.totalActual.toLocaleString()}</strong></p>
                    <p className="metric"><span>Forecast</span> <strong>£{st.totalForecast.toLocaleString()}</strong></p>
                    <p className={`metric ${st.variancePct >= 0 ? "pos" : st.variancePct >= -0.05 ? "warn" : "neg"}`}>
                      <span>Variance</span> <strong>{(st.variancePct * 100).toFixed(1)}%</strong>
                    </p>
                    <p className={`metric ${st.avgLabour <= 0.25 ? "pos" : st.avgLabour <= 0.28 ? "warn" : "neg"}`}>
                      <span>Labour</span> <strong>{(st.avgLabour * 100).toFixed(1)}%</strong>
                    </p>
                    <p className={`metric ${st.avgSBR >= 0.75 ? "pos" : st.avgSBR >= 0.65 ? "warn" : "neg"}`}>
                      <span>SBR</span> <strong>{(st.avgSBR * 100).toFixed(0)}%</strong>
                    </p>
                    <p className="metric"><span>R&amp;L</span> <strong>{st.avgRnL.toFixed(1)}m</strong></p>
                    <p className={`metric ${Math.abs(st.avgFoodVar) <= 0.25 ? "pos" : Math.abs(st.avgFoodVar) <= 0.5 ? "warn" : "neg"}`}>
                      <span>Food var</span> <strong>{st.avgFoodVar.toFixed(2)}%</strong>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <footer className="footer">
        <p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>

      <style jsx>{`
        .wrap { background:#f2f5f9; min-height:100vh; padding-bottom:40px; display:flex; flex-direction:column; align-items:center; }
        .banner img { max-width:92%; border-bottom:3px solid #006491; box-shadow:0 2px 4px rgba(0,0,0,0.1); }
        .nav-row { width:100%; max-width:1100px; display:flex; gap:10px; justify-content:flex-start; margin-top:16px; padding:0 16px; }
        .btn{padding:10px 14px;border-radius:14px;font-weight:700;text-decoration:none;border:2px solid transparent;cursor:pointer}
        .btn--brand{background:#006491;color:#fff;border-color:#004b75}
        .btn--ghost{background:#fff;color:#0f172a;border-color:rgba(0,0,0,0.05)}
        .header{text-align:center;margin:20px 0 8px}
        .header h1{font-size:26px;font-weight:900;color:#0f172a}
        .subtitle{color:#475569;font-size:14px}
        .container.wide{max-width:1100px;flex-direction:column;gap:16px}
        .section-head{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
        .section-head h2{font-size:16px;font-weight:700}
        .section-sub{font-size:12px;color:#475569}
        .kpi-grid,.store-grid{display:grid;gap:14px}
        .kpi-grid{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
        .store-grid{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
        .card{background:#fff;border-radius:18px;box-shadow:0 4px 10px rgba(0,0,0,0.05);padding:14px 16px}
        .kpi-title{font-size:12px;color:#475569;text-transform:uppercase}
        .kpi-value{font-size:22px;font-weight:800}
        .kpi--green{border-left:4px solid #22c55e}
        .kpi--amber{border-left:4px solid #f59e0b}
        .kpi--red{border-left:4px solid #ef4444}
        .metric.pos strong{color:#166534}
        .metric.warn strong{color:#b45309}
        .metric.neg strong{color:#b91c1c}
        .pill{font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px}
        .pill--green{background:rgba(34,197,94,0.15);color:#166534}
        .pill--amber{background:rgba(249,115,22,0.15);color:#9a3412}
        .pill--red{background:rgba(239,68,68,0.15);color:#991b1b}
        .footer{text-align:center;margin-top:40px;color:#475569;font-size:13px}
      `}</style>
    </main>
  );
}
