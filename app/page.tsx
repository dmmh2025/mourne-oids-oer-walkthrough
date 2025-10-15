"use client";
export const dynamic = "force-dynamic";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(url, anon);

export default function Home() {
  const [authed, setAuthed] = React.useState<boolean | null>(null);
  const [email, setEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <main style={{
      maxWidth: 1100, margin: "0 auto", padding: "24px",
      display: "grid", gap: 20
    }}>
      {/* Brand header card */}
      <div style={{
        background: "linear-gradient(90deg,#006491,#e31837)",
        color: "white", borderRadius: 16, padding: "28px 24px",
        display: "grid", gap: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/dominos.png" alt="Domino's" style={{ height: 36 }} />
          <div style={{ flex: 1, textAlign: "center" }}>
            <img src="/mourneoids.png" alt="Mourne-oids" style={{ height: 36 }} />
          </div>
          <img src="/racz.png" alt="Racz Group" style={{ height: 36 }} />
        </div>
        <h1 style={{ margin: "6px 0 0 0", fontSize: 28 }}>Mourne-oids OER Walkthrough</h1>
        <p style={{ margin: 0, opacity: 0.95 }}>
          Be OER-ready every shift: do the walkthrough, add service metrics, get a predicted score, and save it.
        </p>
      </div>

      {/* Auth strip */}
      <div style={{
        background: "#fff", borderRadius: 12, padding: 14,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        border: "1px solid #eee"
      }}>
        {authed === null ? (
          <span>Checking login…</span>
        ) : authed ? (
          <>
            <span>Signed in as <strong>{email}</strong></span>
            <div style={{ display: "flex", gap: 10 }}>
              <a href="/logout" style={linkBtn("outline")}>Logout</a>
            </div>
          </>
        ) : (
          <>
            <span>You’re not signed in.</span>
            <div style={{ display: "flex", gap: 10 }}>
              <a href="/login" style={linkBtn("primary")}>Login</a>
            </div>
          </>
        )}
      </div>

      {/* Main actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card
          title="Start Walkthrough"
          body="Tick the checklist, enter ADT / Extreme Lates / SBR, and save your predicted OER score."
          cta={{ href: "/walkthrough", label: "👉 Start Walkthrough" }}
        />
        <Card
          title="Admin"
          body="See the latest submissions across stores. (Login required; access limited by your store membership.)"
          cta={{ href: "/admin", label: "🧭 Open Admin" }}
        />
      </div>

      {/* Helpful links / notes */}
      <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}>
        Need another store added to your login? Ask your manager to add your email in <em>store_members</em>.
      </div>
    </main>
  );
}

function Card(props: { title: string; body: string; cta: { href: string; label: string } }) {
  return (
    <div style={{
      background: "white", borderRadius: 16, padding: 18,
      border: "1px solid #eee", boxShadow: "0 6px 20px rgba(0,0,0,.06)",
      display: "grid", gap: 8
    }}>
      <h2 style={{ margin: 0 }}>{props.title}</h2>
      <p style={{ margin: 0, color: "#374151" }}>{props.body}</p>
      <div>
        <a href={props.cta.href} style={linkBtn("primary")}>{props.cta.label}</a>
      </div>
    </div>
  );
}

function linkBtn(variant: "primary" | "outline") {
  if (variant === "primary") {
    return {
      display: "inline-block",
      background: "#006491",
      color: "white",
      padding: "10px 14px",
      borderRadius: 10,
      textDecoration: "none",
      border: "1px solid #004e73",
      fontWeight: 600,
    } as React.CSSProperties;
  }
  return {
    display: "inline-block",
    background: "white",
    color: "#111827",
    padding: "10px 14px",
    borderRadius: 10,
    textDecoration: "none",
    border: "1px solid #e5e7eb",
    fontWeight: 600,
  } as React.CSSProperties;
}
