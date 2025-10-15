"use client";
export const dynamic = "force-dynamic";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

export default function SuccessPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <SuccessInner />
    </Suspense>
  );
}

function SuccessInner() {
  const q = useSearchParams();
  const store = q.get("store") ?? "";
  const predicted = q.get("predicted");
  const walkthrough = q.get("walkthrough");
  const service = q.get("service");

  const predictedNum = predicted ? Number(predicted) : null;
  const stars = predictedNum == null ? null : starFromPercent(predictedNum);

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
      {/* Banner */}
      <div style={{ marginBottom: 16 }}>
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids OER"
          style={{
            width: "100%",
            height: "auto",
            borderRadius: 12,
            boxShadow: "0 6px 18px rgba(0,0,0,.08)",
          }}
        />
      </div>

      <div
        style={{
          borderRadius: 16,
          padding: 24,
          border: "1px solid #e5e7eb",
          background: "white",
          boxShadow: "0 12px 30px rgba(0,0,0,.06)",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28 }}>✅ Walkthrough submitted</h1>
        <p style={{ color: "#475569", marginTop: 8 }}>
          {store ? (
            <>
              Thanks! Submission recorded for <strong>{store}</strong>.
            </>
          ) : (
            "Thanks! Your submission has been recorded."
          )}
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
            {predicted && <Badge label="Predicted" value={`${predicted}/100`} strong />}
            {stars != null && (
              <Badge
                label="Grade"
                value={`${"★".repeat(stars)}${"☆".repeat(5 - stars)} (${stars}-Star)`}
                strong
              />
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 22,
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <a href="/admin" style={linkBtn("#006491", "#004e73")}>
            🧭 View Report
          </a>
          <a href="/walkthrough" style={linkBtn("#0b5f80", "#094c66")}>
            ➕ Start another
          </a>
          <a href="/" style={linkGhost()}>
            ← Back Home
          </a>
        </div>
      </div>
    </main>
  );
}

function Skeleton() {
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
      <div
        style={{
          width: "100%",
          height: 160,
          borderRadius: 12,
          background: "#f3f4f6",
          marginBottom: 16,
        }}
      />
      <div
        style={{
          borderRadius: 16,
          padding: 24,
          border: "1px solid #e5e7eb",
          background: "white",
        }}
      >
        <div
          style={{
            height: 28,
            width: 240,
            background: "#f3f4f6",
            borderRadius: 6,
            marginBottom: 12,
          }}
        />
        <div
          style={{
            height: 16,
            width: 360,
            background: "#f3f4f6",
            borderRadius: 6,
          }}
        />
      </div>
    </main>
  );
}

function starFromPercent(p: number) {
  if (p >= 90) return 5;
  if (p >= 80) return 4;
  if (p >= 70) return 3;
  if (p >= 60) return 2;
  if (p >= 50) return 1;
  return 0;
}

function Badge(props: { label: string; value: string; strong?: boolean }) {
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
        color: "#111827",
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
