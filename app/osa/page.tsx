"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

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

  // totals
  totalPointsLost: number;
  starsList: number[];

  // averages (over period)
  avgPointsLost: number; // points lost per audit
  avgStars: number; // 0..5

  lastShiftAt: string | null; // uses shift_date if available, else created_at
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
  return s.replace(/\s+/g, " ");
};

const clampStars = (n: number) => {
  if (!isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 5) return 5;
  return n;
};

// Detect manager name key
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

  const fallback = Array.from(keys).find(
    (k) => k.toLowerCase().includes("points") && k.toLowerCase().includes("lost")
  );
  return fallback || null;
};

const detectStarsKey = (rows: OsaRow[]): string | null => {
  if (!rows.length) return null;
  const candidates = ["stars", "star_rating", "starRating", "rating", "oer_stars"];
  const keys = new Set(Object.keys(rows[0] || {}));
  for (const c of candidates) if (keys.has(c)) return c;

  const fallback = Array.from(keys).find(
    (k) => k.toLowerCase().includes("star") || k.toLowerCase().includes("rating")
  );
  return fallback || null;
};

// Detect shift date key (preferred date for this page)
const detectShiftDateKey = (rows: OsaRow[]): string | null => {
  if (!rows.length) return null;

  const candidates = [
    "shift_date",
    "shiftDate",
    "audit_date",
    "auditDate",
    "visit_date",
    "visitDate",
    "date",
  ];

  const keys = new Set(Object.keys(rows[0] || {}));
  for (const c of candidates) if (keys.has(c)) return c;

  const fallback = Array.from(keys).find((k) => k.toLowerCase().includes("date"));
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

const formatShortDate = (isoDate: string) => {
  // isoDate: YYYY-MM-DD
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const isYYYYMMDD = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

const formatShiftDateAny = (v: any) => {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  if (!s) return "—";
  // date-only
  if (isYYYYMMDD(s)) return formatShortDate(s);
  // timestamp-ish
  return formatStamp(s);
};

export default function InternalOsaScorecardPage() {
  const router = useRouter();

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultFromISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 28);
    return d.toISOString().slice(0, 10);
  }, []);

  // Date filter (inclusive)
  const [fromDate, setFromDate] = useState<string>(defaultFromISO);
  const [toDate, setToDate] = useState<string>(todayISO);

  const [rows, setRows] = useState<OsaRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [dateMode, setDateMode] = useState<"shift_date" | "created_at">("shift_date");

  // Load data for date range:
  // 1) Try shift_date filtering (preferred)
  // 2) If shift_date column doesn’t exist, fall back to created_at filtering
  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setError("Supabase client not available");
        return;
      }
      if (!fromDate || !toDate) return;

      setLoading(true);
      setError(null);

      try {
        // inclusive end -> exclusive next day
        const toNext = new Date(toDate + "T00:00:00.000Z");
        toNext.setDate(toNext.getDate() + 1);
        const toNextISODate = toNext.toISOString().slice(0, 10);

        // Attempt 1: shift_date
        const attemptShift = await supabase
          .from("osa_internal_results")
          .select("*")
          .gte("shift_date", fromDate)
          .lt("shift_date", toNextISODate)
          .order("shift_date", { ascending: false });

        if (!attemptShift.error) {
          setDateMode("shift_date");
          setRows((attemptShift.data || []) as OsaRow[]);
          setLoading(false);
          return;
        }

        // Fall back only if shift_date missing
        const msg = attemptShift.error.message || "";
        const looksLikeMissingShiftDate =
          msg.toLowerCase().includes("shift_date") &&
          (msg.toLowerCase().includes("does not exist") ||
            msg.toLowerCase().includes("column") ||
            msg.toLowerCase().includes("schema cache"));

        if (!looksLikeMissingShiftDate) {
          throw attemptShift.error;
        }

        // Attempt 2: created_at
        const fromIso = new Date(fromDate + "T00:00:00.000Z").toISOString();
        const toExclusiveIso = new Date(toDate + "T00:00:00.000Z");
        toExclusiveIso.setDate(toExclusiveIso.getDate() + 1);
        const toIsoExclusive = toExclusiveIso.toISOString();

        const attemptCreated = await supabase
          .from("osa_internal_results")
          .select("*")
          .gte("created_at", fromIso)
          .lt("created_at", toIsoExclusive)
          .order("created_at", { ascending: false });

        if (attemptCreated.error) throw attemptCreated.error;

        setDateMode("created_at");
        setRows((attemptCreated.data || []) as OsaRow[]);
      } catch (e: any) {
        setError(e?.message || "Could not load OSA results");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [fromDate, toDate]);

  // Aggregate by manager using averages over selected date period
  const managerAgg = useMemo(() => {
    if (!rows.length) {
      return {
        items: [] as ManagerAgg[],
        debug: {
          managerKey: null as string | null,
          plKey: null as string | null,
          starsKey: null as string | null,
          shiftDateKey: null as string | null,
        },
      };
    }

    const managerKey = detectManagerKey(rows);
    const plKey = detectPointsLostKey(rows);
    const starsKey = detectStarsKey(rows);
    const shiftDateKey = detectShiftDateKey(rows);
    const useShiftKey = shiftDateKey || null;

    const bucket: Record<
      string,
      { audits: number; pointsLost: number; stars: number[]; last: string | null }
    > = {};

    for (const r of rows) {
      const name = cleanName(managerKey ? r[managerKey] : null) || "Unknown";

      const pl = plKey ? toNumber(r[plKey]) : null;
      if (plKey && pl === null) continue; // skip rows that can't be averaged

      const st = starsKey ? toNumber(r[starsKey]) : null;
      const stars = st === null ? null : clampStars(st);

      const bestDate =
        (useShiftKey ? cleanName(r[useShiftKey]) : null) ||
        cleanName(r.created_at) ||
        null;

      if (!bucket[name]) bucket[name] = { audits: 0, pointsLost: 0, stars: [], last: null };
      bucket[name].audits += 1;
      bucket[name].pointsLost += pl ?? 0;
      if (stars !== null) bucket[name].stars.push(stars);

      if (!bucket[name].last || (bestDate && bestDate > bucket[name].last!)) {
        bucket[name].last = bestDate;
      }
    }

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const items: ManagerAgg[] = Object.entries(bucket).map(([name, v]) => {
      const audits = v.audits || 0;
      const avgPointsLost = audits ? v.pointsLost / audits : 0;
      const avgStars = avg(v.stars);
      return {
        name,
        audits,
        totalPointsLost: v.pointsLost,
        starsList: v.stars,
        avgPointsLost,
        avgStars,
        lastShiftAt: v.last,
      };
    });

    // Rank: LOWEST avg points lost best, tie-break HIGHER avg stars, then MORE audits
    items.sort((a, b) => {
      if (a.avgPointsLost !== b.avgPointsLost) return a.avgPointsLost - b.avgPointsLost;
      if (b.avgStars !== a.avgStars) return b.avgStars - a.avgStars;
      return b.audits - a.audits;
    });

    return { items, debug: { managerKey, plKey, starsKey, shiftDateKey } };
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
        {/* ✅ NEW: Home / Back buttons */}
        <div className="topbar">
          <button className="navbtn" onClick={() => router.back()} type="button">
            ← Back
          </button>
          <div className="topbar-spacer" />
          <button className="navbtn solid" onClick={() => router.push("/")} type="button">
            🏠 Home
          </button>
        </div>

        <header className="header">
          <h1>Internal OSA Scorecard</h1>
          <p className="subtitle">
            Manager leaderboard • averages over selected dates • date source:{" "}
            <b>{dateMode === "shift_date" ? "shift_date" : "created_at"}</b>
          </p>
        </header>

        {/* Date filters */}
        <section className="filters">
          <div className="filter-card">
            <div className="filter-left">
              <div className="filter-title">Date filter</div>
              <div className="filter-sub">
                Showing results from <b>{formatShortDate(fromDate)}</b> to{" "}
                <b>{formatShortDate(toDate)}</b>
              </div>
            </div>

            <div className="filter-controls">
              <label className="field">
                <span>From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  max={toDate}
                />
              </label>

              <label className="field">
                <span>To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  min={fromDate}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </label>

              <button
                className="quick"
                onClick={() => {
                  const d = new Date();
                  const to = d.toISOString().slice(0, 10);
                  d.setDate(d.getDate() - 7);
                  const from = d.toISOString().slice(0, 10);
                  setFromDate(from);
                  setToDate(to);
                }}
                type="button"
              >
                Last 7 days
              </button>

              <button
                className="quick"
                onClick={() => {
                  const d = new Date();
                  const to = d.toISOString().slice(0, 10);
                  d.setDate(d.getDate() - 28);
                  const from = d.toISOString().slice(0, 10);
                  setFromDate(from);
                  setToDate(to);
                }}
                type="button"
              >
                Last 28 days
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="alert">
            <b>Could not load OSA results:</b> {error}
          </div>
        ) : loading ? (
          <div className="alert muted">Loading results…</div>
        ) : rows.length === 0 ? (
          <div className="alert muted">
            No results found in <code>osa_internal_results</code> for this date range.
          </div>
        ) : (
          <>
            {/* Podium */}
            <section className="podium">
              <div className="podium-head">
                <h2>Top 3 Managers</h2>
                <p>
                  Ranked by <b>lowest avg points lost</b> (tie-break: higher avg stars)
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
                      <div className="podium-name" title={p.name}>
                        {p.name}
                      </div>
                      <div className="podium-metrics">
                        <div>
                          Avg points lost: <b>{p.avgPointsLost.toFixed(1)}</b>
                        </div>
                        <div>
                          Avg stars: <b>{p.avgStars.toFixed(2)}</b>
                        </div>
                        <div>
                          Audits: <b>{p.audits}</b>
                        </div>
                        <div className="muted">
                          Latest shift: <b>{formatShiftDateAny(p.lastShiftAt)}</b>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Leaderboard */}
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
                      <th style={{ width: 160 }}>Avg Points Lost</th>
                      <th style={{ width: 140 }}>Avg Stars</th>
                      <th style={{ width: 100 }}>Audits</th>
                      <th style={{ width: 190 }}>Latest Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((m, i) => (
                      <tr key={`${m.name}-${i}`}>
                        <td className="rank">{i + 1}</td>
                        <td className="name">{m.name}</td>
                        <td className="num">{m.avgPointsLost.toFixed(1)}</td>
                        <td className="num">{m.avgStars.toFixed(2)}</td>
                        <td className="num">{m.audits}</td>
                        <td className="date">{formatShiftDateAny(m.lastShiftAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {table.some((x) => x.name === "Unknown") && (
                <div className="debug">
                  Heads-up: some rows have a blank manager field. Detected keys →{" "}
                  <b>manager:</b> {managerAgg.debug.managerKey || "not found"},{" "}
                  <b>points lost:</b> {managerAgg.debug.plKey || "not found"},{" "}
                  <b>stars:</b> {managerAgg.debug.starsKey || "not found"},{" "}
                  <b>shift date:</b> {managerAgg.debug.shiftDateKey || "not found"}.
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
          padding: 18px 22px 26px;
        }

        /* ✅ Top nav */
        .topbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .topbar-spacer {
          flex: 1;
        }

        .navbtn {
          border-radius: 14px;
          border: 2px solid var(--brand);
          background: #fff;
          color: var(--brand);
          font-weight: 900;
          font-size: 14px;
          padding: 8px 12px;
          cursor: pointer;
          box-shadow: 0 6px 14px rgba(0, 100, 145, 0.12);
          transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
        }

        .navbtn:hover {
          background: var(--brand);
          color: #fff;
          transform: translateY(-1px);
        }

        .navbtn.solid {
          background: var(--brand);
          color: #fff;
        }

        .navbtn.solid:hover {
          background: #004b75;
          border-color: #004b75;
        }

        .header {
          text-align: center;
          margin-bottom: 12px;
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

        /* Filters */
        .filters {
          margin-top: 14px;
        }

        .filter-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          flex-wrap: wrap;
        }

        .filter-title {
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .filter-sub {
          margin-top: 4px;
          font-weight: 800;
          color: #334155;
          font-size: 13px;
        }

        .filter-controls {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
          font-weight: 900;
          color: #334155;
        }

        input[type="date"] {
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.14);
          padding: 8px 10px;
          font-weight: 800;
          background: #fff;
        }

        .quick {
          border-radius: 12px;
          border: 2px solid var(--brand);
          background: #fff;
          color: var(--brand);
          font-weight: 900;
          padding: 8px 10px;
          cursor: pointer;
        }

        .quick:hover {
          background: var(--brand);
          color: #fff;
        }

        .alert {
          margin-top: 14px;
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
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .medal {
          font-size: 20px;
        }

        .rank-label {
          font-size: 12px;
          font-weight: 900;
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

        th,
        td {
          padding: 12px 12px;
          text-align: left;
          font-size: 13px;
        }

        th {
          background: rgba(0, 100, 145, 0.08);
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
        }

        td.rank,
        td.name {
          font-weight: 900;
        }

        td.date {
          font-weight: 800;
          color: #334155;
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
          .podium-head,
          .board-head {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
