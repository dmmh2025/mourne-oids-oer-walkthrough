"use client";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const hasEnv = Boolean(url && key);

// Create a client only if env vars are present
const supabase = hasEnv ? createClient(url, key) : null;

export default function Home() {
  return (
    <main>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>🍕 Mourne-oids OER Walkthrough</h1>
      <p>Base app deployed. Next steps: connect to Supabase and add the Walkthrough Wizard.</p>
      <hr style={{ margin: "16px 0" }} />
      <h2>System Status</h2>
      <ul>
        <li>Next.js running ✅</li>
        <li>Supabase env present: {hasEnv ? "✅" : "❌ (set env in Vercel)"} </li>
      </ul>
      {!hasEnv && (
        <p><strong>Tip:</strong> In Vercel, set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> under Project Settings → Environment Variables, then redeploy.</p>
      )}
      {hasEnv && (
        <p>Client initialised. We’ll add database tables and forms in the next phase.</p>
      )}
    </main>
  );
}
