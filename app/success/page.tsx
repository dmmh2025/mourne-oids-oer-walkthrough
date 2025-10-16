export const dynamic = "force-dynamic"; // don't pre-render with unknown query params

import * as React from "react";

const fmt = (n: number | null | undefined) =>
  typeof n === "number" && !Number.isNaN(n)
    ? n.toFixed(Number.isInteger(n) ? 0 : 2)
    : "—";

const starsForPercent = (p: number) =>
  p >= 90 ? 5 : p >= 80 ? 4 : p >= 70 ? 3 : p >= 60 ? 2 : p >= 50 ? 1 : 0;

function num(q: string | string[] | undefined, def = 0) {
  const v = Array.isArray(q) ? q[0] : q;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export default function SuccessPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const store = (searchParams.store as string) ?? "—";
  const name = (searchParams.name as string) ?? "—";
  const walk = num(searchParams.walk, 0);
  const service = num(searchParams.service, 0);
  const total = num(searchParams.total, walk + service);
  const stars = starsForPercent(total);

  return (
    <main>
      {/* Banner */}
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <section style={{ padding: 16, marginBottom: 14 }}>
        <header>
          <strong style={{ fontSize: 22 }}>Submission Successful</strong>
          <small style={{ color: "var(--muted)" }}>
            Saved to the Admin Dashboard
          </small>
        </header>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr",
          }}
        >
          {/* Summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 8,
            }}
          >
            <Card label="Store" value={store} />
            <Card label="Submitted by" value={name} />
            <Card label="Walkthrough" value={`${fmt(walk)}/75`} />
            <Card label="Service" value={`${fmt(service)}/25`} />
            <Card
              label="Total"
              value={`${fmt(total)}/100 • ${"★".repeat(stars)}${"☆".repeat(
                5 - stars
              )} (${stars})`}
              strong
            />
          </div>

          {/* Next steps */}
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <a href="/">
              <button>Back to Home</button>
            </a>
            <a href="/walkthrough">
              <button className="brand">Do Another Walkthrough</button>
            </a>
            <a href="/admin">
              <button>Open Admin Dashboard</button>
            </a>
          </div>

          {/* Tip */}
          <div
            style={{
              border: "1px solid var(--softline)",
              borderRadius: 12,
              padding: 12,
              background:
                "linear-gradient(180deg, rgba(34,197,94,.06), rgba(255,255,255,1))",
            }}
          >
            <strong style={{ display: "block", marginBottom: 6 }}>
              Nice work!
            </strong>
            <div style={{ color: "var(--muted)" }}>
              Keep your team OER-ready: share the dashboard with Shift Leaders to
              spot trends and lift lower-scoring sections.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Card(props: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid var(--softline)",
        borderRadius: 12,
        padding: 12,
        background: "#fff",
        boxShadow: "0 6px 18px rgba(0,0,0,.04)",
        display: "grid",
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {props.label}
      </div>
      <div style={{ fontSize: 20, fontWeight: props.strong ? 800 : 700 }}>
        {props.value}
      </div>
    </div>
  );
}
