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
        <h1>Welcome to the Mourne-oids Hub</h1>
        <p className="intro">
          Quick access to your key tools and weekly updates.
        </p>

        <div className="grid">
          {/* Walkthrough */}
          <a href="/walkthrough" className="btn">
            ✅ Daily OER Walkthrough
          </a>

          {/* Deep Clean */}
          <a href="/deep-clean" className="btn">
            🧽 Autumn Deep Clean Checklist
          </a>

          <a href="/memomailer" className="btn">📄 Weekly Memomailer</a>


          {/* Admin */}
          <a href="/admin" className="btn">
            📊 Admin Dashboard
          </a>
        </div>
      </section>

      {/* Styles */}
      <style jsx>{`
        :root {
          --brand: #006491;
          --brand-dark: #004c70;
          --bg: #f4f7fa;
          --text: #1b1b1b;
          --paper: #ffffff;
          --shadow-strong: 0 12px 25px rgba(0, 0, 0, 0.08);
          --shadow-soft: 0 4px 10px rgba(0, 0, 0, 0.04);
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
          padding: 8px 0 10px;
          background: #fff;
          border-bottom: 4px solid var(--brand);
          box-shadow: var(--shadow-soft);
        }
        .banner img {
          max-width: 92%;
          height: auto;
          display: block;
        }

        /* Container */
        .container {
          max-width: 900px;
          margin: 0 auto;
          padding: 24px 16px;
          text-align: center;
        }

        h1 {
          font-size: 24px;
          font-weight: 900;
          margin: 0 0 6px;
          letter-spacing: 0.2px;
          color: var(--text);
        }

        .intro {
          color: #3a3a3a;
          margin-bottom: 22px;
          font-size: 16px;
        }

        /* Grid for buttons */
        .grid {
          display: grid;
          gap: 16px;
          grid-template-columns: 1fr;
        }

        @media (min-width: 640px) {
          .grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        /* Buttons (all same style now) */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 800;
          text-decoration: none;
          padding: 16px 20px;
          border-radius: 14px;
          background: #ffffff;
          border: 3px solid var(--brand);
          color: var(--brand);
          box-shadow: var(--shadow-strong);
          transition: all 0.15s ease-in-out;
          text-align: center;
        }

        .btn:hover {
          background: var(--brand);
          color: #fff;
          transform: translateY(-2px);
        }
      `}</style>
    </main>
  );
}
