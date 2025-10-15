"use client";
export const dynamic = "force-dynamic";

import * as React from "react";

export default function Home() {
  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "24px",
        display: "grid",
        gap: 20,
      }}
    >
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,.12)",
        }}
      >
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header"
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>

      <h1
        style={{
          textAlign: "center",
          fontSize: "2.2rem",
          margin: "10px 0 0 0",
          color: "#0b5f80",
          fontWeight: 700,
        }}
      >
        Daily OER Walkthrough
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card
          title="Start Walkthrough"
          body="Tick the checklist, enter ADT / Extreme Lates / SBR, and save your predicted OER score."
          cta={{ href: "/walkthrough", label: "👉 Start Walkthrough" }}
        />
        <Card
          title="Admin"
          body="See the latest submissions across stores."
          cta={{ href: "/admin", label: "🧭 Open Admin" }}
        />
      </div>
    </main>
  );
}

function Card(props: { title: string; body: string; cta: { href: string; label: string } }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        padding: 18,
        border: "1px solid #eee",
        boxShadow: "0 6px 20px rgba(0,0,0,.06)",
        display: "grid",
        gap: 8,
      }}
    >
      <h2 style={{ margin: 0 }}>{props.title}</h2>
      <p style={{ margin: 0, color: "#374151" }}>{props.body}</p>
      <div>
        <a href={props.cta.href} style={linkBtn()}>
          {props.cta.label}
        </a>
      </div>
    </div>
  );
}

function linkBtn() {
  return {
    display: "inline-block",
    background: "#006491",
    color: "white",
    padding: "10px 14px",
    borderRadius: 10,
    textDecoration: "none",
    border: "1px solid #004e73",
    fontWeight: 600,
  } as React.CSSProperties;
}
