"use client";

import Link from "next/link";

export default function PendingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(circle, #00649111 0%, #f8fafc 100%)",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 16px 40px rgba(15,23,42,.05)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <img
            src="/mourneoids_forms_header_1600x400.png"
            alt="Mourne-oids"
            style={{
              width: "100%",
              maxHeight: 120,
              objectFit: "cover",
              borderRadius: 12,
            }}
          />
        </div>

        <h1 style={{ margin: "8px 0 6px", fontSize: 22 }}>
          Account pending approval
        </h1>
        <p style={{ margin: 0, color: "#475569", fontWeight: 600, lineHeight: 1.5 }}>
          Your account has been created, but it hasn’t been approved yet.
          Once approved, you’ll be able to access the Mourne-oids Hub.
        </p>

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontWeight: 800,
              textDecoration: "none",
              color: "#0f172a",
            }}
          >
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
