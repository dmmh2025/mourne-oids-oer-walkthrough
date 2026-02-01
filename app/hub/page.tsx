"use client";

import React, { useEffect, useState } from "react";
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

export default function HubPage() {
  const [tickerMessages, setTickerMessages] = useState<TickerItem[]>([]);
  const [tickerError, setTickerError] = useState<string | null>(null);

  // NEW: status strip
  const [status, setStatus] = useState<HubStatus>({
    serviceLastUpdated: null,
    osaLastUpdated: null,
    error: null,
  });

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

      // prefer active messages, fallback to all
      const active = data.filter((d: any) => d.active === true);
      setTickerMessages((active.length > 0 ? active : data) as TickerItem[]);
    };
    load();
  }, []);

  // NEW: load hub status (last updated timestamps)
  useEffect(() => {
    const loadStatus = async () => {
      if (!supabase) {
        setStatus((s) => ({ ...s, error: "Supabase client not available" }));
        return;
      }

      try {
        // service last updated
        const { data: svcData, error: svcErr } = await supabase
          .from("service_shifts")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1);

        // internal osa last updated
        const { data: osaData, error: osaErr } = await supabase
          .from("osa_internal_results")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1);

        if (svcErr) throw svcErr;
        if (osaErr) throw osaErr;

        const svc = svcData?.[0]?.created_at ?? null;
        const osa = osaData?.[0]?.created_at ?? null;

        setStatus({
          serviceLastUpdated: svc,
          osaLastUpdated: osa,
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

  // category → colour bar
  const getCategoryColor = (cat?: string | null) => {
    const c = (cat || "").toLowerCase();
    if (c === "service push") return "#E31837"; // red
    if (c === "celebration") return "#16A34A"; // green
    if (c === "ops") return "#F59E0B"; // amber
    if (c === "warning") return "#7C3AED"; // purple
    // default / announcement
    return "#ffffff";
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

  // logout
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
      {/* Banner */}
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      {/* News Ticker */}
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

      {/* Page content */}
      <div className="shell">
        {/* Title */}
        <header className="header">
          <h1>Mourne-oids Hub</h1>
          <p className="subtitle">“Climbing New Peaks, One Shift at a Time.” ⛰️🍕</p>

          {/* STEP 1: Purpose Bar */}
          <div className="purpose-bar" role="note">
            One source of truth for service, standards, and leadership.
          </div>

          {/* STEP 1: Status Strip */}
          <div className="status-strip" aria-label="Data status">
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
        </header>

        {/* top actions */}
        <div className="top-actions">
          <button onClick={handleLogout} className="btn-logout">
            🚪 Log out
          </button>
        </div>

        {/* Buttons */}
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
      </div>

      {/* Footer */}
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
          --radius-lg: 1.4rem;
          --shadow-card: 0 16px 40px rgba(0, 0, 0, 0.05);
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
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
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

        /* STEP 1: Purpose bar */
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

        /* STEP 1: Status strip */
        .status-strip {
          margin: 12px auto 0;
          width: min(900px, 100%);
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
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

        .status-dot.ok { background: #22c55e; }
        .status-dot.bad { background: #ef4444; }

        .status-label {
          color: #475569;
          font-weight: 800;
        }

        .status-value {
          color: #0f172a;
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
          transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
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

        .footer {
          text-align: center;
          margin-top: 24px;
          color: #94a3b8;
          font-size: 0.8rem;
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
