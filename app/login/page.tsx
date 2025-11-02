"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/utils/supabase/client";

const supabase = getSupabaseClient();

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const redirectedFrom = search.get("redirectedFrom") || "/admin";

  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        // after signup, just send to home or admin
        router.replace(redirectedFrom);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.replace(redirectedFrom);
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 420,
        margin: "50px auto",
        background: "white",
        padding: 24,
        borderRadius: 12,
        border: "1px solid #e2e8f0",
      }}
    >
      <h1 style={{ marginBottom: 6 }}>
        {mode === "signin" ? "Sign in to Mourne-oids Hub" : "Create your Mourne-oids account"}
      </h1>
      <p style={{ marginBottom: 16, color: "#64748b" }}>
        Use your Domino’s / Mourne-oids email.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span>Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>

        {error && <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#006491",
            color: "white",
            padding: "10px 14px",
            borderRadius: 8,
            border: "none",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Working..." : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <div style={{ marginTop: 16 }}>
        {mode === "signin" ? (
          <button
            onClick={() => setMode("signup")}
            style={{ background: "transparent", border: "none", color: "#0ea5e9", cursor: "pointer" }}
          >
            Need an account? Create one
          </button>
        ) : (
          <button
            onClick={() => setMode("signin")}
            style={{ background: "transparent", border: "none", color: "#0ea5e9", cursor: "pointer" }}
          >
            Already have an account? Sign in
          </button>
        )}
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: "#94a3b8" }}>
        Still seeing a browser popup for username/password? That’s the old Basic Auth — ask Damien to add you to
        <code style={{ background: "#e2e8f0", padding: "1px 4px", marginLeft: 4, borderRadius: 4 }}>BASIC_AUTH_JSON</code>.
      </p>
    </main>
  );
}
