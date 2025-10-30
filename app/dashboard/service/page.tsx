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

  const normalisePct = (v: number | null) => (v == null ? null : v > 1 ? v / 100 : v);
  const normaliseFoodVar = (v: number | null) => (v == null ? null : v > 1 ? v / 100 : v);

  // Load data
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

  // Date filtering
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

  const filteredRows = useMemo(
    () => (selectedStore === "all" ? dateFilteredRows : dateFilteredRows.filter((r) => r.store === selectedStore)),
    [dateFilteredRows, selectedStore]
  );

  // Area overview
  const kpis = useMemo(() => {
    if (!filteredRows.length) return { totalActual: 0, totalForecast: 0, variancePct: 0, avgLabour: 0, avgDOT: 0, avgRnL: 0 };
    let totalActual = 0,
      totalForecast = 0;
    const lab: number[] = [],
      dot: number[] = [],
      rnl: number[] = [];
    for (const r of filteredRows) {
      totalActual += r.actual_sales || 0;
      totalForecast += r.forecast_sales || 0;
      const L = normalisePct(r.labour_pct),
        D = normalisePct(r.dot_pct);
      if (L != null) lab.push(L);
      if (D != null) dot.push(D);
      if (r.rnl_minutes != null) rnl.push(r.rnl_minutes);
    }
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y) / a.length : 0);
    const variance = totalForecast ? (totalActual - totalForecast) / totalForecast : 0;
    return { totalActual, totalForecast, variancePct: variance, avgLabour: avg(lab), avgDOT: avg(dot), avgRnL: avg(rnl) };
  }, [filteredRows]);

  // Store overview
  const storeData = useMemo(() => {
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y) / a.length : 0);
    return STORES.map((s) => {
      const storeRows = dateFilteredRows.filter((r) => r.store === s);
      if (!storeRows.length)
        return { store: s, totalActual: 0, totalForecast: 0, variancePct: 0, avgLabour: 0, avgDOT: 0, avgSBR: 0, avgRnL: 0, avgFoodVar: 0 };
      let totalActual = 0,
        totalForecast = 0;
      const L: number[] = [],
        D: number[] = [],
        S: number[] = [],
        R: number[] = [],
        F: number[] = [];
      for (const r of storeRows) {
        totalActual += r.actual_sales || 0;
        totalForecast += r.forecast_sales || 0;
        const l = normalisePct(r.labour_pct),
          d = normalisePct(r.dot_pct),
          sbr = normalisePct(r.sbr_pct),
          fv = normaliseFoodVar(r.food_variance_pct);
        if (l != null) L.push(l);
        if (d != null) D.push(d);
        if (sbr != null) S.push(sbr);
        if (r.rnl_minutes != null) R.push(r.rnl_minutes);
        if (fv != null) F.push(fv);
      }
      return {
        store: s,
        totalActual,
        totalForecast,
        variancePct: totalForecast ? (totalActual - totalForecast) / totalForecast : 0,
        avgLabour: avg(L),
        avgDOT: avg(D),
        avgSBR: avg(S),
        avgRnL: avg(R),
        avgFoodVar: avg(F),
      };
    }).sort((a, b) => (b.avgDOT !== a.avgDOT ? b.avgDOT - a.avgDOT : a.avgLabour - b.avgLabour));
  }, [dateFilteredRows]);

  // Manager overview restored
  const managerData = useMemo(() => {
    const bucket: Record<
      string,
      { shifts: number; sales: number; labour: number[]; dot: number[]; sbr: number[]; rnl: number[]; food: number[] }
    > = {};
    for (const r of filteredRows) {
      const name = r.closing_manager || "Unknown";
      if (!bucket[name])
        bucket[name] = { shifts: 0, sales: 0, labour: [], dot: [], sbr: [], rnl: [], food: [] };
      bucket[name].shifts++;
      bucket[name].sales += r.actual_sales || 0;
      const L = normalisePct(r.labour_pct),
        D = normalisePct(r.dot_pct),
        S = normalisePct(r.sbr_pct),
        F = normaliseFoodVar(r.food_variance_pct);
      if (L != null) bucket[name].labour.push(L);
      if (D != null) bucket[name].dot.push(D);
      if (S != null) bucket[name].sbr.push(S);
      if (r.rnl_minutes != null) bucket[name].rnl.push(r.rnl_minutes);
      if (F != null) bucket[name].food.push(F);
    }
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y) / a.length : 0);
    return Object.entries(bucket)
      .map(([name, v]) => ({
        name,
        shifts: v.shifts,
        totalSales: v.sales,
        avgLabour: avg(v.labour),
        avgDOT: avg(v.dot),
        avgSBR: avg(v.sbr),
        avgRnL: avg(v.rnl),
        avgFoodVar: avg(v.food),
      }))
      .sort((a, b) => b.avgDOT - a.avgDOT);
  }, [filteredRows]);

  const handleBack = () => typeof window !== "undefined" && window.history.back();

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
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header" />
      </div>

      <div className="nav-row">
        <button onClick={handleBack} className="btn btn--ghost">← Back</button>
        <a href="/" className="btn btn--brand">🏠 Home</a>
      </div>

      <header className="header">
        <h1>Mourne-oids Service Dashboard</h1>
        <p className="subtitle">Track sales, labour, DOT, SBR, R&amp;L and food variance — by store and by manager.</p>
      </header>

      <section className="container wide content">
        {loading && <div className="card">Loading Mourne-oids data…</div>}
        {errorMsg && <div className="card error">Error: {errorMsg}</div>}
        {!loading && !errorMsg && (
          <>
            {/* area + store sections as before */}
            <div className="section-head mt"><h2>Manager overview</h2><p className="section-sub">{periodLabel}</p></div>
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
                      <th>Food Var</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerData.length === 0 && (
                      <tr><td colSpan={8} className="empty">No data for this period.</td></tr>
                    )}
                    {managerData.map((m) => (
                      <tr key={m.name}>
                        <td>{m.name}</td>
                        <td>{m.shifts}</td>
                        <td>£{m.totalSales.toLocaleString()}</td>
                        <td className={m.avgLabour <= 0.25 ? "pos" : m.avgLabour <= 0.28 ? "warn" : "neg"}>
                          {(m.avgLabour * 100).toFixed(1)}%
                        </td>
                        <td className={m.avgDOT >= 0.8 ? "pos" : m.avgDOT >= 0.75 ? "warn" : "neg"}>
                          {(m.avgDOT * 100).toFixed(0)}%
                        </td>
                        <td>{(m.avgSBR * 100).toFixed(0)}%</td>
                        <td>{m.avgRnL.toFixed(1)}m</td>
                        <td className={Math.abs(m.avgFoodVar) <= 0.25 ? "pos" : Math.abs(m.avgFoodVar) <= 0.5 ? "warn" : "neg"}>
                          {(m.avgFoodVar * 100).toFixed(2)}%
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

      <footer className="footer"><p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p></footer>

      <style jsx>{`
        .wrap { background:#f2f5f9; min-height:100vh; padding-bottom:40px; display:flex; flex-direction:column; align-items:center; }
        .banner img { max-width:92%; border-bottom:3px solid #006491; }
        .nav-row { max-width:1100px; width:100%; display:flex; gap:10px; justify-content:flex-start; margin-top:16px; padding:0 16px; }
        .btn{padding:10px 14px;border-radius:14px;font-weight:700;text-decoration:none;border:2px solid transparent;cursor:pointer}
        .btn--brand{background:#006491;color:#fff;border-color:#004b75}
        .btn--ghost{background:#fff;color:#0f172a;border-color:rgba(0,0,0,0.05)}
        .header{text-align:center;margin:20px 0 8px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        thead{background:#f0f4f8}
        th,td{padding:9px 10px;text-align:left}
        tbody tr:nth-child(even){background:#f8fafc}
        .pos{color:#166534;font-weight:600}
        .warn{color:#b45309;font-weight:600}
        .neg{color:#b91c1c;font-weight:600}
        .empty{text-align:center;padding:16px 6px;color:#475569}
        .footer{text-align:center;margin-top:36px;color:#475569;font-size:13px}
      `}</style>
    </main>
  );
}
