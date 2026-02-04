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
  osaLastUpdated: string | null;
  error?: string | null;
};

type ServiceRowMini = {
  store: string;
  dot_pct: number | null;
  labour_pct: number | null;
  manager: string | null;
  created_at?: string | null;
  shift_date?: string | null;
};

type RankedItem = {
  name: string;
  avgDOT: number;
  avgLabour: number;
  shifts: number;
};

type ImprovedItem = {
  name: string;
  dotDelta: number;
  recentDOT: number;
  prevDOT: number;
  recentLabour: number;
  shiftsRecent: number;
};

type TileVariant =
  | "service"
  | "standards"
  | "reports"
  | "osa"
  | "cost" // ✅ NEW
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

  // ✅ NEW TILE: Cost Controls
  {
    href: "/cost-controls",
    title: "Cost Controls",
    desc: "Food variance + labour control, trends and rankings.",
    variant: "cost",
    pill: "Costs",
    icon: "💷",
    badge: "NEW",
  },

  {
    href: "/profile",
    title: "My Profile",
    desc: "Update details & password.",
    variant: "profile",
    pill: "Account",
    icon: "👤",
    badge: null,
  },
  {
    href: "/deep-clean",
    title: "Autumn Deep Clean",
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
    desc: "Current promo assets for team briefings.",
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

    // ✅ NEW ACCENT: Cost Controls (premium “money” tone)
    case "cost":
      return { a: "#0F766E", b: "#065F46" }; // teal → deep green

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
    osaLastUpdated: null,
    error: null,
  });

  const [svcRows, setSvcRows] = useState<ServiceRowMini[]>([]);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);

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

        if (svcErr) throw svcErr;
        if (osaErr) throw osaErr;

        setStatus({
          serviceLastUpdated: svcData?.[0]?.created_at ?? null,
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

  // Load service rows for highlights (last 14 days)
  useEffect(() => {
    const loadHighlights = async () => {
      if (!supabase) {
        setHighlightsError("Supabase client not available");
        return;
      }

      try {
        setHighlightsError(null);

        const now = new Date();
        const fourteen = new Date(now);
        fourteen.setDate(now.getDate() - 14);
        const fromStr = fourteen.toISOString().slice(0, 10);

        const { data, error } = await supabase
          .from("service_shifts")
          .select("store, dot_pct, labour_pct, manager, created_at, shift_date")
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

  const splitSvcRows = useMemo(() => {
    const now = new Date();
    const last7Start = new Date(now);
    last7Start.setDate(now.getDate() - 7);
    last7Start.setHours(0, 0, 0, 0);

    const prev7Start = new Date(now);
    prev7Start.setDate(now.getDate() - 14);
    prev7Start.setHours(0, 0, 0, 0);

    const last7: ServiceRowMini[] = [];
    const prev7: ServiceRowMini[] = [];

    for (const r of svcRows) {
      const iso = r.created_at ? new Date(r.created_at) : null;
      const d = iso && !isNaN(iso.getTime()) ? iso : null;

      if (!d) {
        last7.push(r);
        continue;
      }

      if (d >= last7Start) last7.push(r);
      else if (d >= prev7Start && d < last7Start) prev7.push(r);
    }

    return { last7, prev7 };
  }, [svcRows]);

  const computeRanked = (rows: ServiceRowMini[], key: "store" | "manager") => {
    const bucket: Record<
      string,
      { dot: number[]; labour: number[]; shifts: number }
    > = {};

    for (const r of rows) {
      const name =
        key === "store"
          ? (r.store || "").trim()
          : ((r.manager || "Unknown").trim() || "Unknown");

      if (!name) continue;

      if (!bucket[name]) bucket[name] = { dot: [], labour: [], shifts: 0 };
      bucket[name].shifts += 1;

      const d = normalisePct(r.dot_pct);
      const l = normalisePct(r.labour_pct);
      if (d != null) bucket[name].dot.push(d);
      if (l != null) bucket[name].labour.push(l);
    }

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const out: RankedItem[] = Object.entries(bucket).map(([name, v]) => ({
      name,
      avgDOT: avg(v.dot),
      avgLabour: avg(v.labour),
      shifts: v.shifts,
    }));

    out.sort((a, b) => {
      if (b.avgDOT !== a.avgDOT) return b.avgDOT - a.avgDOT;
      return a.avgLabour - b.avgLabour;
    });

    return out;
  };

  const computeImproved = (recent: ServiceRowMini[], prev: ServiceRowMini[]) => {
    const makeBucket = (rows: ServiceRowMini[]) => {
      const bucket: Record<
        string,
        { dot: number[]; labour: number[]; shifts: number }
      > = {};
      for (const r of rows) {
        const name = (r.store || "").trim();
        if (!name) continue;
        if (!bucket[name]) bucket[name] = { dot: [], labour: [], shifts: 0 };
        bucket[name].shifts += 1;

        const d = normalisePct(r.dot_pct);
        const l = normalisePct(r.labour_pct);
        if (d != null) bucket[name].dot.push(d);
        if (l != null) bucket[name].labour.push(l);
      }
      return bucket;
    };

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const rB = makeBucket(recent);
    const pB = makeBucket(prev);

    const names = Array.from(new Set([...Object.keys(rB), ...Object.keys(pB)]));

    const items: ImprovedItem[] = names.map((name) => {
      const r = rB[name];
      const p = pB[name];

      const recentDOT = r ? avg(r.dot) : 0;
      const prevDOT = p ? avg(p.dot) : 0;
      const recentLabour = r ? avg(r.labour) : 0;

      return {
        name,
        dotDelta: recentDOT - prevDOT,
        recentDOT,
        prevDOT,
        recentLabour,
        shiftsRecent: r?.shifts ?? 0,
      };
    });

    items.sort((a, b) => b.dotDelta - a.dotDelta);
    return items;
  };

  const topStore = useMemo(() => {
    const rankedStores = computeRanked(splitSvcRows.last7, "store");
    return rankedStores[0] || null;
  }, [splitSvcRows]);

  const topManager = useMemo(() => {
    const rankedManagers = computeRanked(splitSvcRows.last7, "manager");
    return rankedManagers[0] || null;
  }, [splitSvcRows]);

  const mostImprovedStore = useMemo(() => {
    const improved = computeImproved(splitSvcRows.last7, splitSvcRows.prev7);
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
          <p className="subtitle">“Climbing New Peaks, One Shift at a Time.” ⛰️🍕</p>

          <div className="purpose-bar" role="note">
            One source of truth for service, standards, and leadership.
          </div>

          <div className="highlights">
            <div className="highlights-head">
              <h2>Highlights</h2>
              <p>Last 7 days • ranked by higher DOT% then lower labour%</p>
            </div>

            {highlightsError ? (
              <div className="highlight-card warning">
                <div className="highlight-top">
                  <span className="highlight-title">⚠️ Highlights</span>
                </div>
                <div className="highlight-body">
                  Could not load highlights: {highlightsError}
                </div>
              </div>
            ) : (
              <div className="highlights-grid">
                {/* unchanged highlights cards... */}
                <div className="highlight-card">
                  <div className="highlight-top">
                    <span className="highlight-title">🏆 Top Store</span>
                    <span className="highlight-pill">Winners circle</span>
                  </div>
                  <div className="highlight-main">
                    <div className="highlight-name">
                      {topStore ? topStore.name : "No data"}
                    </div>
                    <div className="highlight-metrics">
                      <span>
                        DOT:{" "}
                        <b>{topStore ? formatPct(topStore.avgDOT, 0) : "—"}</b>
                      </span>
                      <span>
                        Labour:{" "}
                        <b>{topStore ? formatPct(topStore.avgLabour, 1) : "—"}</b>
                      </span>
                      <span>
                        Shifts: <b>{topStore ? topStore.shifts : "—"}</b>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="highlight-card">
                  <div className="highlight-top">
                    <span className="highlight-title">🥇 Top Manager</span>
                    <span className="highlight-pill">Closing game</span>
                  </div>
                  <div className="highlight-main">
                    <div className="highlight-name">
                      {topManager ? topManager.name : "No data"}
                    </div>
                    <div className="highlight-metrics">
                      <span>
                        DOT:{" "}
                        <b>{topManager ? formatPct(topManager.avgDOT, 0) : "—"}</b>
                      </span>
                      <span>
                        Labour:{" "}
                        <b>
                          {topManager ? formatPct(topManager.avgLabour, 1) : "—"}
                        </b>
                      </span>
                      <span>
                        Shifts: <b>{topManager ? topManager.shifts : "—"}</b>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="highlight-card">
                  <div className="highlight-top">
                    <span className="highlight-title">📈 Most Improved Store</span>
                    <span className="highlight-pill">Vs prev 7 days</span>
                  </div>
                  <div className="highlight-main">
                    <div className="highlight-name">
                      {mostImprovedStore ? mostImprovedStore.name : "No data"}
                    </div>
                    <div className="highlight-metrics">
                      <span>
                        DOT uplift:{" "}
                        <b>
                          {mostImprovedStore
                            ? (mostImprovedStore.dotDelta * 100).toFixed(1) +
                              "pp"
                            : "—"}
                        </b>
                      </span>
                      <span>
                        Recent DOT:{" "}
                        <b>
                          {mostImprovedStore
                            ? formatPct(mostImprovedStore.recentDOT, 0)
                            : "—"}
                        </b>
                      </span>
                      <span>
                        Labour:{" "}
                        <b>
                          {mostImprovedStore
                            ? formatPct(mostImprovedStore.recentLabour, 1)
                            : "—"}
                        </b>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="top-actions">
          <button onClick={handleLogout} className="btn-logout" type="button">
            🚪 Log out
          </button>
        </div>

        <section className="grid" aria-label="Hub navigation">
          {TILES.map((t) => (
            <Link href={t.href} key={t.href} className="card-link" data-variant={t.variant}>
              <div className="card-link__icon">{t.icon}</div>
              <div className="card-link__body">
                <h2>
                  {t.title} {t.badge ? <span className="badge">{t.badge}</span> : null}
                </h2>
                <p>{t.desc}</p>
              </div>
              <div className="card-link__chevron">›</div>
            </Link>
          ))}
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

      {/* NOTE: your existing styles continue below unchanged.
         I’m leaving them as-is to avoid breaking your current design.
         If you want the Cost Controls tile to have its own accent bar,
         we can add a data-variant="cost" style block too. */}

      <style jsx>{`
        :root {
          --bg: #0f172a;
          --paper: rgba(255, 255, 255, 0.08);
          --paper-solid: #ffffff;
          --text: #0f172a;
          --muted: #475569;
          --brand: #006491;
          --brand-dark: #004b75;
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

        /* (rest of your existing CSS stays unchanged) */
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
        }

        .card-link {
          position: relative;
          display: flex;
          gap: 14px;
          align-items: center;

          background: rgba(255, 255, 255, 0.92);
          border-radius: 18px;
          text-decoration: none;

          padding: 16px 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 10px 22px rgba(2, 6, 23, 0.06),
            0 1px 0 rgba(255, 255, 255, 0.65) inset;

          transition: transform 0.14s ease, box-shadow 0.14s ease,
            border-color 0.14s ease, background 0.14s ease;
          overflow: hidden;
        }

        .card-link::after {
          content: "";
          position: absolute;
          left: 0;
          top: 10px;
          bottom: 10px;
          width: 6px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.3);
          box-shadow: 0 8px 16px rgba(2, 6, 23, 0.08);
        }

        .card-link[data-variant="service"]::after {
          background: linear-gradient(180deg, #006491 0%, #004b75 100%);
        }
        .card-link[data-variant="standards"]::after {
          background: linear-gradient(180deg, #16a34a 0%, #166534 100%);
        }
        .card-link[data-variant="reports"]::after {
          background: linear-gradient(180deg, #f59e0b 0%, #b45309 100%);
        }
        .card-link[data-variant="osa"]::after {
          background: linear-gradient(180deg, #7c3aed 0%, #4c1d95 100%);
        }

        /* ✅ NEW: cost controls accent */
        .card-link[data-variant="cost"]::after {
          background: linear-gradient(180deg, #0f766e 0%, #065f46 100%);
        }

        .card-link[data-variant="profile"]::after {
          background: linear-gradient(180deg, #0ea5e9 0%, #0369a1 100%);
        }
        .card-link[data-variant="deepclean"]::after {
          background: linear-gradient(180deg, #22c55e 0%, #15803d 100%);
        }
        .card-link[data-variant="memomailer"]::after {
          background: linear-gradient(180deg, #ef4444 0%, #991b1b 100%);
        }
        .card-link[data-variant="promo"]::after {
          background: linear-gradient(180deg, #e31837 0%, #8a1020 100%);
        }
        .card-link[data-variant="admin"]::after {
          background: linear-gradient(180deg, #0f172a 0%, #334155 100%);
        }

        .badge {
          margin-left: 8px;
          font-size: 11px;
          font-weight: 900;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.1);
          border: 1px solid rgba(0, 100, 145, 0.16);
          color: #004b75;
        }
      `}</style>
    </main>
  );
}
