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
        <header style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
            Daily OER Walkthrough
          </div>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            Quick, consistent, OER-ready checks
          </div>
        </header>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "1fr",
            maxWidth: 820,
          }}
        >
          {/* Intro box */}
          <div
            style={{
              display: "grid",
              gap: 10,
              background:
                "linear-gradient(180deg, rgba(0,100,145,.06), rgba(255,255,255,1))",
              border: "1px solid var(--softline)",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Use this walkthrough to make your store fully OER-ready before
              opening. You’ll get a predicted OER score and your results are
              saved to the dashboard automatically.
            </p>
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
  <a href="/walkthrough" style={{ flex: "1 1 180px", maxWidth: 240 }}>
    <button className="brand" style={{ width: "100%" }}>
      Start Walkthrough
    </button>
  </a>
  <a href="/deep-clean" style={{ flex: "1 1 220px", maxWidth: 260 }}>
    <button style={{ width: "100%" }}>Autumn Deep Clean Checklist</button>
  </a>
  <a href="/admin" style={{ flex: "1 1 180px", maxWidth: 240 }}>
    <button style={{ width: "100%" }}>Open Admin Dashboard</button>
  </a>
</div>

          </div>
        </div>
      </section>
    </main>
  );
}
