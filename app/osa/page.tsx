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

function clampName(raw: string) {
  const t = (raw || "").trim();
  return t.length ? t : "Unknown";
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

  // ✅ modal state
  const [activePerson, setActivePerson] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActivePerson(null);
    };
    if (activePerson) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePerson]);

  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setErrorMsg("Supabase client not available");
        setLoading(false);
        return;
      }

      const since = new Date();
      since.setDate(since.getDate() - 120);
      const sinceStr = since.toISOString().slice(0, 10);

      const { data, error } = await supabase
       .from("osa_internal_results")

        .select(
          "id, shift_date, team_member_name, store, starting_points, points_lost, overall_points, star_rating, created_at"
        )
        .gte("shift_date", sinceStr)
        .order("shift_date", { ascending: false });

      if (error) setErrorMsg(error.message);
      else setRows((data || []) as OsaRow[]);

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

  const filteredRows = useMemo(() => {
    if (selectedStore === "all") return dateFilteredRows;
    return dateFilteredRows.filter((r) => r.store === selectedStore);
  }, [dateFilteredRows, selectedStore]);

  // normalise row calc (overall_points + stars)
  const normalisedRows = useMemo(() => {
    return filteredRows
      .map((r) => {
        const start = asNumber(r.starting_points);
        const lost = asNumber(r.points_lost);
        const overall =
          asNumber(r.overall_points) ??
          (start != null && lost != null ? start - lost : null);

        const stars = asNumber(r.star_rating);

        return {
          ...r,
          team_member_name: clampName(r.team_member_name),
          overall_points: overall,
          star_rating: stars,
        };
      })
      .filter((r) => (r.team_member_name || "").trim().length > 0);
  }, [filteredRows]);

  // ✅ ranked leaderboard list
  const rankedRows = useMemo(() => {
    const list = [...normalisedRows];

    list.sort((a, b) => {
      if (sortMode === "recent") {
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

      const aPts = a.overall_points ?? -999999;
      const bPts = b.overall_points ?? -999999;
      if (bPts !== aPts) return bPts - aPts;

      const aStars = a.star_rating ?? -1;
      const bStars = b.star_rating ?? -1;
      if (bStars !== aStars) return bStars - aStars;

      if (a.shift_date !== b.shift_date) return a.shift_date < b.shift_date ? 1 : -1;
      return 0;
    });

    return list.map((r, idx) => ({ ...r, rank: idx + 1 }));
  }, [normalisedRows, sortMode]);

  const podium = useMemo(() => rankedRows.slice(0, 3), [rankedRows]);

  // ✅ store leaderboard (avg points, tie: elite count, tie: avg stars)
  const storeLeaderboard = useMemo(() => {
    const bucket: Record<
      string,
      { entries: number; points: number[]; stars: number[]; eliteCount: number }
    > = {};

    for (const r of normalisedRows) {
      const store = (r.store || "Unknown").trim() || "Unknown";
      if (!bucket[store]) bucket[store] = { entries: 0, points: [], stars: [], eliteCount: 0 };

      bucket[store].entries += 1;
      if (r.overall_points != null) bucket[store].points.push(r.overall_points);
      if (r.star_rating != null) {
        bucket[store].stars.push(r.star_rating);
        if (r.star_rating > 5) bucket[store].eliteCount += 1;
      }
    }

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const arr = Object.entries(bucket).map(([store, v]) => ({
      store,
      entries: v.entries,
      avgPoints: avg(v.points),
      avgStars: avg(v.stars),
      eliteCount: v.eliteCount,
    }));

    arr.sort((a, b) => {
      if (b.avgPoints !== a.avgPoints) return b.avgPoints - a.avgPoints;
      if (b.eliteCount !== a.eliteCount) return b.eliteCount - a.eliteCount;
      return b.avgStars - a.avgStars;
    });

    return arr.map((s, idx) => ({ ...s, rank: idx + 1 }));
  }, [normalisedRows]);

  // ✅ modal: person history (within current filters)
  const activePersonHistory = useMemo(() => {
    if (!activePerson) return [];

    const list = normalisedRows
      .filter((r) => r.team_member_name === activePerson)
      .sort((a, b) => {
        if (a.shift_date !== b.shift_date) return a.shift_date < b.shift_date ? 1 : -1;
        const ac = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bc = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bc - ac;
      });

    return list;
  }, [activePerson, normalisedRows]);

  const activePersonSummary = useMemo(() => {
    if (!activePerson) return null;
    const list = activePersonHistory;
    if (list.length === 0) {
      return {
        checks: 0,
        avgPoints: null as number | null,
        avgStars: null as number | null,
        eliteCount: 0,
        lastOverall: null as number | null,
        prevOverall: null as number | null,
      };
    }

    const pts = list.map((r) => r.overall_points).filter((v): v is number => v != null);
    const stars = list.map((r) => r.star_rating).filter((v): v is number => v != null);
    const eliteCount = list.filter((r) => (r.star_rating ?? 0) > 5).length;

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    const lastOverall = list[0]?.overall_points ?? null;
    const prevOverall = list[1]?.overall_points ?? null;

    return {
      checks: list.length,
      avgPoints: avg(pts),
      avgStars: avg(stars),
      eliteCount,
      lastOverall,
      prevOverall,
    };
  }, [activePerson, activePersonHistory]);

  const trendDelta = useMemo(() => {
    const s = activePersonSummary;
    if (!s) return null;
    if (s.lastOverall == null || s.prevOverall == null) return null;
    return s.lastOverall - s.prevOverall;
  }, [activePersonSummary]);

  const trendBadge = useMemo(() => {
    if (trendDelta == null) return { text: "No trend yet", tone: "neutral" as const };
    if (trendDelta > 0) return { text: `Up +${trendDelta}`, tone: "pos" as const };
    if (trendDelta < 0) return { text: `Down ${trendDelta}`, tone: "neg" as const };
    return { text: "Flat 0", tone: "neutral" as const };
  }, [trendDelta]);

  const last10 = useMemo(() => activePersonHistory.slice(0, 10), [activePersonHistory]);

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
      <div className="banner">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <div className="nav-row">
        <button onClick={handleBack} className="btn btn--ghost">
          ← Back
        </button>
        <a href="/" className="btn btn--brand">
          🏠 Home
        </a>
      </div>

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
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="date-field">
                <label>To</label>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="container wide content">
        {loading && <div className="card pad">Loading Internal OSA…</div>}
        {errorMsg && <div className="card pad error">Error: {errorMsg}</div>}

        {!loading && !errorMsg && (
          <>
            {/* STORE MINI-LEADERBOARD */}
            <div className="section-head">
              <h2>Store leaderboard</h2>
              <p className="section-sub">{periodLabel}</p>
            </div>

            {storeLeaderboard.length === 0 ? (
              <div className="card pad">
                <p className="muted">No store results for this filter.</p>
              </div>
            ) : (
              <div className="store-mini-grid">
                {storeLeaderboard.map((s) => (
                  <div key={s.store} className="card store-mini-card">
                    <div className="store-mini-top">
                      <div className="store-mini-left">
                        <span className="rank-badge">#{s.rank}</span>
                        <div className="store-mini-title">
                          <h3 title={s.store}>{s.store}</h3>
                          <p className="muted-sm">{s.entries} checks</p>
                        </div>
                      </div>

                      <span className={`pill ${s.eliteCount > 0 ? "pill--elite" : "pill--brand"}`}>
                        {s.eliteCount > 0 ? `ELITE x${s.eliteCount}` : "No Elite"}
                      </span>
                    </div>

                    <div className="rows">
                      <p className="metric">
                        <span>Avg overall</span>
                        <strong>{s.avgPoints ? s.avgPoints.toFixed(1) : "—"}</strong>
                      </p>
                      <p className="metric">
                        <span>Avg stars</span>
                        <strong>{s.avgStars ? s.avgStars.toFixed(2) : "—"}</strong>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PODIUM */}
            <div className="section-head mt">
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

            {/* LEADERBOARD TABLE */}
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

                          {/* ✅ clickable name → opens modal */}
                          <td className="name-cell">
                            <button
                              className="name-link"
                              onClick={() => setActivePerson(r.team_member_name)}
                              title="View profile"
                            >
                              {r.team_member_name}
                            </button>
                          </td>

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

      {/* ✅ PROFILE MODAL */}
      {activePerson && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={() => setActivePerson(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">
                <h3 title={activePerson}>{activePerson}</h3>
                <p className="muted-sm">
                  {periodLabel} • {selectedStore === "all" ? "All stores" : selectedStore}
                </p>
              </div>

              <button className="modal-close" onClick={() => setActivePerson(null)} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="modal-kpis">
              <div className="kpi-card">
                <p className="kpi-label">Checks</p>
                <p className="kpi-value">{activePersonSummary?.checks ?? 0}</p>
              </div>
              <div className="kpi-card">
                <p className="kpi-label">Avg overall</p>
                <p className="kpi-value">
                  {activePersonSummary?.avgPoints != null ? activePersonSummary.avgPoints.toFixed(1) : "—"}
                </p>
              </div>
              <div className="kpi-card">
                <p className="kpi-label">Avg stars</p>
                <p className="kpi-value">
                  {activePersonSummary?.avgStars != null ? activePersonSummary.avgStars.toFixed(2) : "—"}
                </p>
              </div>
              <div className="kpi-card">
                <p className="kpi-label">Elite</p>
                <p className="kpi-value">{activePersonSummary?.eliteCount ?? 0}</p>
              </div>
            </div>

            <div className="trend-row">
              <span className="trend-label">Trend (latest vs previous)</span>
              <span className={`trend-pill ${trendBadge.tone}`}>
                {trendBadge.tone === "pos" ? "📈 " : trendBadge.tone === "neg" ? "📉 " : "➖ "}
                {trendBadge.text}
              </span>
            </div>

            <div className="modal-section">
              <h4>Last 10 checks</h4>
              {last10.length === 0 ? (
                <p className="muted">No checks for this person in the current filter.</p>
              ) : (
                <div className="modal-table-wrap">
                  <table className="modal-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Store</th>
                        <th>Overall</th>
                        <th>Start</th>
                        <th>Lost</th>
                        <th>Stars</th>
                      </tr>
                    </thead>
                    <tbody>
                      {last10.map((r) => {
                        const stars = r.star_rating ?? null;
                        const elite = stars != null && stars > 5;
                        return (
                          <tr key={r.id}>
                            <td>{formatDateGB(r.shift_date)}</td>
                            <td>{r.store}</td>
                            <td>
                              <b>{r.overall_points ?? "—"}</b>
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
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn--ghost" onClick={() => setActivePerson(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>

      <style jsx>{`
        :root {
          --bg: #f2f5f9;
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

        .store-mini-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .store-mini-card {
          padding: 12px 14px;
        }

        .store-mini-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 8px;
        }

        .store-mini-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .store-mini-title h3 {
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

        .name-link {
          appearance: none;
          border: none;
          background: transparent;
          padding: 0;
          margin: 0;
          font: inherit;
          font-weight: 800;
          color: var(--brand-dark);
          cursor: pointer;
          text-decoration: underline;
          text-decoration-color: rgba(0, 100, 145, 0.35);
          text-underline-offset: 3px;
        }

        .name-link:hover {
          text-decoration-color: rgba(0, 100, 145, 0.9);
        }

        .row--podium {
          background: rgba(245, 158, 11, 0.08) !important;
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

        /* ✅ MODAL */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.55);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 18px;
          z-index: 9999;
        }

        .modal {
          width: min(900px, 96vw);
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 20px 60px rgba(2, 6, 23, 0.3);
          border: 1px solid rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }

        .modal-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
          background: linear-gradient(180deg, rgba(0, 100, 145, 0.06), rgba(255, 255, 255, 0));
        }

        .modal-title h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 900;
          color: var(--text);
        }

        .modal-close {
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          border-radius: 12px;
          padding: 6px 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .modal-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          padding: 12px 16px 6px;
        }

        .kpi-card {
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 14px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.9);
        }

        .kpi-label {
          margin: 0;
          font-size: 11px;
          color: var(--muted);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .kpi-value {
          margin: 6px 0 0;
          font-size: 18px;
          font-weight: 900;
        }

        .trend-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 8px 16px 10px;
        }

        .trend-label {
          font-size: 12px;
          color: var(--muted);
          font-weight: 700;
        }

        .trend-pill {
          font-size: 12px;
          font-weight: 900;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.08);
        }

        .trend-pill.pos {
          background: rgba(34, 197, 94, 0.14);
          color: #166534;
          border-color: rgba(34, 197, 94, 0.25);
        }

        .trend-pill.neg {
          background: rgba(239, 68, 68, 0.14);
          color: #991b1b;
          border-color: rgba(239, 68, 68, 0.25);
        }

        .trend-pill.neutral {
          background: rgba(100, 116, 139, 0.12);
          color: #334155;
          border-color: rgba(100, 116, 139, 0.22);
        }

        .modal-section {
          padding: 8px 16px 14px;
        }

        .modal-section h4 {
          margin: 6px 0 10px;
          font-size: 14px;
          font-weight: 900;
        }

        .modal-table-wrap {
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 14px;
          overflow-x: auto;
        }

        .modal-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .modal-table thead {
          background: #f0f4f8;
        }

        .modal-table th,
        .modal-table td {
          padding: 9px 10px;
          text-align: left;
        }

        .modal-actions {
          padding: 12px 16px 16px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          border-top: 1px solid rgba(15, 23, 42, 0.06);
          background: rgba(248, 250, 252, 0.6);
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
          .store-mini-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .podium-grid {
            grid-template-columns: 1fr;
          }
          .modal-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .store-mini-grid {
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
