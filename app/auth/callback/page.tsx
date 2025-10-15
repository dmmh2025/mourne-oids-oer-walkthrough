"use client";
export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(url, anon);

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = React.useState("Signing you in…");

  React.useEffect(() => {
    (async () => {
      try {
        // Supabase sends ?code=... to your redirect URL
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (!code) {
          setStatus("No code found in URL.");
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus(`Login failed: ${error.message}`);
          return;
        }

        setStatus("Success! Redirecting…");
        // Go somewhere nice after login:
        router.replace("/"); // or "/walkthrough"
      } catch (e: any) {
        setStatus(`Error: ${e?.message || "Unknown error"}`);
      }
    })();
  }, [router]);

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
      <h1>Authenticating…</h1>
      <p>{status}</p>
    </main>
  );
}
