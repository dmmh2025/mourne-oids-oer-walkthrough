"use client";

import * as React from "react";

/** Build the public URL for the latest memomailer PDF from env vars */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const MEMO_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/memomailer/latest.pdf`
  : "#";

export default function HomePage() {
  return (
    <main className="wrap">
      {/* Banner */}
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <section className="container">
        <h1>Welcome</h1>

        <div className="grid">
          {/* Daily OER Walkthrough */}
          <a href="/walkthrough" className="btn btn--brand btn--lg">
            ✅ Daily OER Walkthrough
          </a>

          {/* Autumn Deep Clean */}
          <a href="/deep-clean" className="btn btn--brand btn--lg">
            🧽 Autumn Deep Clean Checklist
          </a>

          {/* Weekly Memomailer (PDF) */}
          <a
            href={MEMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--brand btn--lg"
          >
            📄 Weekly Memomailer
          </a>

          {/* Admin */}
          <a href="/admin" className="btn btn--ghost btn--lg">
            📊 Admin Dashboard
          </a>
        </div>
      </section>

      {/* Styles */}
      <style jsx>{`
        :root {
          --bg: #f2f5f9;
          --paper: #ffffff;
          --line: #e5e7eb;
          --muted: #6b7280;
          --text: #1a1a1a;
          --brand: #006491;
          --brand-dk: #00517a;
          --shadow-card: 0 10px 18px rgba(2,6,23,.08), 0 1px 3px rgba(2,6,23,.06);
        }

        .wrap {
          min-height: 100dvh;
          background: var(--bg);
          color: var(--text);
        }

        /* Banner */
        .banner {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 6px 0 10px;
          background: #fff;
          border-bottom: 3px solid var(--brand);
          box-shadow: var(--shadow-card);
        }
        .banner img {
          max-width: 92%;
          height: auto;
          display: block;
        }

        /* Content */
        .container {
          max-width: 880px;
          margin: 0 auto;
          padding: 16px;
        }
        h1 {
          text-align: center;
          font-size: 22px;
          font-weight: 800;
          margin: 16px 0 18px;
          letter-spacing: 0.2px;
        }

        /* Button grid */
        .grid {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 640px) {
          .grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        /* Buttons – match walkthrough look */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-weight: 800;
          border-radius: 14px;
          border: 2px solid #d7dbe3;
          background: #fff;
          color: var(--text);
          padding: 12px 14px;
          box-shadow: 0 1px 0 rgba(255,255,255,0.7);
          transition: transform 0.08s ease, background 0.2s ease, border-color 0.2s ease;
        }
        .btn:hover { transform: translateY(-2px); }

        .btn--lg {
          padding: 16px 18px;
          font-size: 17px;
        }

        .btn--brand {
          background: var(--brand);
          border-color: var(--brand-dk);
          color: #fff;
        }
        .btn--brand:hover {
          background: var(--brand-dk);
          border-color: var(--brand-dk);
          color: #fff;
        }

        .btn--ghost {
          background: #fff;
          border-color: #d7dbe3;
          color: var(--text);
        }
        .btn--ghost:hover {
          border-color: var(--brand);
        }
      `}</style>
    </main>
  );
}
