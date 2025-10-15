"use client";
export const dynamic = "force-dynamic";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(url, anon);

export default function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Sending magic link…");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Redirect back to your site after clicking the email link
        emailRedirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });

    if (error) setStatus(`Error: ${error.message}`);
    else setStatus("Check your inbox for the login link.");
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 12 }}>Log in</h1>
      <form onSubmit={sendLink} style={{ display: "grid", gap: 10 }}>
        <label>
          Work email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <button type="submit" style={{ padding: "10px 14px" }}>
          Send magic link
        </button>
      </form>
      {status && <p style={{ marginTop: 10 }}>{status}</p>}
      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
        Use the email that’s on the <em>store_members</em> list.
      </p>
    </main>
  );
}
