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
  const [details, setDetails] = React.useState<any>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const loc = typeof window !== "undefined" ? window.location.href : "";
        const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        const code = params.get("code");
        const accessToken = params.get("access_token"); // older flows sometimes send this

        setDetails({ href: loc, codePresent: !!code, accessTokenPresent: !!accessToken });

        if (!code && !accessToken) {
          setStatus("No auth code or access token found in the URL.");
          return;
        }

        // New GoTrue v2 flow (recommended)
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus(`Login failed: ${error.message}`);
            setDetails((d: any) => ({ ...d, exchangeError: error.message }));
            return;
          }
          setStatus("Success! Redirecting…");
          setTimeout(() => router.replace("/"), 600); // change to "/admin" if you prefer
          return;
        }

        // Fallback: if access_token is present (some providers)
        if (accessToken) {
          // supabase-js doesn’t accept raw access_token to set session; but auth state may already be set
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setStatus("Success! Redirecting…");
            setTimeout(() => router.replace("/"), 600);
          } else {
            setStatus("Could not establish session from access token.");
          }
          return;
        }
      } catch (e: any) {
        setStatus(`Error: ${e?.message || "Unknown error"}`);
        setDetails((d: any) => ({ ...d, exception: e?.stack || String(e) }));
      }
    })();
  }, [router]);

  return (
    <main style={{ maxWidth: 600, margin: "40px auto", background: "white", padding: 24, borderRadius: 12 }}>
      <h1>Authenticating…</h1>
      <p>{status}</p>
      {/* Debug panel you can read if something goes wrong */}
      {details && (
        <pre style={{ marginTop: 12, fontSize: 12, background: "#f6f8fb", padding: 12, borderRadius: 8, overflowX: "auto" }}>
{JSON.stringify(details, null, 2)}
        </pre>
      )}
    </main>
  );
}
