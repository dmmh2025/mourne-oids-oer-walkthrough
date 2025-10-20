"use client";

import React from "react";

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
          <a href="/walkthrough" className="btn btn--brand">
            🧾 Daily OER Walkthrough
          </a>
          <a href="/deep-clean" className="btn btn--brand">
            🧽 Autumn Deep Clean Checklist
          </a>
          <a href="/memomailer" className="btn btn--brand">
            📬 Weekly MemoMailer
          </a>
          <a href="/pizza-of-the-week" className="hubbtn">
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
      `}</style>
    </main>
  );
}
