"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

export default function WalkthroughPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  // form fields
  const [store, setStore] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [sectionTotal, setSectionTotal] = useState(0);
  const [adt, setAdt] = useState<string | number>("");
  const [extremeLates, setExtremeLates] = useState<string | number>("");
  const [sbr, setSbr] = useState<string | number>("");
  const [serviceTotal, setServiceTotal] = useState(0);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authed === null) return <main style={{ padding: 20 }}>Checking login…</main>;
  if (!authed)
    return (
      <main style={{ padding: 20 }}>
        <h1>🍕 Mourne-oids OER Walkthrough</h1>
        <p>You must <a href="/login">log in</a> to submit a walkthrough.</p>
      </main>
    );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!store) return setMessage("❌ Please choose/enter a Store.");

    setLoading(true);
    try {
      const totalPredicted =
        Number(sectionTotal || 0) + Number(serviceTotal || 0);

      // get user JWT for API
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sections: {}, // (we’ll wire the full checklist later)
          section_total: Number(sectionTotal || 0),
          adt: adt === "" ? "" : Number(adt),
          extreme_lates: extremeLates === "" ? "" : Number(extremeLates),
          sbr: sbr === "" ? "" : Number(sbr),
          service_total: Number(serviceTotal || 0),
          predicted: totalPredicted,
          store,
          user_email: userEmail || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save");
      setMessage(`✅ Saved (ID: ${json.id})`);
    } catch (err: any) {
      setMessage(`❌ ${err.message || "Error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 26, marginBottom: 12 }}>🍕 Mourne-oids OER Walkthrough</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          Store
          <input
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder="Downpatrick / Kilkeel / Newcastle"
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          Your email (for receipt)
          <input
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="you@company.com"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label>
          Walkthrough Total (0–75)
          <input
            type="number"
            value={sectionTotal}
            onChange={(e) => setSectionTotal(Number(e.target.value))}
            placeholder="e.g. 60"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <label>
            ADT (mins)
            <input
              type="number"
              step="0.1"
              value={adt as number | string}
              onChange={(e) => setAdt(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 24.2"
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            Extreme Lates %
            <input
              type="number"
              step="0.1"
              value={extremeLates as number | string}
              onChange={(e) => setExtremeLates(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 1.3"
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            SBR %
            <input
              type="number"
              step="0.1"
              value={sbr as number | string}
              onChange={(e) => setSbr(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 78"
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
        </div>

        <label>
          Service Points (0–25)
          <input
            type="number"
            value={serviceTotal}
            onChange={(e) => setServiceTotal(Number(e.target.value))}
            placeholder="e.g. 20"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
        >
          {loading ? "Saving…" : "Save to Supabase"}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: 12, fontWeight: 600, color: message.startsWith("✅") ? "green" : "crimson" }}>
          {message}
        </p>
      )}
    </main>
  );
}
