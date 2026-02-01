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

export default function HubPage() {
  const [tickerMessages, setTickerMessages] = useState<TickerItem[]>([]);
  const [tickerError, setTickerError] = useState<string | null>(null);

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

  const getCategoryColor = (cat?: string | null) => {
    const c = (cat || "").toLowerCase();
    if (c === "service push") return "#E31837";
    if (c === "celebration") return "#16A34A";
    if (c === "ops") return "#F59E0B";
    if (c === "warning") return "#7C3AED";
    return "#ffffff";
  };

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
                📰 No news items found in Supabase (<code>news_ticker</code>)
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
        <header className="header">
          <h1>Mourne-oids Hub</h1>
          <p className="subtitle">
            “Climbing New Peaks, One Shift at a Time.” ⛰️🍕
          </p>
        </header>

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
              <p>Pre-open & handover standards checklist.</p>
            </div>
            <div className="card-link__chevron">›</div>
          </a>

          <a href="/admin" className="card-link">
            <div className="card-link__icon">📈</div>
            <div className="card-link__body">
              <h2>Standards Completion report</h2>
              <p>Track pre-open & handover completion by store.</p>
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

      <footer className="footer">
        <p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>
    </main>
  );
}
