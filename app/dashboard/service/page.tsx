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
  week: number | null;
  shift_date: string;
  day_name: string | null;
  store: string;

  labour_pct: number | null;
  additional_hours: number | null;
  manager: string | null;

  dot_pct: number | null;
  rnl_minutes: number | null;

  extreme_over_40: number | null; // count or number you enter
  food_pct: number | null; // % you enter
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

  // Converts 24.5 or 78 into 0.245 / 0.78; leaves 0.245 as-is
  const normalisePct = (v: number | null) => {
    if (v == null) return null;
    return v > 1 ? v / 100 : v;
  };

  // Food % is a % metric, same behaviour as normalisePct
  const normaliseFoodPct = (v: number | null) => {
    if (v == null) return null;
    return v > 1 ? v / 100 : v;
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

  // store filter (affects area + manager overview, keeps your existing behaviour)
  const filteredRows = useMemo(() => {
    if (selectedStore === "all") return dateFilteredRows;
    return dateFilteredRows.filter((r) => r.store === selectedStore);
  }, [dateFilteredRows, selectedStore]);

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  // AREA OVERVIEW (updated to match new recorded fields)
  const kpis = useMemo(() => {
    if (filteredRows.length === 0) {
      return {
        avgLabour: 0,
        avgDOT: 0,
        avgRnL: 0,
        avgExtremeOver40: 0,
        avgFoodPct: 0,
        shifts: 0,
      };
    }

    const labourVals: number[] = [];
    const dotVals: number[] = [];
    const rnlVals: number[] = [];
    const extremeVals: number[] = [];
    const foodVals: number[] = [];

    for (const r of filteredRows) {
      const labour = normalisePct(r.labour_pct);
      if (labour != null) labourVals.push(labour);

      const dot = normalisePct(r.dot_pct);
      if (dot != null) dotVals.push(dot);

      if (r.rnl_minutes != null) rnlVals.push(r.rnl_minutes);

      if (r.extreme_over_40 != null) extremeVals.push(r.extreme_over_40);

      const food = normaliseFoodPct(r.food_pct);
      if (food != null) foodVals.push(food);
    }

    return {
      avgLabour: avg(labourVals),
      avgDOT: avg(dotVals),
      avgRnL: avg(rnlVals),
      avgExtremeOver40: avg(extremeVals),
      avgFoodPct: avg(foodVals),
      shifts: filteredRows.length,
    };
  }, [filteredRows]);

  // STORE OVERVIEW (area-style + ranked by DOT desc then Labour asc)
  const storeOverview = useMemo(() => {
    const data = STORES.map((storeName) => {
      const rowsForStore = dateFilteredRows.filter((r) => r.store === storeName);

      const lab: number[] = [];
      const dot: number[] = [];
      const rnl: number[] = [];
      const ext: number[] = [];
      const food: number[] = [];

      for (const r of rowsForStore) {
        const l = normalisePct(r.labour_pct);
        const d = normalisePct(r.dot_pct);
        const f = normaliseFoodPct(r.food_pct);

        if (l != null) lab.push(l);
        if (d != null) dot.push(d);
        if (r.rnl_minutes != null) rnl.push(r.rnl_minutes);
        if (r.extreme_over_40 != null) ext.push(r.extreme_over_40);
        if (f != null) food.push(f);
      }

      return {
        store: storeName,
        shifts: rowsForStore.length,
        avgLabour: avg(lab),
        avgDOT: avg(dot),
        avgRnL: avg(rnl),
        avgExtremeOver40: avg(ext),
        avgFoodPct: avg(food),
      };
    });

    data.sort((a, b) => {
      if (b.avgDOT !== a.avgDOT) return b.avgDOT - a.avgDOT;
      return a.avgLabour - b.avgLabour;
    });

    return data;
  }, [dateFilteredRows]);

  // MANAGER OVERVIEW (area-style + ranked by DOT desc then Labour asc)
  const managerOverview = useMemo(() => {
    const bucket: Record<
      string,
      {
        shifts: number;
        labour: number[];
        dot: number[];
        rnl: number[];
        ext: number[];
        food: number[];
      }
    > = {};

    for (const r of filteredRows) {
      const name = (r.manager || "").trim() || "Unknown";
      if (!bucket[name]) {
        bucket[name] = { shifts: 0, labour: [], dot: [], rnl: [], ext: [], food: [] };
      }

      bucket[name].shifts += 1;

      const l = normalisePct(r.labour_pct);
      const d = normalisePct(r.dot_pct);
      const f = normaliseFoodPct(r.food_pct);

      if (l != null) bucket[name].labour.push(l);
      if (d != null) bucket[name].dot.push(d);
      if (r.rnl_minutes != null) bucket[name].rnl.push(r.rnl_minutes);
      if (r.extreme_over_40 != null) bucket[name].ext.push(r.extreme_over_40);
      if (f != null) bucket[name].food.push(f);
    }

    const arr = Object.entries(bucket).map(([name, v]) => ({
      name,
      shifts: v.shifts,
      avgLabour: avg(v.labour),
      avgDOT: avg(v.dot),
      avgRnL: avg(v.rnl),
      avgExtremeOver40: avg(v.ext),
      avgFoodPct: avg(v.food),
    }));

    arr.sort((a, b) => {
      if (b.avgDOT !== a.avgDOT) return b.avgDOT - a.avgDOT;
      return a.avgLabour - b.avgLabour;
    });

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
          Track Labour, DOT, R&amp;L, Extreme &gt;40, and Food % — by store and by manager.
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
              <p className="section-sub">
                {periodLabel} · {kpis.shifts} shift(s)
              </p>
            </div>
            <div className="kpi-grid">
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
                <p className="kpi-value">{(kpis.avgLabour * 100).toFixed(1)}%</p>
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
                <p className="kpi-value">{(kpis.avgDOT * 100).toFixed(0)}%</p>
                <p className="kpi-sub">Target: 80%+</p>
              </div>

              <div
                className={`card kpi ${
                  kpis.avgRnL <= 9
                    ? "kpi--green"
                    : kpis.avgRnL <= 10
                    ? "kpi--amber"
                    : "kpi--red"
                }`}
              >
                <p className="kpi-title">Avg R&amp;L</p>
                <p className="kpi-value">{kpis.avgRnL.toFixed(1)}m</p>
                <p className="kpi-sub">Target: ≤ 9m</p>
              </div>

              <div
                className={`card kpi ${
                  kpis.avgExtremeOver40 <= 0
                    ? "kpi--green"
                    : kpis.avgExtremeOver40 <= 1
                    ? "kpi--amber"
                    : "kpi--red"
                }`}
              >
                <p className="kpi-title">Avg Extreme &gt;40</p>
                <p className="kpi-value">{kpis.avgExtremeOver40.toFixed(1)}</p>
                <p className="kpi-sub">Lower is better</p>
              </div>

              <div className="card kpi">
                <p className="kpi-title">Avg Food %</p>
                <p className="kpi-value">{(kpis.avgFoodPct * 100).toFixed(2)}%</p>
                <p className="kpi-sub">Trend metric</p>
              </div>
            </div>

            {/* STORE OVERVIEW (AREA-STYLE PER STORE) */}
            <div className="section-head mt">
              <h2>Store overview</h2>
              <p className="section-sub">
                Ranked by DOT% then Labour% · {periodLabel}
              </p>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {storeOverview.map((st) => (
                <div key={st.store}>
                  <div className="section-head" style={{ marginTop: 0 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800 }}>{st.store}</h2>
                    <p className="section-sub">{st.shifts} shift(s)</p>
                  </div>

                  <div className="kpi-grid">
                    <div
                      className={`card kpi ${
                        st.avgLabour <= 0.25
                          ? "kpi--green"
                          : st.avgLabour <= 0.28
                          ? "kpi--amber"
                          : "kpi--red"
                      }`}
                    >
                      <p className="kpi-title">Avg Labour %</p>
                      <p className="kpi-value">
                        {(st.avgLabour * 100).toFixed(1)}%
                      </p>
                      <p className="kpi-sub">Target: 25%</p>
                    </div>

                    <div
                      className={`card kpi ${
                        st.avgDOT >= 0.8
                          ? "kpi--green"
                          : st.avgDOT >= 0.75
                          ? "kpi--amber"
                          : "kpi--red"
                      }`}
                    >
                      <p className="kpi-title">Avg DOT %</p>
                      <p className="kpi-value">
                        {(st.avgDOT * 100).toFixed(0)}%
                      </p>
                      <p className="kpi-sub">Target: 80%+</p>
                    </div>

                    <div
                      className={`card kpi ${
                        st.avgRnL <= 9
                          ? "kpi--green"
                          : st.avgRnL <= 10
                          ? "kpi--amber"
                          : "kpi--red"
                      }`}
                    >
                      <p className="kpi-title">Avg R&amp;L</p>
                      <p className="kpi-value">{st.avgRnL.toFixed(1)}m</p>
                      <p className="kpi-sub">Target: ≤ 9m</p>
                    </div>

                    <div
                      className={`card kpi ${
                        st.avgExtremeOver40 <= 0
                          ? "kpi--green"
                          : st.avgExtremeOver40 <= 1
                          ? "kpi--amber"
                          : "kpi--red"
                      }`}
                    >
                      <p className="kpi-title">Avg Extreme &gt;40</p>
                      <p className="kpi-value">
                        {st.avgExtremeOver40.toFixed(1)}
                      </p>
                      <p className="kpi-sub">Lower is better</p>
                    </div>

                    <div className="card kpi">
                      <p className="kpi-title">Avg Food %</p>
                      <p className="kpi-value">
                        {(st.avgFoodPct * 100).toFixed(2)}%
                      </p>
                      <p className="kpi-sub">Trend metric</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* MANAGER OVERVIEW (AREA-STYLE PER MANAGER) */}
            <div className="section-head mt">
              <h2>Manager overview</h2>
              <p className="section-sub">
                Ranked by DOT% then Labour% · {periodLabel}
              </p>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {managerOverview.length === 0 ? (
                <div className="card" style={{ padding: 14 }}>
                  No data for this period.
                </div>
              ) : (
                managerOverview.map((mgr) => (
                  <div key={mgr.name}>
                    <div className="section-head" style={{ marginTop: 0 }}>
                      <h2 style={{ fontSize: 16, fontWeight: 800 }}>{mgr.name}</h2>
                      <p className="section-sub">{mgr.shifts} shift(s)</p>
                    </div>

                    <div className="kpi-grid">
                      <div
                        className={`card kpi ${
                          mgr.avgLabour <= 0.25
                            ? "kpi--green"
                            : mgr.avgLabour <= 0.28
                            ? "kpi--amber"
                            : "kpi--red"
                        }`}
                      >
                        <p className="kpi-title">Avg Labour %</p>
                        <p className="kpi-value">
                          {(mgr.avgLabour * 100).toFixed(1)}%
                        </p>
                        <p className="kpi-sub">Target: 25%</p>
                      </div>

                      <div
                        className={`card kpi ${
                          mgr.avgDOT >= 0.8
                            ? "kpi--green"
                            : mgr.avgDOT >= 0.75
                            ? "kpi--amber"
                            : "kpi--red"
                        }`}
                      >
                        <p className="kpi-title">Avg DOT %</p>
                        <p className="kpi-value">
                          {(mgr.avgDOT * 100).toFixed(0)}%
                        </p>
                        <p className="kpi-sub">Target: 80%+</p>
                      </div>

                      <div
                        className={`card kpi ${
                          mgr.avgRnL <= 9
                            ? "kpi--green"
                            : mgr.avgRnL <= 10
                            ? "kpi--amber"
                            : "kpi--red"
                        }`}
                      >
                        <p className="kpi-title">Avg R&amp;L</p>
                        <p className="kpi-value">{mgr.avgRnL.toFixed(1)}m</p>
                        <p className="kpi-sub">Target: ≤ 9m</p>
                      </div>

                      <div
                        className={`card kpi ${
                          mgr.avgExtremeOver40 <= 0
                            ? "kpi--green"
                            : mgr.avgExtremeOver40 <= 1
                            ? "kpi--amber"
                            : "kpi--red"
                        }`}
                      >
                        <p className="kpi-title">Avg Extreme &gt;40</p>
                        <p className="kpi-value">
                          {mgr.avgExtremeOver40.toFixed(1)}
                        </p>
                        <p className="kpi-sub">Lower is better</p>
                      </div>

                      <div className="card kpi">
                        <p className="kpi-title">Avg Food %</p>
                        <p className="kpi-value">
                          {(mgr.avgFoodPct * 100).toFixed(2)}%
                        </p>
                        <p className="kpi-sub">Trend metric</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </section>

      {/* footer */}
      <footer className="footer">
        <p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>

      {/* styles (UNCHANGED) */}
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
          .filters-panel {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 700px) {
          .container.wide {
            max-width: 94%;
          }
        }
      `}</style>
    </main>
  );
}
