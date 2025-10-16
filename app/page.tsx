export const dynamic = "force-static";

import * as React from "react";

export default function HomePage() {
  return (
    <main>
      {/* Banner */}
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      {/* Hero card */}
      <section style={{ padding: 16, marginBottom: 14 }}>
        <header>
          <strong style={{ fontSize: 22 }}>Daily OER Walkthrough</strong>
          <small style={{ color: "var(--muted)" }}>
            Quick, consistent, OER-ready checks
          </small>
        </header>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 6,
              background:
                "linear-gradient(180deg, rgba(0,100,145,.06), rgba(255,255,255,1))",
              border: "1px solid var(--softline)",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Use this walkthrough to make your store fully OER-ready before
              opening. You’ll get a predicted OER score and your results are
              saved to the dashboard automatically.
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                color: "var(--muted)",
                lineHeight: 1.6,
              }}
            >
              <li>Mobile-first, stacked checks for clarity</li>
              <li>Photo uploads per check (optional but encouraged)</li>
              <li>Automatic service score + star grade</li>
            </ul>
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <a href="/walkthrough">
              <button className="brand">Start Walkthrough</button>
            </a>
            <a href="/admin">
              <button>Open Admin Dashboard</button>
            </a>
          </div>

          {/* Legend */}
          <div
            style={{
              display: "grid",
              gap: 8,
              border: "1px solid var(--softline)",
              borderRadius: 12,
              padding: 12,
              background: "#fff",
            }}
          >
            <strong>Star grading</strong>
            <div style={{ color: "var(--muted)" }}>
              90%+ = 5★ &nbsp;•&nbsp; 80–89.99% = 4★ &nbsp;•&nbsp; 70–79.99% =
              3★ &nbsp;•&nbsp; 60–69.99% = 2★ &nbsp;•&nbsp; 50–59.99% = 1★
              &nbsp;•&nbsp; &lt;50% = 0★
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
