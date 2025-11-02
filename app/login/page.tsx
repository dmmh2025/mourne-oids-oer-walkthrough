"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeFromUrl = searchParams?.get("mode") === "signup" ? "signup" : "signin";

  const [mode, setMode] = React.useState<"signin" | "signup">(modeFromUrl);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // try to fetch current session and skip login if already logged in
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/"); // already logged in
      }
    })();
  }, [router]);

  const handleSignIn = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (!data.session) {
      // this happens if email confirmation is still ON
      setError("Sign-in succeeded but no active session. Check email confirmations in Supabase.");
      return;
    }

    router.replace("/");
  };

  const handleSignUp = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // CASE 1: email confirmations OFF  -> we get a session immediately
    if (data.session) {
      router.replace("/");
      return;
    }

    // CASE 2: email confirmations ON -> user must click link
    setError(
      "We’ve sent you a confirmation email. Open it and click the link, then come back and sign in."
    );
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at top, rgba(0, 100, 145, 0.08), transparent 45%), linear-gradient(180deg, #e3edf4 0%, #f2f5f9 30%, #f2f5f9 100%)",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 15px 35px rgba(15,23,42,.08)",
          overflow: "hidden",
          border: "1px solid rgba(0,100,145,.1)",
        }}
      >
        <div style={{ padding: "14px 16px 0" }}>
          <img
            src="/mourneoids_forms_header_1600x400.png"
            alt="Mourne-oids"
            style={{ width: "100%", borderRadius: 14, objectFit: "cover" }}
          />
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <button
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 999,
                border: "1px solid transparent",
                background: mode === "signin" ? "#006491" : "#e2e8f0",
                color: mode === "signin" ? "#fff" : "#0f172a",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Sign in
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 999,
                border: "1px solid transparent",
                background: mode === "signup" ? "#006491" : "#e2e8f0",
                color: mode === "signup" ? "#fff" : "#0f172a",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Sign up
            </button>
          </div>

          <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "#475569" }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "8px 10px",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "#475569" }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "8px 10px",
              }}
            />
          </label>

          {error ? (
            <p style={{ background: "#fee2e2", color: "#991b1b", padding: 8, borderRadius: 10, fontSize: 13 }}>
              {error}
            </p>
          ) : null}

          <button
            onClick={mode === "signin" ? handleSignIn : handleSignUp}
            disabled={loading}
            style={{
              width: "100%",
              background: "#006491",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "10px 0",
              fontWeight: 700,
              marginTop: 4,
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>

          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 14, textAlign: "center" }}>
            Trouble logging in? Ask Damien to check your profile role.
          </p>
        </div>
      </div>
    </main>
  );
}
