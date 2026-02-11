"use client";

import Link from "next/link";

export default function PendingPage() {
  return (
    <main className="hub-bg">
      <div className="hub-card" style={{ maxWidth: 520 }}>
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

        <h1>Account pending approval</h1>
        <p className="hub-subtitle" style={{ marginBottom: 0, fontWeight: 600, lineHeight: 1.5 }}>
          Your account has been created, but it hasn’t been approved yet. Once approved, you’ll
          be able to access the Mourne-oids Hub.
        </p>

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/login" style={{ textDecoration: "none" }}>
            <button type="button">Back to login</button>
          </Link>
        </div>
      </div>
    </main>
  );
}
