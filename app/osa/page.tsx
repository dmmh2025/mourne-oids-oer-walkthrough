"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
      )
    : null;

const STORES = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"] as const;

type DateRange = "yesterday" | "wtd" | "mtd" | "ytd" | "custom";
type SortMode = "points" | "stars" | "recent";

/**
 * ✅ Adjust these field names if your Supabase columns differ.
 */
type OsaRow = {
  id: string;
  shift_date: string; // YYYY-MM-DD
  team_member_name: string;
  store: string;
  starting_points: number | null;
  points_lost: number | null;
  overall_points: number | null;
  star_rating: number | null; // 1-5, >5 = Elite
  created_at?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function asNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatDateGB(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function getMonday(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getStarLabel(stars: number | null) {
  if (stars == null) return "—";
  if (stars > 5) return "ELITE";
  return `${stars}⭐`;
}

function medalForRank(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

export default function OsaLeaderboardPage() {
  const [rows, setRows] = useState<OsaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedStore, setSelectedStore] = useState<"all" | string>("all");

  const [dateRange, setDateRange] = useState<DateRange>("wtd");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [sortMode, setSortMode] = useState<SortMode>("points");

  // Load
  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setErrorMsg("Supabase client not available");
        setLoading(false);
        return;
      }

      // pull last ~120 days for speed; filters do the rest client-side
      const since = new Date();
      since.setDate(since.getDate() - 120);
      const sinceStr = since.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("internal_osa_results")
        .select(
          "id, shift_date, team_member_name, store, starting_points, points_lost, overall_points, star_rating, created_at"
        )
        .gte("shift_date", sinceStr)
        .order("shift_date", { ascending: false });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setRows((data || []) as OsaRow[]);
      }
      setLoading(false);
    };

    load();
  }, []);

  // Date filter
  const dateFilteredRows = useMemo(() => {
    const now = new Date();

    if (dateRange === "yesterday") {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      return rows.filter((r) => r.shift_date === yStr);
    }

    if (dateRange === "wtd") {
      const monday = getMonday(now);
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

    // custom
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
  }, [rows, dateRange, customFrom, customTo]);

  // Store filter
  const filteredRows = useMemo(() => {
    if (selectedStore === "all") return dateFilteredRows;
    return dateFilteredRows.filter((r) => r.store === selectedStore);
  }, [dateFilteredRows, selectedStore]);

  // Normalise rows + sorting
  const rankedRows = useMemo(() => {
    const normalised = filteredRows
      .map((r) => {
        // if overall_points not stored, derive it
        const start = asNumber(r.starting_points);
        const lost = asNumber(r.points_lost);
        const overall =
          asNumber(r.overall_points) ??
          (start != null && lost != null ? start - lost : null);

        const stars = asNumber(r.star_rating);

        return {
          ...r,
          overall_points: overall,
          star_rating: stars,
        };
      })
      .filter((r) => (r.team_member_name || "").trim().length > 0);

    normalised.sort((a, b) => {
      if (sortMode === "recent") {
        // recent by shift_date then created_at
        if (a.shift_date !== b.shift_date)
          return a.shift_date < b.shift_date ? 1 : -1;
        const ac = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bc = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bc - ac;
      }

      if (sortMode === "stars") {
        const aStars = a.star_rating ?? -1;
        const bStars = b.star_rating ?? -1;
        if (bStars !== aStars) return bStars - aStars;
        const aPts = a.overall_points ?? -999999;
        const bPts = b.overall_points ?? -999999;
        return bPts - aPts;
      }

      // points (default)
      const aPts = a.overall_points ?? -999999;
      const bPts = b.overall_points ?? -999999;
      if (bPts !== aPts) return bPts - aPts;

      // tie-breaker: stars then most recent
      const aStars = a.star_rating ?? -1;
      const bStars = b.star_rating ?? -1;
      if (bStars !== aStars) return bStars - aStars;

      if (a.shift_date !== b.shift_date) return a.shift_date < b.shift_date ? 1 : -1;
      return 0;
    });

    // add rank (1-based)
    return normalised.map((r, idx) => ({ ...r, rank: idx + 1 }));
  }, [filteredRows, sortMode]);

  const podium = useMemo(() => rankedRows.slice(0, 3), [rankedRows]);

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

  const handleBack = () => {
    if (typeof window !== "undefined") window.history.back();
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
        <h1>Internal OSA Leaderboard</h1>
        <p className="subtitle">
          Ranked by <b>overall points</b> (higher is better). Stars show 1–5⭐, and <b>Elite</b> above 5⭐.
        </p>
      </header>

      {/* filters */}
      <section className="container wide">
        <div className="filters-panel card soft">
          <div className="filters-block">
            <p className="filters-title">Store</p>
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
            <p className="filters-title">Sort</p>
            <div className="filters">
              <button
                onClick={() => setSortMode("points")}
                className={`chip small ${sortMode === "points" ? "chip--active" : ""}`}
              >
                Overall points
              </button>
              <button
                onClick={() => setSortMode("stars")}
                className={`chip small ${sortMode === "stars" ? "chip--active" : ""}`}
              >
                Stars
              </button>
              <button
                onClick={() => setSortMode("recent")}
                className={`chip small ${sortMode === "recent" ? "chip--active" : ""}`}
              >
                Most recent
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
        {loading && <div className="card pad">Loading Internal OSA…</div>}
        {errorMsg && <div className="card pad error">Error: {errorMsg}</div>}

        {!loading && !errorMsg && (
          <>
            <div className="section-head">
              <h2>Podium</h2>
              <p className="section-sub">{periodLabel}</p>
            </div>

            {podium.length === 0 ? (
              <div className="card pad">
                <p className="muted">No results for this filter.</p>
              </div>
            ) : (
              <div className="podium-grid">
                {podium.map((p) => {
                  const medal = medalForRank(p.rank);
                  const stars = p.star_rating ?? null;
                  const elite = stars != null && stars > 5;

                  const overall = p.overall_points ?? 0;
                  const start = p.starting_points ?? 0;
                  const lost = p.points_lost ?? 0;

                  return (
                    <div key={p.id} className="card podium-card">
                      <div className="podium-top">
                        <div className="podium-left">
                          <div className="rank-big">
                            <span className="medal">{medal}</span>
                            <span className="rank-num">#{p.rank}</span>
                          </div>
                          <div className="podium-name">
                            <h3 title={p.team_member_name}>{p.team_member_name}</h3>
                            <p className="muted-sm">
                              {p.store} • {formatDateGB(p.shift_date)}
                            </p>
                          </div>
                        </div>

                        <span className={`pill ${elite ? "pill--elite" : "pill--brand"}`}>
                          {getStarLabel(stars)}
                        </span>
                      </div>

                      <div className="rows">
                        <p className="metric">
                          <span>Overall points</span>
                          <strong>{overall}</strong>
                        </p>
                        <p className="metric">
                          <span>Starting</span>
                          <strong>{start}</strong>
                        </p>
                        <p className="metric">
                          <span>Lost</span>
                          <strong>{lost}</strong>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="section-head mt">
              <h2>Leaderboard</h2>
              <p className="section-sub">
                {periodLabel} • {selectedStore === "all" ? "All stores" : selectedStore} • sorted by{" "}
                {sortMode === "points" ? "overall points" : sortMode === "stars" ? "stars" : "most recent"}
              </p>
            </div>

            <div className="card table-card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 92 }}>Rank</th>
                      <th>Team member</th>
                      <th>Store</th>
                      <th>Date</th>
                      <th>Overall</th>
                      <th>Start</th>
                      <th>Lost</th>
                      <th>Stars</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="empty">
                          No results for this filter.
                        </td>
                      </tr>
                    )}

                    {rankedRows.map((r) => {
                      const stars = r.star_rating ?? null;
                      const elite = stars != null && stars > 5;
                      const overall = r.overall_points ?? 0;

                      // subtle row tone based on rank & score
                      const tone =
                        r.rank <= 3
                          ? "row--podium"
                          : overall >= 115
                          ? "row--good"
                          : overall >= 105
                          ? "row--mid"
                          : "row--low";

                      return (
                        <tr key={r.id} className={tone}>
                          <td>
                            <span className="rank-badge">#{r.rank}</span>
                          </td>
                          <td className="name-cell">{r.team_member_name}</td>
                          <td>{r.store}</td>
                          <td>{formatDateGB(r.shift_date)}</td>
                          <td>
                            <b>{overall}</b>
                          </td>
                          <td>{r.starting_points ?? "—"}</td>
                          <td>{r.points_lost ?? "—"}</td>
                          <td>
                            <span className={`star-pill ${elite ? "star-pill--elite" : ""}`}>
                              {getStarLabel(stars)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
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

        .content {
          gap: 18px;
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

        .pad {
          padding: 14px 16px;
        }

        .error {
          color: #b91c1c;
        }

        .filters-panel {
          display: flex;
          gap: 24px;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
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

        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
        }

        .section-head.mt {
          margin-top: 22px;
        }

        .section-head h2 {
          font-size: 16px;
          font-weight: 800;
        }

        .section-sub {
          font-size: 12px;
          color: var(--muted);
        }

        /* PODIUM */
        .podium-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .podium-card {
          padding: 12px 14px;
        }

        .podium-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 8px;
        }

        .podium-left {
          display: flex;
          gap: 10px;
          align-items: center;
          min-width: 0;
        }

        .rank-big {
          display: grid;
          place-items: center;
          width: 52px;
          height: 52px;
          border-radius: 18px;
          background: rgba(0, 100, 145, 0.1);
          border: 1px solid rgba(0, 100, 145, 0.18);
          flex: 0 0 52px;
        }

        .medal {
          font-size: 18px;
          line-height: 1;
        }

        .rank-num {
          font-weight: 900;
          font-size: 12px;
          color: var(--brand-dark);
          margin-top: 2px;
        }

        .podium-name {
          min-width: 0;
        }

        .podium-name h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .muted-sm {
          margin: 2px 0 0;
          font-size: 12px;
          color: var(--muted);
        }

        .rows {
          display: flex;
          flex-direction: column;
          gap: 4px;
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

        .pill {
          font-size: 11px;
          font-weight: 800;
          padding: 3px 10px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .pill--brand {
          background: rgba(0, 100, 145, 0.12);
          color: var(--brand-dark);
          border: 1px solid rgba(0, 100, 145, 0.18);
        }

        .pill--elite {
          background: rgba(245, 158, 11, 0.16);
          color: #92400e;
          border: 1px solid rgba(245, 158, 11, 0.28);
        }

        /* TABLE */
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

        .empty {
          text-align: center;
          padding: 16px 6px;
          color: var(--muted);
        }

        .rank-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 26px;
          min-width: 62px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.1);
          color: var(--brand-dark);
          border: 1px solid rgba(0, 100, 145, 0.18);
          font-weight: 900;
          font-size: 12px;
        }

        .star-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 3px 10px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 12px;
          background: rgba(0, 100, 145, 0.1);
          color: var(--brand-dark);
          border: 1px solid rgba(0, 100, 145, 0.18);
          white-space: nowrap;
        }

        .star-pill--elite {
          background: rgba(245, 158, 11, 0.16);
          color: #92400e;
          border: 1px solid rgba(245, 158, 11, 0.28);
        }

        .name-cell {
          font-weight: 700;
        }

        /* subtle performance tone (optional) */
        .row--podium {
          background: rgba(245, 158, 11, 0.08) !important;
        }
        .row--good {
          /* leave default */
        }
        .row--mid {
          /* leave default */
        }
        .row--low {
          /* leave default */
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

        .muted {
          color: var(--muted);
        }

        .footer {
          text-align: center;
          margin-top: 36px;
          color: var(--muted);
          font-size: 13px;
        }

        @media (max-width: 1100px) {
          .filters-panel {
            flex-direction: column;
            align-items: flex-start;
          }
          .podium-grid {
            grid-template-columns: 1fr;
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
