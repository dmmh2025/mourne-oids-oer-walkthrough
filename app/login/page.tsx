"use client";
export const dynamic = "force-dynamic";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(url, anon);

export default function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Sending magic link…");

    const site =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${site}/auth/callback`,
        shouldCreateUser: true,
      },
    });

    if (error) setStatus(`Error: ${error.message}`);
    else setStatus("✅ Check your inbox for the magic link.");
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "80px auto",
        textAlign: "center",
        background: "white",
        borderRadius: 12,
        padding: 24,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Mourne-oids Admin Login</h1>
      <p style={{ marginBottom: 24, color: "#555" }}>
        Enter your Domino’s email address to receive a magic login link.
      </p>

      <form onSubmit={sendLink} style={{ display: "grid", gap: 12 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@dominos.co.uk"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 12px",
            background: "#006491",
            color: "white",
            fontWeight: 600,
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Send Magic Link
        </button>
      </form>

      {status && (
        <p
          style={{
            marginTop: 20,
            fontSize: 14,
            color: status.startsWith("Error") ? "crimson" : "green",
          }}
        >
          {status}
        </p>
      )}
    </main>
  );
}
