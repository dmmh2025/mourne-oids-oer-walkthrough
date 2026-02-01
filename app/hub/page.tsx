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
  manager: string | null; // ✅ current schema
  created_at?: string | null;
  shift_date?: string | null;
};

type RankedItem = {
  name: string;
  avgDOT: number; // 0..1
  avgLabour: number; // 0..1
  shifts: number;
};

type ImprovedItem = {
  name: string;
  dotDelta: number; // -1..1
  recentDOT: number;
  prevDOT: number;
  recentLabour: number;
  shiftsRecent: number;
};

export default function HubPage() {
  const [tickerMessages, setTickerMessages] = useState<TickerItem[]>([]);
  const [tickerError, setTickerError] = useState<string | null>(null);

  // Status strip (timestamps)
  const [status, setStatus] = useState<HubStatus>({
    serviceLastUpdated: null,
    osaLastUpdated: null,
    error: null,
  });

  // Highlights
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

  // Load hub status (last updated timestamps)
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
    const bucket: Record<string, { dot: number[]; labour: number[]; shifts: number }> =
      {};

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
      const bucket: Record<string, { dot: number[]; labour: number[]; shifts: number }> =
        {};
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

          {/* Highlights stays at top */}
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
                        DOT: <b>{topStore ? formatPct(topStore.avgDOT, 0) : "—"}</b>
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
                            ? (mostImprovedStore.dotDelta * 100).toFixed(1) + "pp"
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
          <button onClick={handleLogout} className="btn-logout">
            🚪 Log out
          </button>
        </div>

        <section className="grid">
          <a href="/dashboard/service" className="card-link">
            <div className="card-link__icon">📊</div>
            <div className="card-link__body">
              <h2>Service Dashboard</h2>
              <p>Live snapshots, sales, service metrics.</p>
            </div>
            <div className="card-link__chevron">›</div>
          </a>

          <a href="/walkthrough" className="card-link">
            <div className="card-link__icon">🧾</div>
            <div className="card-link__body">
              <h2>Standards Walkthrough</h2>
              <p>Store readiness + photos + automatic summary.</p>
            </div>
            <div className="card-link__chevron">›</div>
          </a>

          <a href="/admin" className="card-link">
            <div className="card-link__icon">📈</div>
            <div className="card-link__body">
              <h2>Standards Completion report</h2>
              <p>Review store performance and submissions.</p>
            </div>
            <div className="card-link__chevron">›</div>
          </a>

          {/* ✅ NEW: Internal OSA Scorecard link */}
          <a href="/osa" className="card-link">
            <div className="card-link__icon">⭐</div>
            <div className="card-link__body">
              <h2>Internal OSA Scorecard</h2>
              <p>Scorecards, results, and rankings.</p>
            </div>
            <div className="card-link__chevron">›</div>
          </a>

          <a href="/profile" className="card-link">
            <div className="card-link__icon">👤</div>
            <div className="card-link__body">
              <h2>My Profile</h2>
              <p>Update details & password.</p>
            </div>
            <div className="card-link__chevron">›</div>
          </a>

          <a href="/deep-clean" className="card-link">
            <div className="card-link__icon">🧽</div>
            <div className="card-link__body">
              <h2>Autumn Deep Clean</h2>
              <p>Track progress across all stores.</p>
            </div>
            <div className="card-link__chevron">›</div>
          </a>

          <a href="/memomailer" className="card-link">
            <div className="card-link__icon">📬</div>
            <div className="card-link__body">
              <h2>Weekly MemoMailer</h2>
              <p>Latest PDF loaded from Supabase.</p>
            </div>
            <div className="card-link__chevron">›</div>
          </a>

          <a href="/pizza-of-the-week" className="card-link">
            <div className="card-link__icon">🍕</div>
            <div className="card-link__body">
              <h2>Pizza of the Week</h2>
              <p>Current promo assets for team briefings.</p>
            </div>
            <div className="card-link__chevron">›</div>
          </a>

          <a href="/admin/ticker" className="card-link">
            <div className="card-link__icon">⚙️</div>
            <div className="card-link__body">
              <h2>Admin</h2>
              <p>Manage ticker, service uploads, memomailer.</p>
            </div>
            <div className="card-link__chevron">›</div>
          </a>
        </section>

        {/* ✅ MOVED: date/upload section to the bottom */}
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
              <span className="status-value">{formatStamp(status.osaLastUpdated)}</span>
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

        /* highlights */
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
          background: #fff;
          color: var(--brand);
          border: 2px solid var(--brand);
          border-radius: 14px;
          font-weight: 800;
          font-size: 14px;
          padding: 8px 14px;
          cursor: pointer;
          box-shadow: 0 6px 14px rgba(0, 100, 145, 0.12);
          transition: background 0.15s ease, color 0.15s ease,
            transform 0.1s ease;
        }

        .btn-logout:hover {
          background: var(--brand);
          color: #fff;
          transform: translateY(-1px);
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .card-link {
          display: flex;
          gap: 14px;
          align-items: center;
          background: #ffffff;
          border-radius: 1.25rem;
          text-decoration: none;
          padding: 14px 16px 14px 14px;
          border: 1px solid rgba(0, 100, 145, 0.12);
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.03);
          transition: transform 0.12s ease-out, box-shadow 0.12s ease-out,
            border 0.12s ease-out;
        }

        .card-link__icon {
          width: 46px;
          height: 46px;
          border-radius: 1.2rem;
          background: radial-gradient(circle, #006491 0%, #1f2937 100%);
          display: grid;
          place-items: center;
          font-size: 1.6rem;
          color: #fff;
          flex: 0 0 46px;
        }

        .card-link__body h2 {
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
        }

        .card-link__body p {
          font-size: 0.78rem;
          color: #6b7280;
          margin-top: 2px;
        }

        .card-link__chevron {
          margin-left: auto;
          font-size: 1.6rem;
          line-height: 1;
          color: rgba(15, 23, 42, 0.38);
        }

        .card-link:hover {
          transform: translateY(-2px);
          border: 1px solid rgba(0, 100, 145, 0.28);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.04);
        }

        /* bottom status */
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
          .status-bottom-head {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 720px) {
          .shell {
            padding: 24px 16px 28px;
          }
          .card-link {
            border-radius: 1rem;
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
