"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import HoverStatPanel from "@/components/HoverStatPanel";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

// ---- Types ----
type OsaRow = Record<string, any>;

type LeaderAgg = {
  name: string;
  audits: number;

  totalPointsLost: number;
  starsList: number[];

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

const detectStoreKey = (rows: OsaRow[]): string | null => {
  if (!rows.length) return null;

  const candidates = ["store", "store_name", "storename", "location", "branch"];
  const keys = new Set(Object.keys(rows[0] || {}));
  for (const c of candidates) if (keys.has(c)) return c;

  const fallback = Array.from(keys).find((k) => k.toLowerCase().includes("store"));
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

const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

const toISODateLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toISODateUK = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
};

const parseISODate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const startOfThisMonthLocal = () => {
  const todayUk = toISODateUK(new Date());
  const [year, month] = todayUk.split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1);
};

const startOfThisYearLocal = () => {
  const todayUk = toISODateUK(new Date());
  const [year] = todayUk.split("-").map(Number);
  return new Date(year || 1970, 0, 1);
};

const inRange = (dateStr: string, from: Date, toExclusive: Date) => {
  if (!dateStr) return false;
  const probe = String(dateStr).slice(0, 10);
  if (!isYYYYMMDD(probe)) return false;

  const fromIso = toISODateUK(from);
  const toIsoExclusive = toISODateUK(toExclusive);
  return probe >= fromIso && probe < toIsoExclusive;
};

const calcStats = (rows: OsaRow[]) => {
  const values = rows
    .map((r) => toNumber(r.overall_points))
    .filter((n): n is number => n !== null);

  return {
    visits: rows.length,
    avgScore: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
  };
};

const emptyStatWindow = () => ({
  visits: 0,
  avgScore: 0,
});

const getTomorrowStart = () => {
  const tomorrow = parseISODate(toISODateUK(new Date()));
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
};

const getWeekRange = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    from: toISODateLocal(monday),
    to: toISODateLocal(sunday),
  };
};

const getMonthRange = () => {
  const first = startOfThisMonthLocal();
  const today = parseISODate(toISODateUK(new Date()));

  return {
    from: toISODateLocal(first),
    to: toISODateLocal(today),
  };
};

const getYearRange = () => {
  const first = startOfThisYearLocal();
  const today = parseISODate(toISODateUK(new Date()));

  return {
    from: toISODateLocal(first),
    to: toISODateLocal(today),
  };
};

const pillClassFromStars = (stars: number) => {
  if (stars >= 4.5) return "pill green";
  if (stars >= 4.0) return "pill amber";
  return "pill red";
};

const pillClassFromPointsLost = (pl: number) => {
  if (pl <= 10) return "pill green";
  if (pl <= 20) return "pill amber";
  return "pill red";
};

function buildAgg(
  rows: OsaRow[],
  nameKey: string | null,
  plKey: string | null,
  starsKey: string | null,
  dateKey: string | null,
  unknownLabel: string
): { items: LeaderAgg[] } {
  const bucket: Record<
    string,
    { audits: number; pointsLost: number; stars: number[]; last: string | null }
  > = {};

  for (const r of rows) {
    const name = cleanName(nameKey ? r[nameKey] : null) || unknownLabel;

    const pl = plKey ? toNumber(r[plKey]) : null;
    if (plKey && pl === null) continue;

    const st = starsKey ? toNumber(r[starsKey]) : null;
    const stars = st === null ? null : clampStars(st);

    const bestDate =
      (dateKey ? cleanName(r[dateKey]) : null) || cleanName(r.created_at) || null;

    if (!bucket[name]) bucket[name] = { audits: 0, pointsLost: 0, stars: [], last: null };
    bucket[name].audits += 1;
    bucket[name].pointsLost += pl ?? 0;
    if (stars !== null) bucket[name].stars.push(stars);

    if (!bucket[name].last || (bestDate && bestDate > bucket[name].last!)) {
      bucket[name].last = bestDate;
    }
  }

  const items: LeaderAgg[] = Object.entries(bucket).map(([name, v]) => {
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

  return { items };
}

export default function InternalOsaScorecardPage() {
  const router = useRouter();

  const defaultWeekRange = useMemo(() => getWeekRange(), []);

  // Date filter (inclusive)
  const [fromDate, setFromDate] = useState<string>(defaultWeekRange.from);
  const [toDate, setToDate] = useState<string>(defaultWeekRange.to);
  const [activeDateFilter, setActiveDateFilter] = useState<
    "this_week" | "this_month" | "this_year" | "custom"
  >("this_week");

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

  const debugKeys = useMemo(() => {
    if (!rows.length)
      return { managerKey: null, storeKey: null, plKey: null, starsKey: null, shiftDateKey: null };

    const managerKey = detectManagerKey(rows);
    const storeKey = detectStoreKey(rows);
    const plKey = detectPointsLostKey(rows);
    const starsKey = detectStarsKey(rows);
    const shiftDateKey = detectShiftDateKey(rows);

    return { managerKey, storeKey, plKey, starsKey, shiftDateKey };
  }, [rows]);

  const effectiveDateKey = useMemo(() => {
    // Use whichever date column exists (prefer shift_date-style)
    return debugKeys.shiftDateKey || null;
  }, [debugKeys.shiftDateKey]);

  // Manager agg
  const managerAgg = useMemo(() => {
    if (!rows.length)
      return { items: [] as LeaderAgg[] };

    return buildAgg(
      rows,
      debugKeys.managerKey,
      debugKeys.plKey,
      debugKeys.starsKey,
      effectiveDateKey,
      "Unknown"
    );
  }, [rows, debugKeys, effectiveDateKey]);

  // Store agg
  const storeAgg = useMemo(() => {
    if (!rows.length)
      return { items: [] as LeaderAgg[] };

    return buildAgg(
      rows,
      debugKeys.storeKey,
      debugKeys.plKey,
      debugKeys.starsKey,
      effectiveDateKey,
      "Unknown store"
    );
  }, [rows, debugKeys, effectiveDateKey]);

  const mgrPodium = managerAgg.items.slice(0, 3);
  const mgrTable = managerAgg.items;

  const storePodium = storeAgg.items.slice(0, 3);
  const storeTable = storeAgg.items;

  const showUnknownManagers = mgrTable.some((x) => x.name === "Unknown");
  const showUnknownStores = storeTable.some((x) => x.name === "Unknown store");

  const { mtdStats, ytdStats } = useMemo(() => {
    if (!rows.length) {
      return {
        mtdStats: emptyStatWindow(),
        ytdStats: emptyStatWindow(),
      };
    }

    const tomorrow = getTomorrowStart();

    const mtdRows = rows.filter((r) =>
      inRange(String(r.shift_date || ""), startOfThisMonthLocal(), tomorrow)
    );
    const ytdRows = rows.filter((r) =>
      inRange(String(r.shift_date || ""), startOfThisYearLocal(), tomorrow)
    );

    return {
      mtdStats: calcStats(mtdRows),
      ytdStats: calcStats(ytdRows),
    };
  }, [rows]);

  const managerStatWindows = useMemo(() => {
    const byManager: Record<
      string,
      {
        mtd: { visits: number; avgScore: number | null };
        ytd: { visits: number; avgScore: number | null };
      }
    > = {};

    const managerKey = debugKeys.managerKey;
    if (!rows.length || !managerKey) return byManager;

    const tomorrow = getTomorrowStart();
    const monthStart = startOfThisMonthLocal();
    const yearStart = startOfThisYearLocal();

    const makeWindow = (windowRows: OsaRow[]) => {
      const stats = calcStats(windowRows);
      return {
        visits: stats.visits,
        avgScore: stats.visits ? stats.avgScore : null,
      };
    };

    for (const manager of mgrTable) {
      const managerRows = rows.filter(
        (r) => (cleanName(r[managerKey]) || "Unknown") === manager.name
      );

      const mtdRows = managerRows.filter((r) =>
        inRange(String((effectiveDateKey ? r[effectiveDateKey] : r.shift_date) || ""), monthStart, tomorrow)
      );
      const ytdRows = managerRows.filter((r) =>
        inRange(String((effectiveDateKey ? r[effectiveDateKey] : r.shift_date) || ""), yearStart, tomorrow)
      );

      byManager[manager.name] = {
        mtd: makeWindow(mtdRows),
        ytd: makeWindow(ytdRows),
      };
    }

    return byManager;
  }, [rows, mgrTable, debugKeys.managerKey, effectiveDateKey]);

  return (
    <main className="wrap">
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <div className="shell">
        {/* Home / Back */}
        <div className="topbar">
          <button className="navbtn" onClick={() => router.back()} type="button">
            ← Back
          </button>
          <div className="topbar-spacer" />
          <button
            className="navbtn solid"
            onClick={() => router.push("/")}
            type="button"
          >
            🏠 Home
          </button>
        </div>

        <header className="header">
          <h1>Internal OSA Scorecard</h1>
          <p className="subtitle">
            Averages over selected dates • date source:{" "}
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
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setActiveDateFilter("custom");
                  }}
                  max={toDate}
                />
              </label>

              <label className="field">
                <span>To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setActiveDateFilter("custom");
                  }}
                  min={fromDate}
                />
              </label>

              <button
                className={`quick ${activeDateFilter === "this_week" ? "active" : ""}`}
                onClick={() => {
                  const { from, to } = getWeekRange();
                  setFromDate(from);
                  setToDate(to);
                  setActiveDateFilter("this_week");
                }}
                type="button"
              >
                This week
              </button>

              <button
                className={`quick ${activeDateFilter === "this_month" ? "active" : ""}`}
                onClick={() => {
                  const { from, to } = getMonthRange();
                  setFromDate(from);
                  setToDate(to);
                  setActiveDateFilter("this_month");
                }}
                type="button"
              >
                This Month
              </button>

              <button
                className={`quick ${activeDateFilter === "this_year" ? "active" : ""}`}
                onClick={() => {
                  const { from, to } = getYearRange();
                  setFromDate(from);
                  setToDate(to);
                  setActiveDateFilter("this_year");
                }}
                type="button"
              >
                This Year
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
            No results found in <code>osa_internal_results</code> for this date
            range.
          </div>
        ) : (
          <>
            {/* Manager scorecard */}
            <section className="section">
              <div className="section-head">
                <div>
                  <h2>Manager scorecard</h2>
                  <p>
                    Ranked by <b>lowest avg points lost</b> (tie-break: higher avg
                    stars)
                  </p>
                </div>
                <div className="kpi-mini">
                  <span className="kpi-chip">
                    <b>MTD</b> {mtdStats.visits} visits • {mtdStats.avgScore.toFixed(1)} avg
                  </span>
                  <span className="kpi-chip">
                    <b>YTD</b> {ytdStats.visits} visits • {ytdStats.avgScore.toFixed(1)} avg
                  </span>
                  <span className="kpi-chip">
                    <b>{mgrTable.length}</b> managers
                  </span>
                  <span className="kpi-chip">
                    <b>{rows.length}</b> audits
                  </span>
                </div>
              </div>

              {/* Podium */}
              <div className="podium-grid">
                {mgrPodium.map((p, idx) => {
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
                        <div className="metric-row">
                          <span>Avg points lost</span>
                          <span className={pillClassFromPointsLost(p.avgPointsLost)}>
                            {p.avgPointsLost.toFixed(1)}
                          </span>
                        </div>
                        <div className="metric-row">
                          <span>Avg stars</span>
                          <span className={pillClassFromStars(p.avgStars)}>
                            {p.avgStars.toFixed(2)}
                          </span>
                        </div>
                        <div className="metric-row">
                          <span>Audits</span>
                          <b>{p.audits}</b>
                        </div>
                        <div className="metric-row muted">
                          <span>Latest shift</span>
                          <b>{formatShiftDateAny(p.lastShiftAt)}</b>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Table */}
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Rank</th>
                      <th>Manager</th>
                      <th style={{ width: 170 }}>Avg Points Lost</th>
                      <th style={{ width: 140 }}>Avg Stars</th>
                      <th style={{ width: 100 }}>Audits</th>
                      <th style={{ width: 190 }}>Latest Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mgrTable.map((m, i) => (
                      <tr key={`${m.name}-${i}`}>
                        <td className="rank">{i + 1}</td>
                        <td className="name">
                          <HoverStatPanel
                            label={m.name}
                            mtd={managerStatWindows[m.name]?.mtd ?? { visits: 0, avgScore: null }}
                            ytd={managerStatWindows[m.name]?.ytd ?? { visits: 0, avgScore: null }}
                          >
                            <span>{m.name}</span>
                          </HoverStatPanel>
                        </td>
                        <td className="num">
                          <span className={pillClassFromPointsLost(m.avgPointsLost)}>
                            {m.avgPointsLost.toFixed(1)}
                          </span>
                        </td>
                        <td className="num">
                          <span className={pillClassFromStars(m.avgStars)}>
                            {m.avgStars.toFixed(2)}
                          </span>
                        </td>
                        <td className="num">{m.audits}</td>
                        <td className="date">{formatShiftDateAny(m.lastShiftAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {showUnknownManagers && (
                <div className="debug">
                  Heads-up: some rows have a blank manager field. Detected keys →{" "}
                  <b>manager:</b> {debugKeys.managerKey || "not found"},{" "}
                  <b>points lost:</b> {debugKeys.plKey || "not found"},{" "}
                  <b>stars:</b> {debugKeys.starsKey || "not found"},{" "}
                  <b>shift date:</b> {debugKeys.shiftDateKey || "not found"}.
                </div>
              )}
            </section>

            {/* Store scorecard */}
            <section className="section">
              <div className="section-head">
                <div>
                  <h2>Store scorecard</h2>
                  <p>
                    Ranked by <b>lowest avg points lost</b> (tie-break: higher avg
                    stars)
                  </p>
                </div>
                <div className="kpi-mini">
                  <span className="kpi-chip">
                    <b>{storeTable.length}</b> stores
                  </span>
                </div>
              </div>

              {/* Podium */}
              <div className="podium-grid">
                {storePodium.map((p, idx) => {
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
                        <div className="metric-row">
                          <span>Avg points lost</span>
                          <span className={pillClassFromPointsLost(p.avgPointsLost)}>
                            {p.avgPointsLost.toFixed(1)}
                          </span>
                        </div>
                        <div className="metric-row">
                          <span>Avg stars</span>
                          <span className={pillClassFromStars(p.avgStars)}>
                            {p.avgStars.toFixed(2)}
                          </span>
                        </div>
                        <div className="metric-row">
                          <span>Audits</span>
                          <b>{p.audits}</b>
                        </div>
                        <div className="metric-row muted">
                          <span>Latest shift</span>
                          <b>{formatShiftDateAny(p.lastShiftAt)}</b>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Table */}
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Rank</th>
                      <th>Store</th>
                      <th style={{ width: 170 }}>Avg Points Lost</th>
                      <th style={{ width: 140 }}>Avg Stars</th>
                      <th style={{ width: 100 }}>Audits</th>
                      <th style={{ width: 190 }}>Latest Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeTable.map((s, i) => (
                      <tr key={`${s.name}-${i}`}>
                        <td className="rank">{i + 1}</td>
                        <td className="name">{s.name}</td>
                        <td className="num">
                          <span className={pillClassFromPointsLost(s.avgPointsLost)}>
                            {s.avgPointsLost.toFixed(1)}
                          </span>
                        </td>
                        <td className="num">
                          <span className={pillClassFromStars(s.avgStars)}>
                            {s.avgStars.toFixed(2)}
                          </span>
                        </td>
                        <td className="num">{s.audits}</td>
                        <td className="date">{formatShiftDateAny(s.lastShiftAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {showUnknownStores && (
                <div className="debug">
                  Heads-up: some rows have a blank store field. Detected keys →{" "}
                  <b>store:</b> {debugKeys.storeKey || "not found"},{" "}
                  <b>points lost:</b> {debugKeys.plKey || "not found"},{" "}
                  <b>stars:</b> {debugKeys.starsKey || "not found"},{" "}
                  <b>shift date:</b> {debugKeys.shiftDateKey || "not found"}.
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
          background: radial-gradient(circle at top, rgba(0, 100, 145, 0.08), transparent 45%),
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

        /* Top nav */
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

        .quick.active {
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

        /* Sections */
        .section {
          margin-top: 16px;
        }

        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }

        .section-head h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
        }

        .section-head p {
          margin: 4px 0 0;
          font-size: 12px;
          color: var(--muted);
          font-weight: 800;
        }

        .kpi-mini {
          display: inline-flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
        }

        .kpi-chip {
          font-size: 12px;
          font-weight: 900;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.08);
          border: 1px solid rgba(0, 100, 145, 0.14);
          color: #004b75;
          white-space: nowrap;
        }

        /* Podium */
        .podium-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 12px;
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
          margin-bottom: 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .podium-metrics {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 13px;
          color: #334155;
          font-weight: 800;
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        /* Pills */
        .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 76px;
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(2, 6, 23, 0.04);
          color: rgba(15, 23, 42, 0.8);
        }

        .pill.green {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.22);
          color: #166534;
        }

        .pill.amber {
          background: rgba(249, 115, 22, 0.12);
          border-color: rgba(249, 115, 22, 0.22);
          color: #9a3412;
        }

        .pill.red {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.22);
          color: #991b1b;
        }

        /* Table */
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
          .section-head {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
