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
    const bucket: Record<string, { dot: number[]; labour: number[]; shifts: number }> = {};

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

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

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
      const bucket: Record<string, { dot: number[]; labour: number[]; shifts: number }> = {};
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

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

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
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
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
                📰 No news items found in Supabase (table: <code>news_ticker</code>)
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
                  {i < tickerMessages.length - 1 && <span className="separator">•</span>}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="shell">
        <header className="header">
          <div className="header-top">
            <div>
              <h1>Mourne-oids Hub</h1>
              <p className="subtitle">“Climbing New Peaks, One Shift at a Time.” ⛰️🍕</p>
            </div>

            <button onClick={handleLogout} className="pill-btn danger" type="button">
              🚪 Log out
            </button>
          </div>

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
                <div className="highlight-body">Could not load highlights: {highlightsError}</div>
              </div>
            ) : (
              <div className="highlights-grid">
                <div className="highlight-card">
                  <div className="highlight-top">
                    <span className="highlight-title">🏆 Top Store</span>
                    <span className="highlight-pill">Winners circle</span>
                  </div>
                  <div className="highlight-main">
                    <div className="highlight-name">{topStore ? topStore.name : "No data"}</div>
                    <div className="highlight-metrics">
                      <span>
                        DOT: <b>{topStore ? formatPct(topStore.avgDOT, 0) : "—"}</b>
                      </span>
                      <span>
                        Labour: <b>{topStore ? formatPct(topStore.avgLabour, 1) : "—"}</b>
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
                    <div className="highlight-name">{topManager ? topManager.name : "No data"}</div>
                    <div className="highlight-metrics">
                      <span>
                        DOT: <b>{topManager ? formatPct(topManager.avgDOT, 0) : "—"}</b>
                      </span>
                      <span>
                        Labour: <b>{topManager ? formatPct(topManager.avgLabour, 1) : "—"}</b>
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
                    <div className="highlight-name">{mostImprovedStore ? mostImprovedStore.name : "No data"}</div>
                    <div className="highlight-metrics">
                      <span>
                        DOT uplift:{" "}
                        <b>
                          {mostImprovedStore ? (mostImprovedStore.dotDelta * 100).toFixed(1) + "pp" : "—"}
                        </b>
                      </span>
                      <span>
                        Recent DOT: <b>{mostImprovedStore ? formatPct(mostImprovedStore.recentDOT, 0) : "—"}</b>
                      </span>
                      <span>
                        Labour: <b>{mostImprovedStore ? formatPct(mostImprovedStore.recentLabour, 1) : "—"}</b>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        <section className="grid">
          <Link href="/dashboard/service" className="tile" data-variant="service">
            <div className="tile-icon">📊</div>
            <div className="tile-body">
              <h2>Service Dashboard</h2>
              <p>Live snapshots, sales, service metrics.</p>
              <span className="tile-cta">Open</span>
            </div>
            <div className="tile-arrow">›</div>
          </Link>

          <Link href="/walkthrough" className="tile" data-variant="standards">
            <div className="tile-icon">🧾</div>
            <div className="tile-body">
              <h2>Standards Walkthrough</h2>
              <p>Store readiness + photos + automatic summary.</p>
              <span className="tile-cta">Open</span>
            </div>
            <div className="tile-arrow">›</div>
          </Link>

          <Link href="/admin" className="tile" data-variant="reports">
            <div className="tile-icon">📈</div>
            <div className="tile-body">
              <h2>Standards Completion report</h2>
              <p>Review store performance and submissions.</p>
              <span className="tile-cta">Open</span>
            </div>
            <div className="tile-arrow">›</div>
          </Link>

          <Link href="/osa" className="tile" data-variant="osa">
            <div className="tile-icon">⭐</div>
            <div className="tile-body">
              <h2>Internal OSA Scorecard</h2>
              <p>Scorecards, results, and rankings.</p>
              <span className="tile-cta">Open</span>
            </div>
            <div className="tile-arrow">›</div>
          </Link>

          <Link href="/profile" className="tile" data-variant="profile">
            <div className="tile-icon">👤</div>
            <div className="tile-body">
              <h2>My Profile</h2>
              <p>Update details & password.</p>
              <span className="tile-cta">Open</span>
            </div>
            <div className="tile-arrow">›</div>
          </Link>

          <Link href="/deep-clean" className="tile" data-variant="deepclean">
            <div className="tile-icon">🧽</div>
            <div className="tile-body">
              <h2>Autumn Deep Clean</h2>
              <p>Track progress across all stores.</p>
              <span className="tile-cta">Open</span>
            </div>
            <div className="tile-arrow">›</div>
          </Link>

          <Link href="/memomailer" className="tile" data-variant="memomailer">
            <div className="tile-icon">📬</div>
            <div className="tile-body">
              <h2>Weekly MemoMailer</h2>
              <p>Latest PDF loaded from Supabase.</p>
              <span className="tile-cta">Open</span>
            </div>
            <div className="tile-arrow">›</div>
          </Link>

          <Link href="/pizza-of-the-week" className="tile" data-variant="promo">
            <div className="tile-icon">🍕</div>
            <div className="tile-body">
              <h2>Pizza of the Week</h2>
              <p>Current promo assets for team briefings.</p>
              <span className="tile-cta">Open</span>
            </div>
            <div className="tile-arrow">›</div>
          </Link>

          <Link href="/admin/ticker" className="tile" data-variant="admin">
            <div className="tile-icon">⚙️</div>
            <div className="tile-body">
              <h2>Admin</h2>
              <p>Manage ticker, service uploads, memomailer.</p>
              <span className="tile-cta">Open</span>
            </div>
            <div className="tile-arrow">›</div>
          </Link>
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
              <span className="status-value">{formatStamp(status.serviceLastUpdated)}</span>
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
          --text: #0f172a;
          --muted: #64748b;
          --brand: #006491;
          --brand-dark: #004b75;
          --shadow-card: 0 16px 40px rgba(0, 0, 0, 0.05);
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
          padding: 28px 26px 34px;
        }

        .header {
          text-align: left;
          margin-bottom: 14px;
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .header h1 {
          font-size: clamp(2.1rem, 3vw, 2.4rem);
          font-weight: 900;
          letter-spacing: -0.015em;
          margin: 0;
        }

        .subtitle {
          color: var(--muted);
          font-size: 0.95rem;
          margin: 6px 0 0;
        }

        .purpose-bar {
          display: inline-flex;
          margin: 14px 0 0;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.08);
          border: 1px solid rgba(0, 100, 145, 0.14);
          color: #0f172a;
          font-weight: 800;
          font-size: 13px;
          letter-spacing: 0.01em;
        }

        /* integrated pill buttons (logout) */
        .pill-btn {
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: rgba(255, 255, 255, 0.92);
          color: #0f172a;
          font-weight: 900;
          font-size: 14px;
          padding: 10px 14px;
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(2, 6, 23, 0.06);
          transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease,
            background 0.14s ease;
        }

        .pill-btn:hover {
          transform: translateY(-2px);
          border-color: rgba(0, 100, 145, 0.26);
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 16px 36px rgba(2, 6, 23, 0.1);
        }

        .pill-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 4px rgba(0, 100, 145, 0.22), 0 12px 26px rgba(2, 6, 23, 0.08);
        }

        .pill-btn.danger {
          border-color: rgba(227, 24, 55, 0.22);
        }

        .pill-btn.danger:hover {
          border-color: rgba(227, 24, 55, 0.45);
        }

        /* Highlights (unchanged structure, just keeping your styling) */
        .highlights {
          margin: 18px 0 0;
          width: min(980px, 100%);
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

        /* ✅ Upgraded tiles (this is the “buttons” makeover) */
        .grid {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 14px;
        }

        .tile {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 16px 14px;

          text-decoration: none;
          border-radius: 18px;

          background: rgba(255, 255, 255, 0.94);
          border: 1px solid rgba(15, 23, 42, 0.08);

          box-shadow: 0 10px 22px rgba(2, 6, 23, 0.06), 0 1px 0 rgba(255, 255, 255, 0.7) inset;

          transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease,
            background 0.14s ease;
          overflow: hidden;
        }

        /* Left colour rail */
        .tile::after {
          content: "";
          position: absolute;
          left: 0;
          top: 12px;
          bottom: 12px;
          width: 7px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.35);
          box-shadow: 0 10px 22px rgba(2, 6, 23, 0.1);
        }

        /* subtle glow */
        .tile::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(900px 220px at 20% 0%, rgba(0, 100, 145, 0.11), transparent 55%),
            radial-gradient(700px 260px at 90% 20%, rgba(227, 24, 55, 0.06), transparent 55%);
          opacity: 1;
          pointer-events: none;
        }

        .tile:hover {
          transform: translateY(-3px);
          border-color: rgba(0, 100, 145, 0.22);
          background: rgba(255, 255, 255, 0.99);
          box-shadow: 0 18px 46px rgba(2, 6, 23, 0.12), 0 1px 0 rgba(255, 255, 255, 0.8) inset;
        }

        .tile:focus-visible {
          outline: none;
          border-color: rgba(0, 100, 145, 0.35);
          box-shadow: 0 0 0 4px rgba(0, 100, 145, 0.22), 0 18px 46px rgba(2, 6, 23, 0.12),
            0 1px 0 rgba(255, 255, 255, 0.8) inset;
        }

        .tile-icon {
          position: relative;
          z-index: 1;
          width: 54px;
          height: 54px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          font-size: 1.6rem;
          color: #fff;
          background: linear-gradient(135deg, #006491 0%, #004b75 55%, #0f172a 100%);
          box-shadow: 0 12px 26px rgba(0, 75, 117, 0.22), 0 1px 0 rgba(255, 255, 255, 0.2) inset;
          border: 1px solid rgba(255, 255, 255, 0.18);
          flex: 0 0 54px;
        }

        .tile-body {
          position: relative;
          z-index: 1;
          min-width: 0;
          width: 100%;
        }

        .tile-body h2 {
          margin: 0;
          font-size: 1rem;
          font-weight: 950;
          letter-spacing: -0.01em;
          color: #0f172a;
          line-height: 1.2;
        }

        .tile-body p {
          margin: 6px 0 10px;
          color: #64748b;
          font-size: 0.84rem;
          font-weight: 700;
          line-height: 1.35;
        }

        /* CTA pill inside tile */
        .tile-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          font-weight: 900;
          font-size: 12px;
          color: #004b75;
          background: rgba(0, 100, 145, 0.1);
          border: 1px solid rgba(0, 100, 145, 0.18);
        }

        .tile-arrow {
          position: relative;
          z-index: 1;
          margin-left: auto;
          width: 36px;
          height: 36px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-size: 1.25rem;
          color: rgba(15, 23, 42, 0.55);
          background: rgba(2, 6, 23, 0.04);
          border: 1px solid rgba(15, 23, 42, 0.06);
          transition: transform 0.14s ease, background 0.14s ease, color 0.14s ease;
        }

        .tile:hover .tile-arrow {
          transform: translateX(2px);
          background: rgba(0, 100, 145, 0.12);
          color: rgba(0, 75, 117, 0.95);
        }

        /* Variant rails (and icon tint) */
        .tile[data-variant="service"]::after {
          background: linear-gradient(180deg, #006491 0%, #004b75 100%);
        }
        .tile[data-variant="standards"]::after {
          background: linear-gradient(180deg, #16a34a 0%, #166534 100%);
        }
        .tile[data-variant="reports"]::after {
          background: linear-gradient(180deg, #f59e0b 0%, #b45309 100%);
        }
        .tile[data-variant="osa"]::after {
          background: linear-gradient(180deg, #7c3aed 0%, #4c1d95 100%);
        }
        .tile[data-variant="profile"]::after {
          background: linear-gradient(180deg, #0ea5e9 0%, #0369a1 100%);
        }
        .tile[data-variant="deepclean"]::after {
          background: linear-gradient(180deg, #22c55e 0%, #15803d 100%);
        }
        .tile[data-variant="memomailer"]::after {
          background: linear-gradient(180deg, #ef4444 0%, #991b1b 100%);
        }
        .tile[data-variant="promo"]::after {
          background: linear-gradient(180deg, #e31837 0%, #8a1020 100%);
        }
        .tile[data-variant="admin"]::after {
          background: linear-gradient(180deg, #0f172a 0%, #334155 100%);
        }

        /* Give each icon a subtle tint by variant (still premium, but more integrated) */
        .tile[data-variant="standards"] .tile-icon {
          background: linear-gradient(135deg, #16a34a 0%, #166534 60%, #052e16 100%);
        }
        .tile[data-variant="reports"] .tile-icon {
          background: linear-gradient(135deg, #f59e0b 0%, #b45309 60%, #451a03 100%);
        }
        .tile[data-variant="osa"] .tile-icon {
          background: linear-gradient(135deg, #7c3aed 0%, #4c1d95 60%, #1e1b4b 100%);
        }
        .tile[data-variant="memomailer"] .tile-icon {
          background: linear-gradient(135deg, #ef4444 0%, #991b1b 60%, #450a0a 100%);
        }
        .tile[data-variant="promo"] .tile-icon {
          background: linear-gradient(135deg, #e31837 0%, #8a1020 60%, #3b0a12 100%);
        }
        .tile[data-variant="admin"] .tile-icon {
          background: linear-gradient(135deg, #0f172a 0%, #334155 60%, #020617 100%);
        }

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
          .grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .tile {
            padding: 14px 14px 12px;
          }
          .tile-icon {
            width: 52px;
            height: 52px;
            border-radius: 17px;
            flex: 0 0 52px;
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
