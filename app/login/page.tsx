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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) {
          setErr(error.message);
          return;
        }

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

        router.replace("/");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setErr(error.message);
        return;
      }

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
    } catch (e: any) {
      setErr(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="hub-bg">
      <div className="hub-card">
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <img
            src="/mourneoids_forms_header_1600x400.png"
            alt="Mourne-oids"
            style={{ width: "100%", maxHeight: 110, objectFit: "cover", borderRadius: 12 }}
          />
        </div>

        <h1>
          {mode === "signin" ? "Sign in to Mourne-oids Hub" : "Create your Mourne-oids account"}
        </h1>
        <p className="hub-subtitle">
          {mode === "signin"
            ? "Enter your email and password to continue."
            : "This will create a user in Supabase and a profile record."}
        </p>

        <form onSubmit={handleSubmit} className="hub-form">
          <label className="hub-label">
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="hub-label">
            <span>Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {err ? <p style={{ color: "#b91c1c", fontWeight: 600 }}>{err}</p> : null}

          <button type="submit" className="brand" disabled={loading}>
            {loading ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 13 }}>
          {mode === "signin" ? "Don’t have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            className="hub-link-btn"
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}
