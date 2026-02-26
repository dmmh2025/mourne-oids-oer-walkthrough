"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

type TickerItem = {
  message: string;
  active: boolean;
  category?: string | null;
};

type HubStatus = {
  serviceLastUpdated: string | null;
  costLastUpdated: string | null;
  osaLastUpdated: string | null;
  error?: string | null;
};

type ServiceRowMini = {
  store: string;
  dot_pct: number | null;
  labour_pct: number | null;
  rnl_minutes?: number | null;
  manager: string | null;
  created_at?: string | null;
  shift_date?: string | null;
};

type RankedItem = {
  name: string;
  avgDOT: number;
  avgLabour: number;
  avgRnlMinutes: number;
  shifts: number;
};

type ImprovedItem = {
  name: string;
  dotDelta: number;
  weekDOT: number;
};

type OsaInternalRow = {
  shift_date: string;
  team_member_name: string | null;
  points_lost: number | null;
};

type CostControlRowMini = {
  store: string | null;
  shift_date: string;
  sales_gbp: number | null;
  labour_cost_gbp: number | null;
  ideal_food_cost_gbp: number | null;
  actual_food_cost_gbp: number | null;
};

type OsaWinner = {
  name: string;
  avgPointsLost: number | null;
};

type CostWinner = {
  labourName: string;
  labourPct: number | null;
  foodName: string;
  foodVarPctSales: number | null;
};

type TileVariant =
  | "service"
  | "standards"
  | "reports"
  | "osa"
  | "costcontrols" // ✅ ADDED
  | "dailyupdate" // ✅ ADDED
  | "profile"
  | "deepclean"
  | "memomailer"
  | "promo"
  | "admin";

type Tile = {
  href: string;
  title: string;
  desc: string;
  variant: TileVariant;
  pill: string;
  icon: string;
  badge?: "NEW" | null;
};

const TILES: Tile[] = [
  {
    href: "/dashboard/service",
    title: "Service Dashboard",
    desc: "Live snapshots, sales, service metrics.",
    variant: "service",
    pill: "Service",
    icon: "📊",
    badge: null,
  },
  {
    href: "/dashboard/mpi",
    title: "📊 Manager Performance Index (YTD)",
    desc: "Year-to-date manager performance metrics.",
    variant: "service",
    pill: "Service",
    icon: "📊",
    badge: null,
  },
  {
    href: "/walkthrough",
    title: "Standards Walkthrough",
    desc: "Store readiness + photos + automatic summary.",
    variant: "standards",
    pill: "Standards",
    icon: "🧾",
    badge: "NEW",
  },
  {
    href: "/admin",
    title: "Standards Completion report",
    desc: "Review store performance and submissions.",
    variant: "reports",
    pill: "Reports",
    icon: "📈",
    badge: "NEW",
  },
  {
    href: "/osa",
    title: "Internal OSA Scorecard",
    desc: "Scorecards, results, and rankings.",
    variant: "osa",
    pill: "OSA",
    icon: "⭐",
    badge: "NEW",
  },

  // ✅ ADDED: Cost Controls tile
  {
    href: "/cost-controls",
    title: "Cost Controls",
    desc: "Labour + food variance trends and rankings.",
    variant: "costcontrols",
    pill: "Costs",
    icon: "💷",
    badge: "NEW",
  },
  {
    href: "/dashboard/daily-update",
    title: "Daily Update",
    desc: "Today’s message, targets, tasks + yesterday’s service recap.",
    variant: "dailyupdate",
    pill: "Daily",
    icon: "🧾",
    badge: "NEW",
  },

  {
    href: "/profiles",
    title: "My Profile",
    desc: "Update details & password.",
    variant: "profile",
    pill: "Account",
    icon: "👤",
    badge: null,
  },
  {
    href: "/deep-clean",
    title: "Deep Clean",
    desc: "Track progress across all stores.",
    variant: "deepclean",
    pill: "Checklist",
    icon: "🧽",
    badge: null,
  },
  {
    href: "/memomailer",
    title: "Weekly MemoMailer",
    desc: "Latest PDF loaded from Supabase.",
    variant: "memomailer",
    pill: "MemoMailer",
    icon: "📬",
    badge: null,
  },
  {
    href: "/pizza-of-the-week",
    title: "Pizza of the Week",
    desc: "Best Pizza seen this week.",
    variant: "promo",
    pill: "Promo",
    icon: "🍕",
    badge: null,
  },
  {
    href: "/admin/ticker",
    title: "Admin",
    desc: "Manage ticker, service uploads, memomailer.",
    variant: "admin",
    pill: "Admin",
    icon: "⚙️",
    badge: null,
  },
];

function accent(variant: TileVariant) {
  switch (variant) {
    case "service":
      return { a: "#006491", b: "#004b75" };
    case "standards":
      return { a: "#16A34A", b: "#166534" };
    case "reports":
      return { a: "#F59E0B", b: "#B45309" };
    case "osa":
      return { a: "#7C3AED", b: "#4C1D95" };

    // ✅ ADDED: Cost Controls accent
    case "costcontrols":
      return { a: "#0F766E", b: "#065F46" };
    case "dailyupdate":
      return { a: "#2563EB", b: "#1E3A8A" };

    case "profile":
      return { a: "#0EA5E9", b: "#0369A1" };
    case "deepclean":
      return { a: "#22C55E", b: "#15803D" };
    case "memomailer":
      return { a: "#EF4444", b: "#991B1B" };
    case "promo":
      return { a: "#E31837", b: "#8A1020" };
    case "admin":
      return { a: "#0F172A", b: "#334155" };
    default:
      return { a: "#006491", b: "#004b75" };
  }
}

export default function HubPage() {
  const [tickerMessages, setTickerMessages] = useState<TickerItem[]>([]);
  const [tickerError, setTickerError] = useState<string | null>(null);

  const [status, setStatus] = useState<HubStatus>({
    serviceLastUpdated: null,
    costLastUpdated: null,
    osaLastUpdated: null,
    error: null,
  });

  const [svcRows, setSvcRows] = useState<ServiceRowMini[]>([]);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);
  const [osaWinner, setOsaWinner] = useState<OsaWinner | null>(null);
  const [osaHighlightError, setOsaHighlightError] = useState<string | null>(null);
  const [costWinner, setCostWinner] = useState<CostWinner | null>(null);
  const [costHighlightError, setCostHighlightError] = useState<string | null>(null);

  const normalisePct = (v: number | null) => {
    if (v == null) return null;
    return v > 1 ? v / 100 : v;
  };

  const formatStamp = (iso: string | null) => {
    if (!iso) return "No submissions yet";
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPct = (v: number | null, dp = 0) =>
    v == null ? "—" : (v * 100).toFixed(dp) + "%";

  const formatAvgPointsLost = (v: number | null) =>
    v == null ? "—" : v.toFixed(1);

  const getCategoryColor = (cat?: string | null) => {
    const c = (cat || "").toLowerCase();
    if (c === "service push") return "#E31837";
    if (c === "celebration") return "#16A34A";
    if (c === "ops") return "#F59E0B";
    if (c === "warning") return "#7C3AED";
    return "#ffffff";
  };

  // Load ticker
  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setTickerError("Supabase client not available");
        return;
      }
      const { data, error } = await supabase
        .from("news_ticker")
        .select("message, active, category")
        .order("created_at", { ascending: false });

      if (error) {
        setTickerError(error.message);
        return;
      }

      if (!data || data.length === 0) {
        setTickerMessages([]);
        return;
      }

      const active = data.filter((d: any) => d.active === true);
      setTickerMessages((active.length > 0 ? active : data) as TickerItem[]);
    };
    load();
  }, []);

  // Load hub status
  useEffect(() => {
    const loadStatus = async () => {
      if (!supabase) {
        setStatus((s) => ({ ...s, error: "Supabase client not available" }));
        return;
      }

      try {
        const { data: svcData, error: svcErr } = await supabase
          .from("service_shifts")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1);

        const { data: osaData, error: osaErr } = await supabase
          .from("osa_internal_results")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1);

        const { data: costData, error: costErr } = await supabase
          .from("cost_control_entries")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1);

        if (svcErr) throw svcErr;
        if (osaErr) throw osaErr;
        if (costErr) throw costErr;

        setStatus({
          serviceLastUpdated: svcData?.[0]?.created_at ?? null,
          costLastUpdated: costData?.[0]?.created_at ?? null,
          osaLastUpdated: osaData?.[0]?.created_at ?? null,
          error: null,
        });
      } catch (e: any) {
        setStatus((s) => ({
          ...s,
          error: e?.message || "Could not load status",
        }));
      }
    };

    loadStatus();
  }, []);

  // Load service rows for highlights (from earliest required window)
  useEffect(() => {
    const loadHighlights = async () => {
      if (!supabase) {
        setHighlightsError("Supabase client not available");
        return;
      }

      try {
        setHighlightsError(null);

        const now = new Date();
        const day = now.getDay();
        const mondayOffset = day === 0 ? 6 : day - 1;

        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - mondayOffset);
        weekStart.setHours(0, 0, 0, 0);

        const prevWeekStart = new Date(weekStart);
        prevWeekStart.setDate(weekStart.getDate() - 7);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);

        const from = prevWeekStart < monthStart ? prevWeekStart : monthStart;
        const fromStr = from.toISOString().slice(0, 10);

        const { data, error } = await supabase
          .from("service_shifts")
          .select(
            "store, dot_pct, labour_pct, rnl_minutes, manager, created_at, shift_date"
          )
          .gte("shift_date", fromStr)
          .order("shift_date", { ascending: false });

        if (error) throw error;

        setSvcRows((data || []) as ServiceRowMini[]);
      } catch (e: any) {
        setHighlightsError(e?.message || "Could not load highlights");
        setSvcRows([]);
      }
    };

    loadHighlights();
  }, []);


  useEffect(() => {
    const loadBestOsaPerformer = async () => {
      if (!supabase) {
        setOsaHighlightError("Supabase client not available");
        return;
      }

      try {
        setOsaHighlightError(null);

        const now = new Date();
        const day = now.getDay();
        const mondayOffset = day === 0 ? 6 : day - 1;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - mondayOffset);
        weekStart.setHours(0, 0, 0, 0);
        const weekStartStr = weekStart.toISOString().slice(0, 10);

        const { data, error } = await supabase
          .from("osa_internal_results")
          .select("shift_date, team_member_name, points_lost")
          .gte("shift_date", weekStartStr);

        if (error) throw error;

        const bucket: Record<string, { total: number; count: number }> = {};

        for (const row of (data || []) as OsaInternalRow[]) {
          const name = (row.team_member_name || "").trim() || "Unknown";
          const pointsLost = Number(row.points_lost);
          if (!Number.isFinite(pointsLost)) continue;

          if (!bucket[name]) bucket[name] = { total: 0, count: 0 };
          bucket[name].total += pointsLost;
          bucket[name].count += 1;
        }

        const ranked = Object.entries(bucket)
          .filter(([, v]) => v.count > 0)
          .map(([name, v]) => ({
            name,
            avgPointsLost: v.total / v.count,
          }))
          .sort((a, b) => a.avgPointsLost - b.avgPointsLost);

        setOsaWinner(
          ranked[0]
            ? { name: ranked[0].name, avgPointsLost: ranked[0].avgPointsLost }
            : { name: "No data", avgPointsLost: null }
        );
      } catch (e: any) {
        setOsaHighlightError(e?.message || "Could not load OSA highlight");
        setOsaWinner(null);
      }
    };

    loadBestOsaPerformer();
  }, []);

  useEffect(() => {
    const loadCostHighlights = async () => {
      if (!supabase) {
        setCostHighlightError("Supabase client not available");
        return;
      }

      try {
        setCostHighlightError(null);

        const now = new Date();
        const day = now.getDay();
        const mondayOffset = day === 0 ? 6 : day - 1;

        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - mondayOffset);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const weekStartStr = weekStart.toISOString().slice(0, 10);
        const weekEndStr = weekEnd.toISOString().slice(0, 10);

        const { data, error } = await supabase
          .from("cost_control_entries")
          .select(
            "store, shift_date, sales_gbp, labour_cost_gbp, ideal_food_cost_gbp, actual_food_cost_gbp"
          )
          .gte("shift_date", weekStartStr)
          .lt("shift_date", weekEndStr);

        if (error) throw error;

        const bucket: Record<
          string,
          { sales: number; labour: number; idealFood: number; actualFood: number }
        > = {};

        for (const row of (data || []) as CostControlRowMini[]) {
          const name = (row.store || "").trim() || "Unknown";
          if (!bucket[name]) {
            bucket[name] = { sales: 0, labour: 0, idealFood: 0, actualFood: 0 };
          }

          const sales = Number(row.sales_gbp);
          const labour = Number(row.labour_cost_gbp);
          const idealFood = Number(row.ideal_food_cost_gbp);
          const actualFood = Number(row.actual_food_cost_gbp);

          if (Number.isFinite(sales)) bucket[name].sales += sales;
          if (Number.isFinite(labour)) bucket[name].labour += labour;
          if (Number.isFinite(idealFood)) bucket[name].idealFood += idealFood;
          if (Number.isFinite(actualFood)) bucket[name].actualFood += actualFood;
        }

        const ranked = Object.entries(bucket).map(([name, totals]) => {
          const labourPct = totals.sales > 0 ? totals.labour / totals.sales : null;
          const foodVarPctSales =
            totals.sales > 0
              ? (totals.actualFood - totals.idealFood) / totals.sales
              : null;

          return {
            name,
            sumSales: totals.sales,
            labourPct,
            foodVarPctSales,
            labourDelta:
              labourPct == null
                ? Number.POSITIVE_INFINITY
                : Math.max(0, labourPct - 0.25),
            foodVarDelta:
              foodVarPctSales == null
                ? Number.POSITIVE_INFINITY
                : Math.abs(foodVarPctSales),
          };
        });

        const labourRanked = [...ranked].sort((a, b) => {
          if (a.labourDelta !== b.labourDelta) return a.labourDelta - b.labourDelta;
          if (a.labourPct !== b.labourPct) {
            return (a.labourPct ?? Infinity) - (b.labourPct ?? Infinity);
          }
          return b.sumSales - a.sumSales;
        });

        const foodRanked = [...ranked].sort((a, b) => {
          if (a.foodVarDelta !== b.foodVarDelta) return a.foodVarDelta - b.foodVarDelta;
          return b.sumSales - a.sumSales;
        });

        setCostWinner({
          labourName: labourRanked[0]?.name || "No data",
          labourPct: labourRanked[0]?.labourPct ?? null,
          foodName: foodRanked[0]?.name || "No data",
          foodVarPctSales: foodRanked[0]?.foodVarPctSales ?? null,
        });
      } catch (e: any) {
        setCostHighlightError(e?.message || "Could not load cost highlights");
        setCostWinner(null);
      }
    };

    loadCostHighlights();
  }, []);

  const splitSvcRows = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // sunday = 0
    const mondayOffset = day === 0 ? 6 : day - 1;

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const weekToDate: ServiceRowMini[] = [];
    const previousWeek: ServiceRowMini[] = [];
    const monthToDate: ServiceRowMini[] = [];

    for (const r of svcRows) {
      const sourceDate = r.shift_date || r.created_at;
      const d = sourceDate ? new Date(sourceDate) : null;
      if (!d || isNaN(d.getTime())) continue;

      if (d >= monthStart) monthToDate.push(r);

      if (d >= weekStart) weekToDate.push(r);
      else if (d >= prevWeekStart && d < weekStart) previousWeek.push(r);
    }

    return { weekToDate, previousWeek, monthToDate };
  }, [svcRows]);

  const computeRanked = (rows: ServiceRowMini[], key: "store" | "manager") => {
    const bucket: Record<
      string,
      { dot: number[]; labour: number[]; rnl: number[]; shifts: number }
    > = {};

    for (const r of rows) {
      const name =
        key === "store"
          ? (r.store || "").trim()
          : ((r.manager || "Unknown").trim() || "Unknown");

      if (!name) continue;

      if (!bucket[name]) {
        bucket[name] = { dot: [], labour: [], rnl: [], shifts: 0 };
      }
      bucket[name].shifts += 1;

      const d = normalisePct(r.dot_pct);
      const l = normalisePct(r.labour_pct);
      if (d != null) bucket[name].dot.push(d);
      if (l != null) bucket[name].labour.push(l);
      if (r.rnl_minutes != null) bucket[name].rnl.push(r.rnl_minutes);
    }

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const out: RankedItem[] = Object.entries(bucket).map(([name, v]) => ({
      name,
      avgDOT: avg(v.dot),
      avgLabour: avg(v.labour),
      avgRnlMinutes: avg(v.rnl),
      shifts: v.shifts,
    }));

    out.sort((a, b) => {
      if (b.avgDOT !== a.avgDOT) return b.avgDOT - a.avgDOT;
      if (a.avgLabour !== b.avgLabour) return a.avgLabour - b.avgLabour;
      return a.avgRnlMinutes - b.avgRnlMinutes;
    });

    return out;
  };

  const computeImproved = (week: ServiceRowMini[], prevWeek: ServiceRowMini[]) => {
    const makeBucket = (rows: ServiceRowMini[]) => {
      const bucket: Record<string, { dot: number[] }> = {};

      for (const r of rows) {
        const name = (r.store || "").trim();
        if (!name) continue;

        if (!bucket[name]) bucket[name] = { dot: [] };

        const d = normalisePct(r.dot_pct);
        if (d != null) bucket[name].dot.push(d);
      }

      return bucket;
    };

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const weekBucket = makeBucket(week);
    const prevWeekBucket = makeBucket(prevWeek);
    const names = Array.from(
      new Set([
        ...Object.keys(weekBucket),
        ...Object.keys(prevWeekBucket),
      ])
    );

    const items: ImprovedItem[] = names.map((name) => {
      const weekDOT = weekBucket[name] ? avg(weekBucket[name].dot) : 0;
      const prevDOT = prevWeekBucket[name] ? avg(prevWeekBucket[name].dot) : 0;

      return {
        name,
        dotDelta: weekDOT - prevDOT,
        weekDOT,
      };
    });

    items.sort((a, b) => b.dotDelta - a.dotDelta);
    return items;
  };

  const topStore = useMemo(() => {
    const rankedStores = computeRanked(splitSvcRows.weekToDate, "store");
    return rankedStores[0] || null;
  }, [splitSvcRows]);

  const topManager = useMemo(() => {
    const rankedManagers = computeRanked(splitSvcRows.weekToDate, "manager");
    return rankedManagers[0] || null;
  }, [splitSvcRows]);

  const mostImprovedStore = useMemo(() => {
    const improved = computeImproved(
      splitSvcRows.weekToDate,
      splitSvcRows.previousWeek
    );
    return improved[0] || null;
  }, [splitSvcRows]);

  const handleLogout = async () => {
    try {
      if (!supabase) return;
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main className="wrap">
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <div className="ticker-shell" aria-label="Mourne-oids latest updates">
        <div className="ticker-inner">
          <div className="ticker">
            {tickerError ? (
              <span className="ticker-item error">
                <span className="cat-pill" style={{ background: "#ffffff" }} />
                ⚠️ Ticker error: {tickerError}
              </span>
            ) : tickerMessages.length === 0 ? (
              <span className="ticker-item muted">
                <span className="cat-pill" style={{ background: "#ffffff" }} />
                📰 No news items found in Supabase (table:{" "}
                <code>news_ticker</code>)
              </span>
            ) : (
              tickerMessages.map((item, i) => (
                <span key={i} className="ticker-item">
                  <span
                    className="cat-pill"
                    style={{ background: getCategoryColor(item.category) }}
                    title={item.category || "Announcement"}
                  />
                  {item.message}
                  {i < tickerMessages.length - 1 && (
                    <span className="separator">•</span>
                  )}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="shell">
        <header className="header">
          <h1>Mourne-oids Hub</h1>
          <p className="subtitle">
            “Climbing New Peaks, One Shift at a Time.” ⛰️🍕
          </p>

          <div className="purpose-bar" role="note">
            One source of truth for service, standards, and leadership.
          </div>

          <div className="highlights">
            <div className="highlights-head">
              <h2>Highlights</h2>
              <p>This week to date • ranked by DOT, labour, then RNL</p>
            </div>

            {highlightsError && (
              <div className="highlight-card warning" style={{ marginBottom: 12 }}>
                <div className="highlight-top">
                  <span className="highlight-title">⚠️ Highlights</span>
                </div>
                <div className="highlight-body">
                  Could not load highlights: {highlightsError}
                </div>
              </div>
            )}

            <div className="highlights-grid">
              <div className="highlight-card">
                <div className="highlight-top">
                  <span className="highlight-title">🏆 Top Store </span>
                  <span className="highlight-pill">WTD</span>
                </div>
                <div className="highlight-main">
                  <div className="highlight-name">
                    {topStore && !highlightsError ? topStore.name : "No data"}
                  </div>
                  <div className="highlight-metrics">
                    <span>
                      DOT:{" "}
                      <b>
                        {topStore && !highlightsError
                          ? formatPct(topStore.avgDOT, 0)
                          : "—"}
                      </b>
                    </span>
                    <span>
                      Labour:{" "}
                      <b>
                        {topStore && !highlightsError
                          ? formatPct(topStore.avgLabour, 1)
                          : "—"}
                      </b>
                    </span>
                  </div>
                </div>
              </div>

              <div className="highlight-card">
                <div className="highlight-top">
                  <span className="highlight-title">🥇 Top Manager </span>
                  <span className="highlight-pill">WTD</span>
                </div>
                <div className="highlight-main">
                  <div className="highlight-name">
                    {topManager && !highlightsError ? topManager.name : "No data"}
                  </div>
                  <div className="highlight-metrics">
                    <span>
                      DOT:{" "}
                      <b>
                        {topManager && !highlightsError
                          ? formatPct(topManager.avgDOT, 0)
                          : "—"}
                      </b>
                    </span>
                    <span>
                      Labour:{" "}
                      <b>
                        {topManager && !highlightsError
                          ? formatPct(topManager.avgLabour, 1)
                          : "—"}
                      </b>
                    </span>
                    <span>
                      Shifts: <b>{topManager && !highlightsError ? topManager.shifts : "—"}</b>
                    </span>
                  </div>
                </div>
              </div>

              <div className="highlight-card">
                <div className="highlight-top">
                  <span className="highlight-title">📈 Best Improved Store </span>
                  <span className="highlight-pill">WTD vs prev week</span>
                </div>
                <div className="highlight-main">
                  <div className="highlight-name">
                    {mostImprovedStore && !highlightsError
                      ? mostImprovedStore.name
                      : "No data"}
                  </div>
                  <div className="highlight-metrics">
                    <span>
                      DOT gain:{" "}
                      <b>
                        {mostImprovedStore && !highlightsError
                          ? (mostImprovedStore.dotDelta * 100).toFixed(1) + "pp"
                          : "—"}
                      </b>
                    </span>
                    <span>
                      WTD DOT:{" "}
                      <b>
                        {mostImprovedStore && !highlightsError
                          ? formatPct(mostImprovedStore.weekDOT, 0)
                          : "—"}
                      </b>
                    </span>
                  </div>
                </div>
              </div>

              <div className={`highlight-card${osaHighlightError ? " warning" : ""}`}>
                <div className="highlight-top">
                  <span className="highlight-title">🛡️ Best OSA Performance </span>
                  <span className="highlight-pill">WTD</span>
                </div>
                <div className="highlight-main">
                  <div className="highlight-name">
                    {osaHighlightError ? "Error" : osaWinner?.name || "No data"}
                  </div>
                  <div className="highlight-metrics">
                    {osaHighlightError ? (
                      <span>Could not load OSA highlight: <b>{osaHighlightError}</b></span>
                    ) : (
                      <span>
                        Avg points lost: <b>{formatAvgPointsLost(osaWinner?.avgPointsLost ?? null)}</b>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={`highlight-card${costHighlightError ? " warning" : ""}`}>
                <div className="highlight-top">
                  <span className="highlight-title">💷 Top Store Labour </span>
                  <span className="highlight-pill">WTD</span>
                </div>
                <div className="highlight-main">
                  <div className="highlight-name">
                    {costHighlightError ? "Error" : costWinner?.labourName || "No data"}
                  </div>
                  <div className="highlight-metrics">
                    {costHighlightError ? (
                      <span>Could not load labour highlight: <b>{costHighlightError}</b></span>
                    ) : (
                      <span>
                        Labour: <b>{formatPct(costWinner?.labourPct ?? null, 1)}</b>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={`highlight-card${costHighlightError ? " warning" : ""}`}>
                <div className="highlight-top">
                  <span className="highlight-title">🍕 Top Store Food </span>
                  <span className="highlight-pill">WTD</span>
                </div>
                <div className="highlight-main">
                  <div className="highlight-name">
                    {costHighlightError ? "Error" : costWinner?.foodName || "No data"}
                  </div>
                  <div className="highlight-metrics">
                    {costHighlightError ? (
                      <span>Could not load food highlight: <b>{costHighlightError}</b></span>
                    ) : (
                      <span>
                        Variance: <b>{formatPct(costWinner?.foodVarPctSales ?? null, 2)}</b>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="top-actions">
          <button onClick={handleLogout} className="btn-logout" type="button">
            🚪 Log out
          </button>
        </div>

        {/* ✅ Touchscreen-style panels */}
        <section className="panelGrid" aria-label="Hub navigation panels">
          {TILES.map((t) => {
            const a = accent(t.variant);
            return (
              <Link
                key={t.href}
                href={t.href}
                className="panelBtn"
                style={
                  {
                    ["--a" as any]: a.a,
                    ["--b" as any]: a.b,
                  } as React.CSSProperties
                }
              >
                <div className="panelTop">
                  <div className="panelLeft">
                    <span className="panelIcon" aria-hidden="true">
                      {t.icon}
                    </span>
                    <div className="panelTitles">
                      <div className="panelTitle">{t.title}</div>
                      <div className="panelDesc">{t.desc}</div>
                    </div>
                  </div>

                  <div className="panelBadges">
                    <span className="panelPill">{t.pill}</span>
                    {t.badge ? <span className="panelNew">{t.badge}</span> : null}
                  </div>
                </div>

                <div className="panelFoot">
                  <span className="panelHint">Tap to open</span>
                  <span className="panelChevron" aria-hidden="true">
                    →
                  </span>
                </div>
              </Link>
            );
          })}
        </section>

        <div className="status-bottom" aria-label="Data status">
          <div className="status-bottom-head">
            <h3>Latest uploads</h3>
            <p>Auto-updates from Supabase</p>
          </div>

          <div className="status-strip">
            <div className="status-item">
              <span className="status-dot ok" />
              <span className="status-label">Service data:</span>
              <span className="status-value">
                {formatStamp(status.serviceLastUpdated)}
              </span>
            </div>

            <div className="status-item">
              <span className="status-dot ok" />
              <span className="status-label">Internal OSA:</span>
              <span className="status-value">
                {formatStamp(status.osaLastUpdated)}
              </span>
            </div>

            <div className="status-item">
              <span className="status-dot ok" />
              <span className="status-label">Cost controls:</span>
              <span className="status-value">
                {formatStamp(status.costLastUpdated)}
              </span>
            </div>

            {status.error && (
              <div className="status-item warn">
                <span className="status-dot bad" />
                <span className="status-label">Status:</span>
                <span className="status-value">{status.error}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>

      <style jsx>{`
        :root {
          --text: #0f172a;
          --muted: #64748b;
          --brand: #006491;
          --shadow-card: 0 16px 40px rgba(0, 0, 0, 0.05);
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

        .ticker-shell {
          width: min(1100px, 94vw);
          margin-top: 16px;
          background: linear-gradient(90deg, #006491 0%, #004b75 100%);
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          overflow: hidden;
          box-shadow: 0 15px 30px rgba(0, 0, 0, 0.06);
        }

        .ticker-inner {
          white-space: nowrap;
          overflow: hidden;
        }

        .ticker {
          display: inline-block;
          animation: scroll 30s linear infinite;
          padding: 9px 0;
        }

        .ticker-shell:hover .ticker {
          animation-play-state: paused;
        }

        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0 1.8rem;
          font-weight: 700;
          font-size: 0.9rem;
          color: #fff;
        }

        .ticker-item.error {
          color: #fee2e2;
        }

        .cat-pill {
          width: 12px;
          height: 20px;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.25);
        }

        .separator {
          opacity: 0.45;
        }

        @keyframes scroll {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }

        .shell {
          width: min(1100px, 94vw);
          margin-top: 26px;
          background: rgba(255, 255, 255, 0.55);
          backdrop-filter: saturate(160%) blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 1.5rem;
          box-shadow: var(--shadow-card);
          padding: 30px 26px 34px;
        }

        .header {
          text-align: center;
          margin-bottom: 12px;
        }

        .header h1 {
          font-size: clamp(2.1rem, 3vw, 2.4rem);
          font-weight: 900;
          letter-spacing: -0.015em;
        }

        .subtitle {
          color: #64748b;
          font-size: 0.95rem;
          margin-top: 6px;
        }

        .purpose-bar {
          display: inline-flex;
          margin: 12px auto 0;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.08);
          border: 1px solid rgba(0, 100, 145, 0.14);
          color: #0f172a;
          font-weight: 800;
          font-size: 13px;
          letter-spacing: 0.01em;
        }

        .highlights {
          margin: 18px auto 0;
          width: min(980px, 100%);
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

        .highlight-card.warning {
          border-color: rgba(239, 68, 68, 0.22);
          background: rgba(254, 242, 242, 0.85);
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

        .highlight-body {
          font-size: 13px;
          color: #334155;
          font-weight: 800;
        }

        .top-actions {
          display: flex;
          justify-content: flex-end;
          margin: 6px 0 16px;
        }

        .btn-logout {
          background: rgba(255, 255, 255, 0.92);
          color: #0f172a;
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 14px;
          font-weight: 900;
          font-size: 14px;
          padding: 9px 14px;
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(2, 6, 23, 0.06);
          transition: transform 0.14s ease, box-shadow 0.14s ease,
            border-color 0.14s ease, background 0.14s ease;
        }

        .btn-logout:hover {
          transform: translateY(-2px);
          border-color: rgba(0, 100, 145, 0.26);
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 16px 36px rgba(2, 6, 23, 0.1);
        }

        .btn-logout:focus-visible {
          outline: none;
          box-shadow: 0 0 0 4px rgba(0, 100, 145, 0.22),
            0 12px 26px rgba(2, 6, 23, 0.08);
        }

        /* ===========================
           ✅ Touchscreen panel buttons
           =========================== */
        .panelGrid {
          margin-top: 8px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .panelBtn {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 14px;

          min-height: 140px;
          padding: 18px 18px 16px;

          border-radius: 22px;
          text-decoration: none;
          color: inherit;

          /* "stand-alone panel" base */
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.94),
            rgba(248, 251, 255, 0.94)
          );
          border: 1px solid rgba(15, 23, 42, 0.1);

          /* deep kiosk shadow + subtle lift */
          box-shadow: 0 26px 54px rgba(2, 6, 23, 0.14),
            0 10px 18px rgba(2, 6, 23, 0.08),
            0 1px 0 rgba(255, 255, 255, 0.8) inset;

          overflow: hidden;
          transform: translateZ(0);
          transition: transform 0.16s ease, box-shadow 0.16s ease,
            border-color 0.16s ease;
        }

        /* reflective rim / gradient border illusion */
        .panelBtn::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: 24px;
          padding: 2px;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.85),
            rgba(255, 255, 255, 0.15) 30%,
            rgba(255, 255, 255, 0.55) 55%,
            rgba(255, 255, 255, 0.12) 75%,
            rgba(255, 255, 255, 0.7)
          );
          -webkit-mask: linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0.9;
        }

        /* soft glass sheen + variant tint */
        .panelBtn::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 22px;
          background: radial-gradient(
              900px 280px at 15% 0%,
              rgba(255, 255, 255, 0.55),
              transparent 55%
            ),
            radial-gradient(
              900px 360px at 100% 10%,
              rgba(0, 0, 0, 0.04),
              transparent 55%
            ),
            radial-gradient(
              800px 340px at 80% 0%,
              color-mix(in srgb, var(--a) 14%, transparent),
              transparent 60%
            );
          pointer-events: none;
          opacity: 0.85;
        }

        /* left accent bar */
        .panelBtn .panelTop::before {
          content: "";
          position: absolute;
          left: 10px;
          top: 16px;
          bottom: 16px;
          width: 7px;
          border-radius: 999px;
          background: linear-gradient(180deg, var(--a), var(--b));
          box-shadow: 0 12px 18px rgba(2, 6, 23, 0.1);
        }

        .panelBtn:hover {
          transform: translateY(-3px);
          border-color: rgba(0, 100, 145, 0.22);
          box-shadow: 0 34px 70px rgba(2, 6, 23, 0.18),
            0 12px 20px rgba(2, 6, 23, 0.1),
            0 1px 0 rgba(255, 255, 255, 0.86) inset;
        }

        .panelBtn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--a) 20%, transparent),
            0 34px 70px rgba(2, 6, 23, 0.18),
            0 12px 20px rgba(2, 6, 23, 0.1),
            0 1px 0 rgba(255, 255, 255, 0.86) inset;
        }

        .panelTop {
          position: relative;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding-left: 16px; /* room for accent bar */
          z-index: 1;
        }

        .panelLeft {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          min-width: 0;
        }

        .panelIcon {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          font-size: 22px;

          background: linear-gradient(135deg, var(--a), var(--b));
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.22);
          box-shadow: 0 16px 26px
              color-mix(in srgb, var(--a) 22%, transparent),
            0 1px 0 rgba(255, 255, 255, 0.2) inset;
          flex: 0 0 54px;
          position: relative;
          overflow: hidden;
        }

        .panelIcon::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at 30% 25%,
            rgba(255, 255, 255, 0.3),
            transparent 60%
          );
          pointer-events: none;
        }

        .panelTitles {
          min-width: 0;
        }

        .panelTitle {
          font-weight: 950;
          font-size: 16px;
          letter-spacing: -0.01em;
          color: #0f172a;
          line-height: 1.2;
        }

        .panelDesc {
          margin-top: 6px;
          font-size: 13px;
          font-weight: 800;
          color: #475569;
          line-height: 1.35;
        }

        .panelBadges {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .panelPill {
          font-size: 11px;
          font-weight: 900;
          padding: 6px 12px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--a) 10%, #ffffff);
          border: 1px solid rgba(15, 23, 42, 0.08);
          color: #0f172a;
          box-shadow: 0 10px 20px rgba(2, 6, 23, 0.06);
          white-space: nowrap;
        }

        .panelNew {
          font-size: 11px;
          font-weight: 950;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.1);
          border: 1px solid rgba(0, 100, 145, 0.16);
          color: #004b75;
          white-space: nowrap;
        }

        .panelFoot {
          z-index: 1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;

          padding-top: 12px;
          border-top: 1px solid rgba(15, 23, 42, 0.06);
        }

        .panelHint {
          font-size: 12px;
          font-weight: 900;
          color: #64748b;
        }

        .panelChevron {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-size: 18px;
          font-weight: 950;

          background: rgba(2, 6, 23, 0.04);
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 12px 18px rgba(2, 6, 23, 0.08);
          transition: transform 0.16s ease, background 0.16s ease,
            border-color 0.16s ease;
        }

        .panelBtn:hover .panelChevron {
          transform: translateX(3px);
          background: color-mix(in srgb, var(--a) 10%, #ffffff);
          border-color: color-mix(in srgb, var(--a) 25%, transparent);
        }

        /* ===== Status ===== */
        .status-bottom {
          margin-top: 22px;
          padding-top: 14px;
          border-top: 1px dashed rgba(15, 23, 42, 0.18);
        }

        .status-bottom-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-bottom: 10px;
        }

        .status-bottom-head h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 900;
          color: #0f172a;
        }

        .status-bottom-head p {
          margin: 0;
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
        }

        .status-strip {
          width: min(900px, 100%);
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-start;
        }

        .status-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 8px 18px rgba(2, 6, 23, 0.04);
          font-size: 13px;
        }

        .status-item.warn {
          border-color: rgba(239, 68, 68, 0.25);
          background: rgba(254, 242, 242, 0.75);
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          display: inline-block;
        }

        .status-dot.ok {
          background: #22c55e;
        }
        .status-dot.bad {
          background: #ef4444;
        }

        .status-label {
          color: #475569;
          font-weight: 800;
        }

        .status-value {
          color: #0f172a;
          font-weight: 800;
        }

        .footer {
          text-align: center;
          margin-top: 24px;
          color: #94a3b8;
          font-size: 0.8rem;
        }

        @media (max-width: 980px) {
          .highlights-grid {
            grid-template-columns: 1fr;
          }
          .highlights-head {
            flex-direction: column;
            align-items: flex-start;
          }
          .panelGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .shell {
            padding: 24px 16px 28px;
          }
          .ticker-shell {
            border-radius: 1.2rem;
          }
          .purpose-bar {
            border-radius: 14px;
          }
        }
      `}</style>
    </main>
  );
}
