"use client";

import React, { useState } from "react";
import { getSupabaseClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

const supabase = getSupabaseClient();

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        // 1) create the user
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) {
          setErr(error.message);
          return;
        }

        // 2) immediately create/update profile (this is the key bit)
        if (data.user) {
          await supabase.from("profiles").upsert(
            {
              id: data.user.id,
              email: data.user.email,
              role: "user",
            },
            {
              onConflict: "id",
            }
          );
        }

        // 3) go to hub
        router.replace("/");
        return;
      } else {
        // SIGN IN
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setErr(error.message);
          return;
        }

        // make sure profile exists even if they signed up ages ago
        if (data.user) {
          await supabase.from("profiles").upsert(
            {
              id: data.user.id,
              email: data.user.email,
            },
            {
              onConflict: "id",
            }
          );
        }

        router.replace("/");
        return;
      }
    } catch (e: any) {
      setErr(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

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
          maxWidth: 420,
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 16px 40px rgba(15,23,42,.05)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <img
            src="/mourneoids_forms_header_1600x400.png"
            alt="Mourne-oids"
            style={{ width: "100%", maxHeight: 110, objectFit: "cover", borderRadius: 12 }}
          />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>
          {mode === "signin" ? "Sign in to Mourne-oids Hub" : "Create your Mourne-oids account"}
        </h1>
        <p style={{ marginBottom: 16, color: "#64748b" }}>
          {mode === "signin"
            ? "Enter your email and password to continue."
            : "This will create a user in Supabase and a profile record."}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "8px 10px",
                fontSize: 14,
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "8px 10px",
                fontSize: 14,
              }}
            />
          </label>

          {err ? <p style={{ color: "#b91c1c", fontWeight: 600 }}>{err}</p> : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "#006491",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 13 }}>
          {mode === "signin" ? "Don’t have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            style={{
              background: "none",
              border: "none",
              color: "#006491",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}
