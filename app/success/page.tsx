"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

export default function SuccessPage() {
  const q = useSearchParams();
  const store = q.get("store") ?? "";
  const predicted = q.get("predicted");
  const walkthrough = q.get("walkthrough");
  const service = q.get("service");

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, textAlign: "center" }}>
      <div
        style={{
          borderRadius: 16,
          padding: 24,
          border: "1px solid #e5e7eb",
          background: "white",
          boxShadow: "0 12px 30px rgba(0,0,0,.06)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28 }}>✅ Walkthrough submitted</h1>
        <p style={{ color: "#475569", marginTop: 8 }}>
          {store ? <>Thanks! Submission recorded for <strong>{store}</strong>.</> : "Thanks! Your submission has been recorded."}
        </p>

        {(predicted || walkthrough || service) && (
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: 14,
            }}
          >
            {walkthrough && <Badge label="Walkthrough" value={`${walkthrough}/75`} />}
            {service && <Badge label="Service" value={`${service}/25`} />}
            {predicted && (
              <Badge
                label="Predicted"
                value={`${predicted}/100`}
                strong
                color={colourForPredicted(Number(predicted))}
              />
            )}
          </div>
        )}

        <div style={{ marginTop: 22, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/admin" style={linkBtn("#006491", "#004e73")}>🧭 View Report</a>
          <a href="/walkthrough" style={linkBtn("#0b5f80", "#094c66")}>➕ Start another</a>
          <a href="/" style={linkGhost()}>← Back Home</a>
        </div>
      </div>
    </main>
  );
}

function Badge(props: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: "#f1f5f9",
        border: "1px solid #e5e7eb",
        color: props.color || "#111827",
        fontWeight: props.strong ? 800 : 600,
      }}
    >
      <span style={{ opacity: 0.7 }}>{props.label}</span>
      <span>{props.value}</span>
    </span>
  );
}

function linkBtn(bg: string, border: string) {
  return {
    display: "inline-block",
    background: bg,
    border: `1px solid ${border}`,
    color: "white",
    padding: "10px 14px",
    borderRadius: 10,
    textDecoration: "none",
    fontWeight: 700,
  } as React.CSSProperties;
}
function linkGhost() {
  return {
    display: "inline-block",
    background: "white",
    border: "1px solid #e5e7eb",
    color: "#111827",
    padding: "10px 14px",
    borderRadius: 10,
    textDecoration: "none",
    fontWeight: 700,
  } as React.CSSProperties;
}

function colourForPredicted(v: number) {
  if (v >= 85) return "#065f46"; // green
  if (v >= 70) return "#92400e"; // amber
  return "#7f1d1d";              // red
}
