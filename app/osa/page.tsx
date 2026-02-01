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

// ---- Types ----
type OsaRow = Record<string, any>;

type ManagerAgg = {
  name: string;
  audits: number;
  totalPointsLost: number;
  avgStars: number; // 0..5
  lastAuditAt: string | null;
};

const toNumber = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && !isNaN(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
};

const cleanName = (v: any): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  // remove double spaces
  return s.replace(/\s+/g, " ");
};

// Picks the first column name that exists in rows AND looks like a "manager" field.
const detectManagerKey = (rows: OsaRow[]): string | null => {
  if (!rows.length) return null;

  const candidates = [
    "manager",
    "closing_manager",
    "shift_manager",
    "shift_runner",
    "assessor",
    "auditor",
    "submitted_by",
    "submittedby",
    "user_name",
    "username",
    "user",
    "name",
    "team_member",
    "team_member_name",
  ];

  const keys = new Set(Object.keys(rows[0] || {}));
  for (const c of candidates) if (keys.has(c)) return c;

  // Fallback: pick any key containing "manager" or "submitted"
  const fallback = Array.from(keys).find(
    (k) =>
      k.toLowerCase().includes("manager") ||
      k.toLowerCase().includes("submitted") ||
      k.toLowerCase().includes("assessor") ||
      k.toLowerCase().includes("auditor")
  );
  return fallback || null;
};

const detectPointsLostKey = (rows: OsaRow[]): string | null => {
  if (!rows.length) return null;
  const candidates = ["points_lost", "pointsLost", "pl", "point_loss", "points_loss"];
  const keys = new Set(Object.keys(rows[0] || {}));
  for (const c of candidates) if (keys.has(c)) return c;

  const fallback = Array.from(keys).find((k) =>
    k.toLowerCase().includes("points") && k.toLowerCase().includes("lost")
  );
  return fallback || null;
};

const detectStarsKey = (rows: OsaRow[]): string | null => {
  if (!rows.length) return null;
  const candidates = ["stars", "star_rating", "starRating", "rating", "oer_stars"];
  const keys = new Set(Object.keys(rows[0] || {}));
  for (const c of candidates) if (keys.has(c)) return c;

  const fallback = Array.from(keys).find((k) =>
    k.toLowerCase().includes("star") || k.toLowerCase().includes("rating")
  );
  return fallback || null;
};

const formatStamp = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function InternalOsaScorecardPage() {
  const [rows, setRows] = useState<OsaRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load data (last 28 days by created_at)
  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setError("Supabase client not available");
        return;
      }
      try {
        setError(null);

        const now = new Date();
        const from = new Date(now);
        from.setDate(now.getDate() - 28);
        const fromIso = from.toISOString();

        const { data, error } = await supabase
          .from("osa_internal_results")
          .select("*")
          .gte("created_at", fromIso)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setRows((data || []) as OsaRow[]);
      } catch (e: any) {
        setError(e?.message || "Could not load OSA results");
        setRows([]);
      }
    };

    load();
  }, []);

  // Aggregate by manager
  const managerAgg = useMemo(() => {
    if (!rows.length) return { items: [] as ManagerAgg[], debug: { managerKey: null as string | null, plKey: null as string | null, starsKey: null as string | null } };

    const managerKey = detectManagerKey(rows);
    const plKey = detectPointsLostKey(rows);
    const starsKey = detectStarsKey(rows);

    // If we can’t find keys, we still try best-effort.
    const bucket: Record<
      string,
      { audits: number; pointsLost: number; stars: number[]; last: string | null }
    > = {};

    for (const r of rows) {
      const nameRaw = managerKey ? r[managerKey] : null;
      const name = cleanName(nameRaw) || "Unknown";

      // If points_lost exists but is null/blank, exclude row from leaderboard (prevents “ghost wins”)
      const pl = plKey ? toNumber(r[plKey]) : null;
      if (plKey && pl === null) continue;

      const stars = starsKey ? toNumber(r[starsKey]) : null;
      const createdAt = cleanName(r.created_at) || null;

      if (!bucket[name]) bucket[name] = { audits: 0, pointsLost: 0, stars: [], last: null };
      bucket[name].audits += 1;
      bucket[name].pointsLost += pl ?? 0;
      if (stars !== null) bucket[name].stars.push(stars);
      if (!bucket[name].last || (createdAt && createdAt > bucket[name].last!)) bucket[name].last = createdAt;
    }

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const items: ManagerAgg[] = Object.entries(bucket).map(([name, v]) => ({
      name,
      audits: v.audits,
      totalPointsLost: v.pointsLost,
      avgStars: avg(v.stars),
      lastAuditAt: v.last,
    }));

    // Rank: LOWEST points lost is best, tie-break higher stars, then more audits
    items.sort((a, b) => {
      if (a.totalPointsLost !== b.totalPointsLost) return a.totalPointsLost - b.totalPointsLost;
      if (b.avgStars !== a.avgStars) return b.avgStars - a.avgStars;
      return b.audits - a.audits;
    });

    return { items, debug: { managerKey, plKey, starsKey } };
  }, [rows]);

  const podium = managerAgg.items.slice(0, 3);
  const table = managerAgg.items;

  return (
    <main className="wrap">
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <div className="shell">
        <header className="header">
          <h1>Internal OSA Scorecard</h1>
          <p className="subtitle">Manager leaderboard • last 28 days</p>
        </header>

        {error ? (
          <div className="alert">
            <b>Could not load OSA results:</b> {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="alert muted">
            No results found in <code>osa_internal_results</code> for the last 28 days.
          </div>
        ) : (
          <>
            {/* Podium */}
            <section className="podium">
              <div className="podium-head">
                <h2>Top 3 Managers</h2>
                <p>
                  Ranked by <b>lowest total points lost</b> (tie-break: higher stars)
                </p>
              </div>

              <div className="podium-grid">
                {podium.map((p, idx) => {
                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
                  return (
                    <div key={p.name} className={`podium-card rank-${idx + 1}`}>
                      <div className="podium-top">
                        <span className="medal">{medal}</span>
                        <span className="rank-label">Rank #{idx + 1}</span>
                      </div>
                      <div className="podium-name" title={p.name}>{p.name}</div>
                      <div className="podium-metrics">
                        <div>
                          Points lost: <b>{p.totalPointsLost.toFixed(0)}</b>
                        </div>
                        <div>
                          Avg stars: <b>{p.avgStars.toFixed(2)}</b>
                        </div>
                        <div>
                          Audits: <b>{p.audits}</b>
                        </div>
                        <div className="muted">
                          Last: <b>{formatStamp(p.lastAuditAt)}</b>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Leaderboard table */}
            <section className="board">
              <div className="board-head">
                <h2>Leaderboard</h2>
                <p>All managers in period</p>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Rank</th>
                      <th>Manager</th>
                      <th style={{ width: 140 }}>Points Lost</th>
                      <th style={{ width: 120 }}>Avg Stars</th>
                      <th style={{ width: 100 }}>Audits</th>
                      <th style={{ width: 190 }}>Last Audit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((m, i) => (
                      <tr key={`${m.name}-${i}`}>
                        <td className="rank">{i + 1}</td>
                        <td className="name">{m.name}</td>
                        <td className="num">{m.totalPointsLost.toFixed(0)}</td>
                        <td className="num">{m.avgStars.toFixed(2)}</td>
                        <td className="num">{m.audits}</td>
                        <td className="date">{formatStamp(m.lastAuditAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tiny debug helper (only shows if "Unknown" appears) */}
              {table.some((x) => x.name === "Unknown") && (
                <div className="debug">
                  Heads-up: some rows have a blank manager field. Detected keys →{" "}
                  <b>manager:</b> {managerAgg.debug.managerKey || "not found"},{" "}
                  <b>points lost:</b> {managerAgg.debug.plKey || "not found"},{" "}
                  <b>stars:</b> {managerAgg.debug.starsKey || "not found"}.
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
          background:
            radial-gradient(circle at top, rgba(0, 100, 145, 0.08), transparent 45%),
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
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: saturate(160%) blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 1.5rem;
          box-shadow: var(--shadow);
          padding: 26px 22px 26px;
        }

        .header {
          text-align: center;
          margin-bottom: 10px;
        }

        .header h1 {
          font-size: clamp(2rem, 3vw, 2.3rem);
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

        .alert {
          margin-top: 16px;
          background: rgba(254, 242, 242, 0.9);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 800;
          color: #7f1d1d;
        }

        .alert.muted {
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(15, 23, 42, 0.1);
          color: #334155;
          font-weight: 800;
        }

        .muted {
          color: var(--muted);
        }

        /* Podium */
        .podium {
          margin-top: 16px;
        }

        .podium-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-bottom: 10px;
        }

        .podium-head h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
        }

        .podium-head p {
          margin: 0;
          font-size: 12px;
          color: var(--muted);
          font-weight: 800;
        }

        .podium-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .podium-card {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 18px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          padding: 12px 14px;
          position: relative;
          overflow: hidden;
        }

        .podium-card.rank-1 {
          border-color: rgba(245, 158, 11, 0.35);
        }

        .podium-card.rank-2 {
          border-color: rgba(148, 163, 184, 0.45);
        }

        .podium-card.rank-3 {
          border-color: rgba(249, 115, 22, 0.35);
        }

        .podium-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .medal {
          font-size: 20px;
        }

        .rank-label {
          font-size: 12px;
          font-weight: 900;
          color: #0f172a;
          opacity: 0.85;
        }

        .podium-name {
          font-size: 16px;
          font-weight: 900;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .podium-metrics {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 13px;
          color: #334155;
          font-weight: 800;
        }

        /* Table */
        .board {
          margin-top: 18px;
        }

        .board-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-bottom: 10px;
        }

        .board-head h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
        }

        .board-head p {
          margin: 0;
          font-size: 12px;
          color: var(--muted);
          font-weight: 800;
        }

        .table-wrap {
          overflow-x: auto;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
        }

        .table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px 12px;
          text-align: left;
          font-size: 13px;
        }

        th {
          background: rgba(0, 100, 145, 0.08);
          color: #0f172a;
          font-weight: 900;
          letter-spacing: 0.02em;
        }

        tr + tr td {
          border-top: 1px solid rgba(15, 23, 42, 0.06);
        }

        td.num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          font-weight: 900;
          color: #0f172a;
        }

        td.rank {
          font-weight: 900;
          color: #0f172a;
        }

        td.name {
          font-weight: 900;
          color: #0f172a;
        }

        td.date {
          color: #334155;
          font-weight: 800;
        }

        .debug {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.7);
          border: 1px dashed rgba(15, 23, 42, 0.2);
          color: #334155;
          font-weight: 800;
          font-size: 12px;
        }

        .footer {
          text-align: center;
          margin-top: 18px;
          color: #94a3b8;
          font-size: 0.8rem;
        }

        @media (max-width: 980px) {
          .podium-grid {
            grid-template-columns: 1fr;
          }
          .podium-head, .board-head {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
