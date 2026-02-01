"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

type AnyRow = Record<string, any>;

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function safeString(v: any) {
  if (v == null) return "";
  return String(v);
}

function parseNumber(v: any): number | null {
  if (v == null) return null;
  const n =
    typeof v === "number"
      ? v
      : Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function findFirstKey(row: AnyRow | null, keys: string[]) {
  if (!row) return null;
  for (const k of keys) if (k in row) return k;
  return null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function OSAInternalScorecardPage() {
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toISODate(d);
  });
  const [toDate, setToDate] = useState<string>(() => toISODate(new Date()));

  // Detect columns (based on first row)
  const detected = useMemo(() => {
    const first = rows[0] || null;

    const createdKey =
      findFirstKey(first, ["created_at", "createdAt", "submitted_at", "timestamp"]) ||
      "created_at";

    const shiftDateKey =
      findFirstKey(first, ["shift_date", "shiftDate", "date", "audit_date", "auditDate"]) ||
      null;

    const storeKey =
      findFirstKey(first, ["store", "store_name", "storeName", "location"]) || "store";

    const managerKey =
      findFirstKey(first, [
        "manager",
        "closing_manager",
        "shift_runner",
        "shiftRunner",
        "completed_by",
        "completedBy",
        "auditor",
        "user_name",
        "user",
      ]) || "manager";

    const starsKey =
      findFirstKey(first, ["stars", "star_rating", "rating", "osa_stars"]) || null;

    const pointsLostKey =
      findFirstKey(first, ["points_lost", "pointsLost", "pl", "point_loss"]) || null;

    const scoreKey =
      findFirstKey(first, [
        "score_pct",
        "score_percent",
        "scorePercentage",
        "score",
        "overall_score",
        "overall",
        "percent",
        "result",
      ]) || null;

    return {
      createdKey,
      shiftDateKey,
      storeKey,
      managerKey,
      starsKey,
      pointsLostKey,
      scoreKey,
    };
  }, [rows]);

  // Load data
  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setError("Supabase client not available");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from("osa_internal_results")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(800);

        if (error) throw error;

        setRows((data || []) as AnyRow[]);
      } catch (e: any) {
        setError(e?.message || "Could not load internal OSA results");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const stores = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const v = safeString(r[detected.storeKey]).trim();
      if (v) s.add(v);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [rows, detected.storeKey]);

  // Filter rows (date + store)
  const filtered = useMemo(() => {
    const from = new Date(fromDate + "T00:00:00");
    const to = new Date(toDate + "T23:59:59");

    return rows.filter((r) => {
      if (storeFilter !== "all") {
        const s = safeString(r[detected.storeKey]).trim();
        if (s !== storeFilter) return false;
      }

      const dateKey = detected.shiftDateKey || detected.createdKey;
      const raw = r[dateKey];
      const d = raw ? new Date(raw) : null;
      if (!d || isNaN(d.getTime())) return true;

      return d >= from && d <= to;
    });
  }, [
    rows,
    storeFilter,
    fromDate,
    toDate,
    detected.storeKey,
    detected.shiftDateKey,
    detected.createdKey,
  ]);

  const formatStamp = (iso: any) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return safeString(iso);
    return d.toLocaleString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // --- Aggregations: Managers & Stores leaderboard ---
  type LeaderRow = {
    name: string;
    audits: number;
    totalPL: number; // lower is better
    avgPL: number;
    avgStars: number;
    avgScorePct: number | null;
    lastSeen: string | null;
  };

  const leaderboards = useMemo(() => {
    const plKey = detected.pointsLostKey;
    const starsKey = detected.starsKey;
    const scoreKey = detected.scoreKey;

    const mgrBucket: Record<string, { audits: number; pl: number[]; stars: number[]; score: number[]; last: string | null }> =
      {};
    const storeBucket: Record<string, { audits: number; pl: number[]; stars: number[]; score: number[]; last: string | null }> =
      {};

    for (const r of filtered) {
      const mgr = safeString(r[detected.managerKey]).trim() || "Unknown";
      const store = safeString(r[detected.storeKey]).trim() || "Unknown";

      const created = r[detected.createdKey] ?? null;

      const pl = plKey ? parseNumber(r[plKey]) : null;
      const stars = starsKey ? parseNumber(r[starsKey]) : null;

      let scorePct: number | null = null;
      if (scoreKey) {
        const sc = parseNumber(r[scoreKey]);
        if (sc != null) scorePct = sc <= 1 ? sc * 100 : sc;
      }

      if (!mgrBucket[mgr]) mgrBucket[mgr] = { audits: 0, pl: [], stars: [], score: [], last: null };
      if (!storeBucket[store]) storeBucket[store] = { audits: 0, pl: [], stars: [], score: [], last: null };

      mgrBucket[mgr].audits += 1;
      storeBucket[store].audits += 1;

      if (pl != null) {
        mgrBucket[mgr].pl.push(pl);
        storeBucket[store].pl.push(pl);
      }
      if (stars != null) {
        mgrBucket[mgr].stars.push(stars);
        storeBucket[store].stars.push(stars);
      }
      if (scorePct != null) {
        mgrBucket[mgr].score.push(scorePct);
        storeBucket[store].score.push(scorePct);
      }

      // last seen
      if (created) {
        if (!mgrBucket[mgr].last) mgrBucket[mgr].last = created;
        if (!storeBucket[store].last) storeBucket[store].last = created;
      }
    }

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const sum = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) : 0);

    const managers: LeaderRow[] = Object.entries(mgrBucket).map(([name, v]) => ({
      name,
      audits: v.audits,
      totalPL: sum(v.pl),
      avgPL: v.pl.length ? avg(v.pl) : 0,
      avgStars: v.stars.length ? avg(v.stars) : 0,
      avgScorePct: v.score.length ? avg(v.score) : null,
      lastSeen: v.last,
    }));

    const storesL: LeaderRow[] = Object.entries(storeBucket).map(([name, v]) => ({
      name,
      audits: v.audits,
      totalPL: sum(v.pl),
      avgPL: v.pl.length ? avg(v.pl) : 0,
      avgStars: v.stars.length ? avg(v.stars) : 0,
      avgScorePct: v.score.length ? avg(v.score) : null,
      lastSeen: v.last,
    }));

    // Ranking: lowest total PL first, then higher stars, then more audits
    const rankFn = (a: LeaderRow, b: LeaderRow) => {
      if (a.totalPL !== b.totalPL) return a.totalPL - b.totalPL;
      if (b.avgStars !== a.avgStars) return b.avgStars - a.avgStars;
      return b.audits - a.audits;
    };

    managers.sort(rankFn);
    storesL.sort(rankFn);

    return { managers, stores: storesL };
  }, [
    filtered,
    detected.managerKey,
    detected.storeKey,
    detected.createdKey,
    detected.pointsLostKey,
    detected.starsKey,
    detected.scoreKey,
  ]);

  const topManager = leaderboards.managers[0] || null;
  const topStore = leaderboards.stores[0] || null;

  // "Most Improved" (optional): compare last 14 days vs prev 14 days by average PL (down is improvement)
  const mostImprovedManager = useMemo(() => {
    const dateKey = detected.shiftDateKey || detected.createdKey;

    const now = new Date();
    const recentStart = new Date(now);
    recentStart.setDate(now.getDate() - 14);
    recentStart.setHours(0, 0, 0, 0);

    const prevStart = new Date(now);
    prevStart.setDate(now.getDate() - 28);
    prevStart.setHours(0, 0, 0, 0);

    const plKey = detected.pointsLostKey;
    if (!plKey) return null;

    const bucket = (rowsIn: AnyRow[]) => {
      const b: Record<string, number[]> = {};
      for (const r of rowsIn) {
        const mgr = safeString(r[detected.managerKey]).trim() || "Unknown";
        const pl = parseNumber(r[plKey]);
        if (pl == null) continue;
        if (!b[mgr]) b[mgr] = [];
        b[mgr].push(pl);
      }
      return b;
    };

    const recentRows: AnyRow[] = [];
    const prevRows: AnyRow[] = [];

    for (const r of filtered) {
      const raw = r[dateKey];
      const d = raw ? new Date(raw) : null;
      if (!d || isNaN(d.getTime())) continue;

      if (d >= recentStart) recentRows.push(r);
      else if (d >= prevStart && d < recentStart) prevRows.push(r);
    }

    const rB = bucket(recentRows);
    const pB = bucket(prevRows);
    const names = Array.from(new Set([...Object.keys(rB), ...Object.keys(pB)]));

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    // improvement = prevAvgPL - recentAvgPL (positive means better)
    const improvements = names
      .map((name) => {
        const prevAvg = avg(pB[name] || []);
        const recentAvg = avg(rB[name] || []);
        if (prevAvg == null || recentAvg == null) return null;
        return { name, delta: prevAvg - recentAvg, prevAvg, recentAvg };
      })
      .filter(Boolean) as { name: string; delta: number; prevAvg: number; recentAvg: number }[];

    improvements.sort((a, b) => b.delta - a.delta);
    return improvements[0] || null;
  }, [
    filtered,
    detected.shiftDateKey,
    detected.createdKey,
    detected.pointsLostKey,
    detected.managerKey,
  ]);

  // Overall summary
  const summary = useMemo(() => {
    const plKey = detected.pointsLostKey;
    const starsKey = detected.starsKey;

    let plSum = 0;
    let plCount = 0;

    let starsSum = 0;
    let starsCount = 0;

    for (const r of filtered) {
      if (plKey) {
        const pl = parseNumber(r[plKey]);
        if (pl != null) {
          plSum += pl;
          plCount += 1;
        }
      }
      if (starsKey) {
        const st = parseNumber(r[starsKey]);
        if (st != null) {
          starsSum += st;
          starsCount += 1;
        }
      }
    }

    return {
      records: filtered.length,
      avgPL: plCount ? plSum / plCount : null,
      avgStars: starsCount ? starsSum / starsCount : null,
    };
  }, [filtered, detected.pointsLostKey, detected.starsKey]);

  // Badge helper
  const rankBadge = (idx: number) => {
    if (idx === 0) return { label: "🏆 1st", cls: "badge gold" };
    if (idx === 1) return { label: "🥈 2nd", cls: "badge silver" };
    if (idx === 2) return { label: "🥉 3rd", cls: "badge bronze" };
    return { label: `#${idx + 1}`, cls: "badge" };
    };

  const fmt = {
    pl: (n: number | null) => (n == null ? "—" : n.toFixed(1)),
    stars: (n: number | null) => (n == null ? "—" : n.toFixed(2)),
    pct: (n: number | null) => (n == null ? "—" : n.toFixed(1) + "%"),
  };

  return (
    <main className="wrap">
      {/* Banner */}
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <div className="shell">
        <header className="header">
          <div className="header-top">
            <div>
              <h1>Internal OSA Scorecard</h1>
              <p className="subtitle">Leaderboards • Points Lost • Star Ratings</p>
            </div>
            <a className="btn-back" href="/">
              ← Back to Hub
            </a>
          </div>

          {/* Filters */}
          <div className="filters">
            <div className="filter">
              <label>Store</label>
              <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
                <option value="all">All stores</option>
                {stores.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter">
              <label>From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>

            <div className="filter">
              <label>To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </header>

        {loading ? (
          <div className="notice">Loading internal OSA results…</div>
        ) : error ? (
          <div className="notice error">
            <b>Could not load:</b> {error}
            <div className="hint">
              Check Supabase table name is <code>osa_internal_results</code> and RLS allows reads.
            </div>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <section className="summary">
              <div className="summary-item">
                <div className="summary-k">Records</div>
                <div className="summary-v">{summary.records}</div>
              </div>
              <div className="summary-item">
                <div className="summary-k">Avg Points Lost</div>
                <div className="summary-v">{fmt.pl(summary.avgPL)}</div>
              </div>
              <div className="summary-item">
                <div className="summary-k">Avg Stars</div>
                <div className="summary-v">{fmt.stars(summary.avgStars)}</div>
              </div>
              <div className="summary-item subtle">
                <div className="summary-k">Ranking Logic</div>
                <div className="summary-v small">
                  Lowest <b>total</b> PL, then highest stars
                </div>
              </div>
            </section>

            {/* Highlights (like service dashboard) */}
            <section className="highlights">
              <div className="highlights-head">
                <h2>Highlights</h2>
                <p>Based on filtered results</p>
              </div>

              <div className="highlights-grid">
                <div className="highlight-card">
                  <div className="highlight-top">
                    <span className="highlight-title">🏆 Top Manager</span>
                    <span className="highlight-pill">Lowest PL</span>
                  </div>
                  <div className="highlight-main">
                    <div className="highlight-name">
                      {topManager ? topManager.name : "No data"}
                    </div>
                    <div className="highlight-metrics">
                      <span>
                        Total PL: <b>{topManager ? fmt.pl(topManager.totalPL) : "—"}</b>
                      </span>
                      <span>
                        Stars: <b>{topManager ? fmt.stars(topManager.avgStars) : "—"}</b>
                      </span>
                      <span>
                        Audits: <b>{topManager ? topManager.audits : "—"}</b>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="highlight-card">
                  <div className="highlight-top">
                    <span className="highlight-title">🏬 Top Store</span>
                    <span className="highlight-pill">Lowest PL</span>
                  </div>
                  <div className="highlight-main">
                    <div className="highlight-name">
                      {topStore ? topStore.name : "No data"}
                    </div>
                    <div className="highlight-metrics">
                      <span>
                        Total PL: <b>{topStore ? fmt.pl(topStore.totalPL) : "—"}</b>
                      </span>
                      <span>
                        Stars: <b>{topStore ? fmt.stars(topStore.avgStars) : "—"}</b>
                      </span>
                      <span>
                        Audits: <b>{topStore ? topStore.audits : "—"}</b>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="highlight-card">
                  <div className="highlight-top">
                    <span className="highlight-title">📈 Most Improved</span>
                    <span className="highlight-pill">Last 14d vs prev</span>
                  </div>
                  <div className="highlight-main">
                    <div className="highlight-name">
                      {mostImprovedManager ? mostImprovedManager.name : "Not enough data"}
                    </div>
                    <div className="highlight-metrics">
                      <span>
                        PL improvement:{" "}
                        <b>
                          {mostImprovedManager
                            ? `${clamp(mostImprovedManager.delta, -999, 999).toFixed(1)} ↓`
                            : "—"}
                        </b>
                      </span>
                      <span>
                        Prev avg PL:{" "}
                        <b>{mostImprovedManager ? fmt.pl(mostImprovedManager.prevAvg) : "—"}</b>
                      </span>
                      <span>
                        Recent avg PL:{" "}
                        <b>{mostImprovedManager ? fmt.pl(mostImprovedManager.recentAvg) : "—"}</b>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Manager leaderboard */}
            <section className="leader">
              <div className="section-head">
                <h2>Manager Leaderboard</h2>
                <p>Ranked by total points lost, then stars</p>
              </div>

              {leaderboards.managers.length === 0 ? (
                <div className="notice">No manager results for these filters.</div>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Manager</th>
                        <th>Total PL</th>
                        <th>Avg PL</th>
                        <th>Stars</th>
                        <th>Audits</th>
                        <th>Last seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboards.managers.slice(0, 50).map((m, idx) => {
                        const badge = rankBadge(idx);
                        return (
                          <tr key={m.name}>
                            <td>
                              <span className={badge.cls}>{badge.label}</span>
                            </td>
                            <td className="strong">{m.name}</td>
                            <td>
                              <span className="pill pl">{fmt.pl(m.totalPL)}</span>
                            </td>
                            <td>{fmt.pl(m.avgPL)}</td>
                            <td>
                              <span className="pill stars">⭐ {fmt.stars(m.avgStars)}</span>
                            </td>
                            <td>{m.audits}</td>
                            <td className="muted">{formatStamp(m.lastSeen)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Store leaderboard */}
            <section className="leader">
              <div className="section-head">
                <h2>Store Leaderboard</h2>
                <p>Same ranking rules</p>
              </div>

              {leaderboards.stores.length === 0 ? (
                <div className="notice">No store results for these filters.</div>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Store</th>
                        <th>Total PL</th>
                        <th>Avg PL</th>
                        <th>Stars</th>
                        <th>Audits</th>
                        <th>Last seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboards.stores.slice(0, 30).map((s, idx) => {
                        const badge = rankBadge(idx);
                        return (
                          <tr key={s.name}>
                            <td>
                              <span className={badge.cls}>{badge.label}</span>
                            </td>
                            <td className="strong">{s.name}</td>
                            <td>
                              <span className="pill pl">{fmt.pl(s.totalPL)}</span>
                            </td>
                            <td>{fmt.pl(s.avgPL)}</td>
                            <td>
                              <span className="pill stars">⭐ {fmt.stars(s.avgStars)}</span>
                            </td>
                            <td>{s.audits}</td>
                            <td className="muted">{formatStamp(s.lastSeen)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Raw results (optional but useful) */}
            <section className="raw">
              <div className="section-head">
                <h2>Raw Results</h2>
                <p>Most recent entries</p>
              </div>

              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Store</th>
                      <th>Manager</th>
                      {detected.pointsLostKey ? <th>Points Lost</th> : null}
                      {detected.starsKey ? <th>Stars</th> : null}
                      {detected.scoreKey ? <th>Score</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 120).map((r, idx) => {
                      const dateKey = detected.shiftDateKey || detected.createdKey;
                      const store = safeString(r[detected.storeKey]).trim() || "—";
                      const mgr = safeString(r[detected.managerKey]).trim() || "—";

                      const pl = detected.pointsLostKey
                        ? parseNumber(r[detected.pointsLostKey])
                        : null;
                      const st = detected.starsKey
                        ? parseNumber(r[detected.starsKey])
                        : null;

                      let scorePct: number | null = null;
                      if (detected.scoreKey) {
                        const sc = parseNumber(r[detected.scoreKey]);
                        if (sc != null) scorePct = sc <= 1 ? sc * 100 : sc;
                      }

                      return (
                        <tr key={idx}>
                          <td className="muted">{formatStamp(r[dateKey])}</td>
                          <td className="strong">{store}</td>
                          <td>{mgr}</td>
                          {detected.pointsLostKey ? (
                            <td>
                              <span className="pill pl">{pl == null ? "—" : pl}</span>
                            </td>
                          ) : null}
                          {detected.starsKey ? (
                            <td>
                              <span className="pill stars">⭐ {st == null ? "—" : st}</span>
                            </td>
                          ) : null}
                          {detected.scoreKey ? <td>{scorePct == null ? "—" : fmt.pct(scorePct)}</td> : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
          background: radial-gradient(
              circle at top,
              rgba(0, 100, 145, 0.08),
              transparent 45%
            ),
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
          background: rgba(255, 255, 255, 0.62);
          backdrop-filter: saturate(160%) blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 1.5rem;
          box-shadow: var(--shadow);
          padding: 26px 22px 30px;
        }

        .header-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        h1 {
          font-size: clamp(1.6rem, 2.2vw, 2.1rem);
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

        .btn-back {
          background: #fff;
          color: var(--brand);
          border: 2px solid var(--brand);
          border-radius: 14px;
          font-weight: 800;
          font-size: 14px;
          padding: 8px 12px;
          text-decoration: none;
          box-shadow: 0 6px 14px rgba(0, 100, 145, 0.12);
          transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
          white-space: nowrap;
        }

        .btn-back:hover {
          background: var(--brand);
          color: #fff;
          transform: translateY(-1px);
        }

        .filters {
          margin-top: 14px;
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          gap: 12px;
        }

        .filter {
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: left;
        }

        label {
          font-size: 12px;
          color: #334155;
          font-weight: 800;
        }

        select,
        input[type="date"] {
          width: 100%;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(255, 255, 255, 0.9);
          font-weight: 800;
          color: #0f172a;
          outline: none;
        }

        .notice {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(15, 23, 42, 0.12);
          font-weight: 800;
        }

        .notice.error {
          border-color: rgba(239, 68, 68, 0.25);
          background: rgba(254, 242, 242, 0.85);
        }

        .hint {
          margin-top: 8px;
          font-weight: 700;
          color: #334155;
          font-size: 13px;
        }

        /* Summary strip */
        .summary {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .summary-item {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 16px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          padding: 12px 14px;
          text-align: left;
        }

        .summary-item.subtle {
          border-style: dashed;
        }

        .summary-k {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: #0f172a;
        }

        .summary-v {
          margin-top: 6px;
          font-size: 20px;
          font-weight: 900;
        }

        .summary-v.small {
          font-size: 13px;
          font-weight: 800;
          color: #334155;
        }

        /* Highlights */
        .highlights {
          margin: 18px auto 0;
          width: 100%;
          text-align: left;
        }

        .highlights-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-bottom: 10px;
        }

        .highlights-head h2 {
          font-size: 15px;
          font-weight: 900;
          margin: 0;
          color: #0f172a;
        }

        .highlights-head p {
          margin: 0;
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
        }

        .highlights-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .highlight-card {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 16px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          padding: 12px 14px;
        }

        .highlight-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .highlight-title {
          font-size: 12px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .highlight-pill {
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.1);
          border: 1px solid rgba(0, 100, 145, 0.16);
          color: #004b75;
          white-space: nowrap;
        }

        .highlight-name {
          font-size: 16px;
          font-weight: 900;
          color: #0f172a;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .highlight-metrics {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 13px;
          color: #334155;
          font-weight: 700;
        }

        /* Sections */
        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-top: 18px;
          margin-bottom: 10px;
        }

        .section-head h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
        }

        .section-head p {
          margin: 0;
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
        }

        /* Table */
        .table-scroll {
          overflow: auto;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
        }

        th, td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          font-size: 13px;
        }

        th {
          position: sticky;
          top: 0;
          background: rgba(243, 248, 252, 0.98);
          font-weight: 900;
          color: #0f172a;
          z-index: 1;
        }

        td {
          font-weight: 750;
          color: #0f172a;
        }

        tr:hover td {
          background: rgba(0, 100, 145, 0.04);
        }

        .strong { font-weight: 900; }
        .muted { color: #64748b; font-weight: 800; }

        /* Pills & badges */
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 4px 10px;
          font-weight: 900;
          font-size: 12px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(255, 255, 255, 0.95);
        }

        .pill.pl {
          border-color: rgba(227, 24, 55, 0.18);
          background: rgba(227, 24, 55, 0.06);
        }

        .pill.stars {
          border-color: rgba(245, 158, 11, 0.22);
          background: rgba(245, 158, 11, 0.08);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 900;
          font-size: 12px;
          border: 1px solid rgba(0, 100, 145, 0.16);
          background: rgba(0, 100, 145, 0.08);
          color: #004b75;
          white-space: nowrap;
        }
        .badge.gold { background: rgba(245, 158, 11, 0.14); border-color: rgba(245, 158, 11, 0.25); color: #7c2d12; }
        .badge.silver { background: rgba(148, 163, 184, 0.18); border-color: rgba(148, 163, 184, 0.30); color: #334155; }
        .badge.bronze { background: rgba(234, 179, 8, 0.10); border-color: rgba(234, 179, 8, 0.18); color: #713f12; }

        .footer {
          text-align: center;
          margin-top: 18px;
          color: #94a3b8;
          font-size: 0.8rem;
        }

        @media (max-width: 980px) {
          .filters { grid-template-columns: 1fr; }
          .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .highlights-grid { grid-template-columns: 1fr; }
          .section-head { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </main>
  );
}
