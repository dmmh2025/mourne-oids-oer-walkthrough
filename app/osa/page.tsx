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

function findFirstKey(row: AnyRow | null, keys: string[]) {
  if (!row) return null;
  for (const k of keys) if (k in row) return k;
  return null;
}

function parseNumber(v: any): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
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

  // Detect key columns (based on first row)
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

    // Common score shapes: score_pct, score_percent, score, result, stars, points_lost
    const scoreKey = findFirstKey(first, [
      "score_pct",
      "score_percent",
      "scorePercentage",
      "score",
      "result",
      "overall_score",
      "overall",
      "percent",
    ]);

    const starsKey = findFirstKey(first, ["stars", "star_rating", "rating", "osa_stars"]);
    const pointsLostKey = findFirstKey(first, ["points_lost", "pointsLost", "pl", "point_loss"]);

    const whoKey = findFirstKey(first, [
      "manager",
      "shift_runner",
      "shiftRunner",
      "auditor",
      "completed_by",
      "completedBy",
      "user_name",
      "user",
    ]);

    return {
      createdKey,
      shiftDateKey,
      storeKey,
      scoreKey,
      starsKey,
      pointsLostKey,
      whoKey,
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

        // Use created_at for ordering; filter by date if we can.
        // We'll attempt to filter on shift_date first (if exists), else fallback to created_at.
        const { data, error } = await supabase
          .from("osa_internal_results")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);

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

      const dateKeyToUse = detected.shiftDateKey || detected.createdKey;
      const raw = r[dateKeyToUse];

      const d = raw ? new Date(raw) : null;
      if (!d || isNaN(d.getTime())) return true; // don't hide weird records

      return d >= from && d <= to;
    });
  }, [rows, storeFilter, fromDate, toDate, detected.shiftDateKey, detected.createdKey, detected.storeKey]);

  // Compute summary KPIs (best-effort)
  const summary = useMemo(() => {
    const scoreKey = detected.scoreKey;
    const starsKey = detected.starsKey;
    const pointsLostKey = detected.pointsLostKey;

    let scoreSum = 0;
    let scoreCount = 0;

    let starsSum = 0;
    let starsCount = 0;

    let plSum = 0;
    let plCount = 0;

    // Latest per store (by created_at)
    const latestByStore: Record<string, AnyRow> = {};

    for (const r of filtered) {
      if (scoreKey) {
        const sc = parseNumber(r[scoreKey]);
        if (sc != null) {
          // If values look like 0..1, convert to %
          const val = sc <= 1 ? sc * 100 : sc;
          scoreSum += val;
          scoreCount += 1;
        }
      }
      if (starsKey) {
        const st = parseNumber(r[starsKey]);
        if (st != null) {
          starsSum += st;
          starsCount += 1;
        }
      }
      if (pointsLostKey) {
        const pl = parseNumber(r[pointsLostKey]);
        if (pl != null) {
          plSum += pl;
          plCount += 1;
        }
      }

      const store = safeString(r[detected.storeKey]).trim() || "Unknown";
      const existing = latestByStore[store];

      const dtKey = detected.createdKey;
      const dNew = r[dtKey] ? new Date(r[dtKey]) : null;
      const dOld = existing?.[dtKey] ? new Date(existing[dtKey]) : null;

      if (!existing) latestByStore[store] = r;
      else if (dNew && !isNaN(dNew.getTime()) && dOld && !isNaN(dOld.getTime())) {
        if (dNew > dOld) latestByStore[store] = r;
      } else {
        // fallback: keep the first one we saw (already ordered desc)
      }
    }

    const avgScore = scoreCount ? scoreSum / scoreCount : null;
    const avgStars = starsCount ? starsSum / starsCount : null;
    const avgPL = plCount ? plSum / plCount : null;

    return {
      avgScore,
      avgStars,
      avgPL,
      latestByStore,
    };
  }, [filtered, detected.scoreKey, detected.starsKey, detected.pointsLostKey, detected.storeKey, detected.createdKey]);

  // Decide which columns to display (make it readable)
  const columns = useMemo(() => {
    // If we have data, prefer a tidy set of columns, but still include unknowns at the end.
    const allKeys = new Set<string>();
    for (const r of filtered.slice(0, 50)) Object.keys(r).forEach((k) => allKeys.add(k));

    const preferred = [
      detected.shiftDateKey,
      detected.createdKey,
      detected.storeKey,
      detected.whoKey,
      detected.scoreKey,
      detected.starsKey,
      detected.pointsLostKey,
      "comments",
      "comment",
      "notes",
      "note",
    ].filter(Boolean) as string[];

    const ordered: string[] = [];
    for (const k of preferred) if (k && allKeys.has(k) && !ordered.includes(k)) ordered.push(k);

    // add remaining keys (but avoid huge payload fields)
    const blacklist = new Set(["id", "uuid", "raw", "payload", "json", "images", "photos"]);
    for (const k of Array.from(allKeys)) {
      if (ordered.includes(k)) continue;
      if (blacklist.has(k.toLowerCase())) continue;
      ordered.push(k);
    }

    // cap columns so table stays usable
    return ordered.slice(0, 10);
  }, [
    filtered,
    detected.shiftDateKey,
    detected.createdKey,
    detected.storeKey,
    detected.whoKey,
    detected.scoreKey,
    detected.starsKey,
    detected.pointsLostKey,
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
              <p className="subtitle">Scorecards • Results • Rankings</p>
            </div>

            <a className="btn-back" href="/">
              ← Back to Hub
            </a>
          </div>

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
              Check Supabase table name is <code>osa_internal_results</code> and RLS allows reads
              for logged-in users.
            </div>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <section className="cards">
              <div className="card">
                <div className="card-title">Records</div>
                <div className="card-value">{filtered.length}</div>
                <div className="card-sub">Within selected filters</div>
              </div>

              <div className="card">
                <div className="card-title">Average Score</div>
                <div className="card-value">
                  {summary.avgScore == null ? "—" : summary.avgScore.toFixed(1) + "%"}
                </div>
                <div className="card-sub">
                  {detected.scoreKey ? `Using “${detected.scoreKey}”` : "No score column detected"}
                </div>
              </div>

              <div className="card">
                <div className="card-title">Average Stars</div>
                <div className="card-value">
                  {summary.avgStars == null ? "—" : summary.avgStars.toFixed(2)}
                </div>
                <div className="card-sub">
                  {detected.starsKey ? `Using “${detected.starsKey}”` : "No stars column detected"}
                </div>
              </div>

              <div className="card">
                <div className="card-title">Avg Points Lost</div>
                <div className="card-value">
                  {summary.avgPL == null ? "—" : summary.avgPL.toFixed(1)}
                </div>
                <div className="card-sub">
                  {detected.pointsLostKey
                    ? `Using “${detected.pointsLostKey}”`
                    : "No points lost column detected"}
                </div>
              </div>
            </section>

            {/* Latest per store */}
            <section className="latest">
              <div className="section-head">
                <h2>Latest by Store</h2>
                <p>Most recent submission (best-effort, based on created_at)</p>
              </div>

              <div className="latest-grid">
                {Object.entries(summary.latestByStore)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([store, r]) => {
                    const score = detected.scoreKey ? parseNumber(r[detected.scoreKey]) : null;
                    const scorePct = score == null ? null : score <= 1 ? score * 100 : score;

                    const stars = detected.starsKey ? parseNumber(r[detected.starsKey]) : null;
                    const pl = detected.pointsLostKey ? parseNumber(r[detected.pointsLostKey]) : null;

                    return (
                      <div key={store} className="latest-card">
                        <div className="latest-top">
                          <div className="latest-store">{store}</div>
                          <div className="latest-time">{formatStamp(r[detected.createdKey])}</div>
                        </div>

                        <div className="latest-metrics">
                          <span>
                            Score: <b>{scorePct == null ? "—" : scorePct.toFixed(1) + "%"}</b>
                          </span>
                          <span>
                            Stars: <b>{stars == null ? "—" : stars}</b>
                          </span>
                          <span>
                            PL: <b>{pl == null ? "—" : pl}</b>
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>

            {/* Results table */}
            <section className="table-wrap">
              <div className="section-head">
                <h2>Results</h2>
                <p>Showing up to 500 recent rows loaded • filtered client-side</p>
              </div>

              {filtered.length === 0 ? (
                <div className="notice">No results for these filters.</div>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        {columns.map((c) => (
                          <th key={c}>{c.replaceAll("_", " ")}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 200).map((r, idx) => (
                        <tr key={idx}>
                          {columns.map((c) => {
                            const v = r[c];
                            const isDate =
                              c === detected.createdKey || c === detected.shiftDateKey;
                            return <td key={c}>{isDate ? formatStamp(v) : safeString(v) || "—"}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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

        .header {
          margin-bottom: 14px;
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

        .cards {
          margin-top: 14px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .card {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 16px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          padding: 12px 14px;
          text-align: left;
        }

        .card-title {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: #0f172a;
        }

        .card-value {
          margin-top: 6px;
          font-size: 20px;
          font-weight: 900;
        }

        .card-sub {
          margin-top: 4px;
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
        }

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

        .latest-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .latest-card {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 16px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          padding: 12px 14px;
          text-align: left;
        }

        .latest-top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .latest-store {
          font-weight: 900;
          font-size: 14px;
        }

        .latest-time {
          font-size: 12px;
          color: #64748b;
          font-weight: 800;
          white-space: nowrap;
        }

        .latest-metrics {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 13px;
          color: #334155;
          font-weight: 800;
        }

        .table-wrap {
          margin-top: 10px;
        }

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
          min-width: 760px;
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
          font-weight: 700;
          color: #0f172a;
        }

        tr:hover td {
          background: rgba(0, 100, 145, 0.04);
        }

        .footer {
          text-align: center;
          margin-top: 18px;
          color: #94a3b8;
          font-size: 0.8rem;
        }

        @media (max-width: 980px) {
          .cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .latest-grid {
            grid-template-columns: 1fr;
          }
          .filters {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
