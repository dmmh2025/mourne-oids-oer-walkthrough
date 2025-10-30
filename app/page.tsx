"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// create supabase client (same as other pages)
const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

export default function HomePage() {
  const [tickerMessages, setTickerMessages] = useState<string[]>([]);

  // load ticker messages
  useEffect(() => {
    const load = async () => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from("news_ticker")
        .select("message")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTickerMessages(data.map((d) => d.message));
      }
    };
    load();
  }, []);

  return (
    <main className="wrap">
      {/* Banner */}
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      {/* News Ticker (only shows if there is data) */}
      {tickerMessages.length > 0 && (
        <div className="ticker-wrap" aria-label="Mourne-oids latest updates">
          <div className="ticker">
            {tickerMessages.map((m, i) => (
              <span key={i} className="ticker-item">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Title */}
      <header className="header">
        <h1>Mourne-oids Hub</h1>
        <p className="subtitle">
          Daily OER Walkthrough · Autumn Deep Clean · Weekly MemoMailer
        </p>
      </header>

      {/* Buttons */}
      <section className="container">
        <div className="buttons">
          {/* NEW: Service Dashboard */}
          <a href="/dashboard/service" className="btn btn--brand">
            📊 Service Dashboard
          </a>

          <a href="/walkthrough" className="btn btn--brand">
            🧾 Daily OER Walkthrough
          </a>

          <a href="/deep-clean" className="btn btn--brand">
            🧽 Autumn Deep Clean Checklist
          </a>

          <a href="/memomailer" className="btn btn--brand">
            📬 Weekly MemoMailer
          </a>

          <a href="/pizza-of-the-week" className="btn btn--brand">
            🍕 Pizza of the Week
          </a>

          <a href="/admin" className="btn btn--brand">
            ⚙️ Admin Panel
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>

      {/* Styles */}
      <style jsx>{`
        :root {
          --bg: #f2f5f9;
          --paper: #ffffff;
          --text: #0f172a;
          --muted: #475569;
          --brand: #006491;
          --brand-dark: #004b75;
          --shadow-card: 0 10px 18px rgba(2, 6, 23, 0.08),
            0 1px 3px rgba(2, 6, 23, 0.06);
        }

        .wrap {
          background: var(--bg);
          min-height: 100dvh;
          color: var(--text);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-bottom: 40px;
        }

        .banner {
          display: flex;
          justify-content: center;
          align-items: center;
          background: #fff;
          border-bottom: 3px solid var(--brand);
          box-shadow: var(--shadow-card);
          width: 100%;
        }

        .banner img {
          max-width: 92%;
          height: auto;
          display: block;
        }

        /* NEW: Ticker */
        .ticker-wrap {
          width: 100%;
          overflow: hidden;
          background: var(--brand);
          color: #fff;
          border-bottom: 2px solid var(--brand-dark);
          box-shadow: inset 0 -1px 2px rgba(0, 0, 0, 0.12);
          white-space: nowrap;
        }
        .ticker {
          display: inline-block;
          animation: scroll 25s linear infinite;
          padding: 6px 0;
        }
        .ticker-item {
          display: inline-block;
          padding: 0 2.4rem;
          font-weight: 600;
          font-size: 0.9rem;
        }
        @keyframes scroll {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }

        .header {
          text-align: center;
          margin: 24px 16px 8px;
        }

        .header h1 {
          font-size: 26px;
          font-weight: 900;
          color: var(--text);
          margin-bottom: 6px;
        }

        .subtitle {
          color: var(--muted);
          font-size: 14px;
          font-weight: 500;
        }

        .container {
          width: 100%;
          max-width: 420px;
          margin-top: 24px;
          display: flex;
          justify-content: center;
        }

        .buttons {
          display: grid;
          gap: 14px;
          width: 100%;
        }

        .btn {
          display: block;
          text-align: center;
          padding: 14px 18px;
          border-radius: 14px;
          font-weight: 800;
          font-size: 16px;
          text-decoration: none;
          color: #fff;
          background: var(--brand);
          border: 2px solid var(--brand-dark);
          box-shadow: var(--shadow-card);
          transition: background 0.2s, transform 0.1s;
        }

        .btn:hover {
          background: var(--brand-dark);
          transform: translateY(-1px);
        }

        .footer {
          text-align: center;
          margin-top: 40px;
          color: var(--muted);
          font-size: 13px;
        }

        @media (max-width: 500px) {
          .ticker {
            animation-duration: 35s;
          }
          .ticker-item {
            padding: 0 1.4rem;
          }
        }
      `}</style>
    </main>
  );
}
