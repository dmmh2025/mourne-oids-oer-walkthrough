"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STORES = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"];

type OsaRow = {
  id: string;
  osa_date: string; // yyyy-mm-dd
  team_member_name: string;
  store: string;
  starting_points: number;
  points_lost: number;
  overall_points: number;
  stars: number; // 1-5
  is_elite: boolean;
  created_at?: string;
};

type DateRange = "yesterday" | "wtd" | "mtd" | "ytd" | "custom";

function formatDateGB(yyyyMmDd: string) {
  // safe-ish formatter (avoids timezone surprises in Date parsing)
  const [y, m, d] = yyyyMmDd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return yyyyMmDd;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export default function OsaLeaguePage() {
  const [rows, setRows] = useState<OsaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedStore, setSelectedStore] = useState<"all" | string>("all");
  const [dateRange, setDateRange] = useState<DateRange>("mtd");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      // pull enough history for filters; keep it sensible
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      const dateStr = oneYearAgo.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("osa_internal_results")
        .select("*")
        .gte("osa_date", dateStr)
        .order("osa_date", { ascending: false });

      if (error) setErrorMsg(error.message);
      else setRows((data || []) as OsaRow[]);

      setLoading(false);
    };

    load();
  }, []);

  // date filter
  const dateFiltered = useMemo(() => {
    const now = new Date();

    if (dateRange === "yesterday") {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      return rows.filter((r) => r.osa_date === yStr);
    }

    if (dateRange === "wtd") {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);

      return rows.filter((r) => {
        const d = new Date(r.osa_date);
        return d >= monday && d <= now;
      });
    }

    if (dateRange === "mtd") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return rows.filter((r) => {
        const d = new Date(r.osa_date);
        return d >= first && d <= now;
      });
    }

    if (dateRange === "ytd") {
      const first = new Date(now.getFullYear(), 0, 1);
      return rows.filter((r) => {
        const d = new Date(r.osa_date);
        return d >= first && d <= now;
      });
    }

    if (dateRange === "custom") {
      if (!customFrom && !customTo) return rows;
      return rows.filter((r) => {
        const d = new Date(r.osa_date);
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
  const filtered = useMemo(() => {
    const byStore =
      selectedStore === "all"
        ? dateFiltered
        : dateFiltered.filter((r) => r.store === selectedStore);

    const q = search.trim().toLowerCase();
    if (!q) return byStore;
    return byStore.filter((r) =>
      (r.team_member_name || "").toLowerCase().includes(q)
    );
  }, [dateFiltered, selectedStore, search]);

  // area/period overview KPIs (simple)
  const overview = useMemo(() => {
    if (!filtered.length) {
      return {
        checks: 0,
        avgOverall: 0,
        avgLost: 0,
        eliteCount: 0,
        topScore: 0,
      };
    }
    let sumOverall = 0;
    let sumLost = 0;
    let eliteCount = 0;
    let topScore = 0;

    for (const r of filtered) {
      sumOverall += r.overall_points ?? 0;
      sumLost += r.points_lost ?? 0;
      if (r.is_elite) eliteCount += 1;
      if ((r.overall_points ?? 0) > topScore) topScore = r.overall_points ?? 0;
    }

    return {
      checks: filtered.length,
      avgOverall: sumOverall / filtered.length,
      avgLost: sumLost / filtered.length,
      eliteCount,
      topScore,
    };
  }, [filtered]);

  // ranking aggregation (by team member)
  const leaderboard = useMemo(() => {
    const bucket: Record<
      string,
      {
        name: string;
        checks: number;
        overall: number[];
        lost: number[];
        stars: number[];
        elite: boolean;
        stores: Set<string>;
        latestDate: string; // yyyy-mm-dd
        bestScore: number;
      }
    > = {};

    for (const r of filtered) {
      const name = (r.team_member_name || "Unknown").trim() || "Unknown";
      if (!bucket[name]) {
        bucket[name] = {
          name,
          checks: 0,
          overall: [],
          lost: [],
          stars: [],
          elite: false,
          stores: new Set<string>(),
          latestDate: r.osa_date,
          bestScore: r.overall_points ?? 0,
        };
      }

      const b = bucket[name];
      b.checks += 1;

      if (typeof r.overall_points === "number") b.overall.push(r.overall_points);
      if (typeof r.points_lost === "number") b.lost.push(r.points_lost);
      if (typeof r.stars === "number") b.stars.push(r.stars);

      if (r.is_elite) b.elite = true;
      if (r.store) b.stores.add(r.store);

      if (r.osa_date > b.latestDate) b.latestDate = r.osa_date;
      if ((r.overall_points ?? 0) > b.bestScore) b.bestScore = r.overall_points ?? 0;
    }

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const arr = Object.values(bucket).map((b) => {
      const avgOverall = avg(b.overall);
      const avgLost = avg(b.lost);
      const avgStars = avg(b.stars);

      // "badge stars": elite beats stars, otherwise show rounded avg (min 1)
      const starBadge = b.elite ? "Elite" : `${Math.max(1, Math.round(avgStars))}⭐`;

      return {
        name: b.name,
        checks: b.checks,
        avgOverall,
        avgLost,
        avgStars,
        elite: b.elite,
        stores: Array.from(b.stores),
        latestDate: b.latestDate,
        bestScore: b.bestScore,
        starBadge,
      };
    });

    // rank rules: higher avg overall first; tie -> more checks; then latest date
    arr.sort((a, b) => {
      if (b.avgOverall !== a.avgOverall) return b.avgOverall - a.avgOverall;
      if (b.checks !== a.checks) return b.checks - a.checks;
      return b.latestDate.localeCompare(a.latestDate);
    });

    return arr;
  }, [filtered]);

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

  const pillClassForScore = (score: number) => {
    // tweak these if your scoring bands are different
    if (score >= 110) return "pill--green";
    if (score >= 95) return "pill--amber";
    return "pill--red";
  };

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
        <h1>Internal OSA League</h1>
        <p className="subtitle">
          Rank team members by <b>highest average overall points</b> for the selected period.
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

          <div className="filters-block">
            <p className="filters-title">Search</p>
            <input
              className="search"
              placeholder="Search team member…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
        {loading && <div className="card">Loading OSA results…</div>}
        {errorMsg && <div className="card error">Error: {errorMsg}</div>}

        {!loading && !errorMsg && (
          <>
            {/* Overview KPIs */}
            <div className="section-head">
              <h2>Overview</h2>
              <p className="section-sub">{periodLabel}</p>
            </div>

            <div className="kpi-grid kpi-grid--5">
              <div className="card kpi">
                <p className="kpi-title">Checks</p>
                <p className="kpi-value">{overview.checks}</p>
                <p className="kpi-sub">Submitted in this period</p>
              </div>

              <div className="card kpi">
                <p className="kpi-title">Avg Overall</p>
                <p className="kpi-value">{overview.avgOverall.toFixed(1)}</p>
                <p className="kpi-sub">Higher is better</p>
              </div>

              <div className="card kpi">
                <p className="kpi-title">Avg Points Lost</p>
                <p className="kpi-value">{overview.avgLost.toFixed(1)}</p>
                <p className="kpi-sub">Lower is better</p>
              </div>

              <div className="card kpi">
                <p className="kpi-title">Elite checks</p>
                <p className="kpi-value">{overview.eliteCount}</p>
                <p className="kpi-sub">Marked Elite</p>
              </div>

              <div className="card kpi">
                <p className="kpi-title">Top Score</p>
                <p className="kpi-value">{overview.topScore}</p>
                <p className="kpi-sub">Best overall points</p>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="section-head mt">
              <h2>Leaderboard</h2>
              <p className="section-sub">
                Ranked by avg overall points (tie: more checks, then latest date)
              </p>
            </div>

            <div className="grid">
              {leaderboard.length === 0 ? (
                <div className="card store-card">
                  <div className="store-rows">
                    <p className="metric">
                      <span>No data for this period.</span>
                      <strong>—</strong>
                    </p>
                  </div>
                </div>
              ) : (
                leaderboard.map((p, idx) => (
                  <div key={p.name} className="card store-card">
                    <div className="store-card__header">
                      <div className="store-card__title">
                        <span className="rank-badge" title="Rank">
                          #{idx + 1}
                        </span>
                        <h3>{p.name}</h3>
                      </div>

                      <div className="right-pills">
                        <span className={`pill ${pillClassForScore(p.avgOverall)}`}>
                          {p.avgOverall.toFixed(1)} pts
                        </span>
                        <span className={`pill ${p.elite ? "pill--elite" : "pill--neutral"}`}>
                          {p.starBadge}
                        </span>
                      </div>
                    </div>

                    <div className="store-rows">
                      <p className="metric">
                        <span>Checks</span>
                        <strong>{p.checks}</strong>
                      </p>

                      <p className="metric">
                        <span>Avg points lost</span>
                        <strong>{p.avgLost.toFixed(1)}</strong>
                      </p>

                      <p className="metric">
                        <span>Best score</span>
                        <strong>{p.bestScore}</strong>
                      </p>

                      <p className="metric">
                        <span>Latest check</span>
                        <strong>{formatDateGB(p.latestDate)}</strong>
                      </p>

                      <p className="metric">
                        <span>Store(s)</span>
                        <strong className="nowrap">
                          {selectedStore === "all" ? p.stores.join(", ") || "—" : selectedStore}
                        </strong>
                      </p>
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

      {/* styles (match your existing look/feel) */}
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
          flex-wrap: wrap;
        }

        .card {
          background: #fff;
          border-radius: 18px;
          box-shadow: var(--shadow-card);
          border: 1px solid rgba(0, 0, 0, 0.02);
        }

        .card.soft {
          box-shadow: none;
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(4px);
        }

        .filters-block {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 220px;
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

        .search {
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 13px;
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

        .kpi-grid--5 {
          grid-template-columns: repeat(5, minmax(0, 1fr));
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

        .grid {
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
          gap: 10px;
        }

        .store-card__title {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .rank-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 26px;
          min-width: 44px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.1);
          color: var(--brand-dark);
          border: 1px solid rgba(0, 100, 145, 0.18);
          font-weight: 800;
          font-size: 12px;
        }

        .right-pills {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }

        h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 800;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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

        .nowrap {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 220px;
          text-align: right;
        }

        .pill {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 999px;
          white-space: nowrap;
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
        .pill--neutral {
          background: rgba(15, 23, 42, 0.06);
          color: #0f172a;
        }
        .pill--elite {
          background: rgba(124, 58, 237, 0.12);
          color: #5b21b6;
          border: 1px solid rgba(124, 58, 237, 0.25);
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

        .error {
          padding: 14px 16px;
          border-left: 4px solid #ef4444;
        }

        @media (max-width: 1100px) {
          .kpi-grid,
          .kpi-grid--5 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .grid {
            grid-template-columns: 1fr;
          }
          .container.wide {
            max-width: 94%;
          }
          .filters-block {
            min-width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
