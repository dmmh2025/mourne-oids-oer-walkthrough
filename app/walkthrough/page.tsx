"use client";
export const dynamic = "force-dynamic";

import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

export default function WalkthroughPage() {
  const [store, setStore] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [sectionTotal, setSectionTotal] = useState(0);
  const [adt, setAdt] = useState<string | number>("");
  const [extremeLates, setExtremeLates] = useState<string | number>("");
  const [sbr, setSbr] = useState<string | number>("");
  const [serviceTotal, setServiceTotal] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const predicted = Number(sectionTotal || 0) + Number(serviceTotal || 0);

      const { error } = await supabase.from("walkthrough_submissions").insert([
        {
          sections: {}, // keep payload shape consistent
          section_total: Number(sectionTotal || 0),
          adt: adt === "" ? null : Number(adt),
          extreme_lates: extremeLates === "" ? null : Number(extremeLates),
          sbr: sbr === "" ? null : Number(sbr),
          service_total: Number(serviceTotal || 0),
          predicted,
          store,
          user_email: userEmail || null,
        },
      ]);

      if (error) throw error;
      setMessage("✅ Saved!");
    } catch (err: any) {
      setMessage(`❌ ${err.message || "Failed to save"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 26, marginBottom: 12 }}>🍕 OER Walkthrough</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          Store
          <input
            value={store}
            onChange={(e) => setStore(e.target.value)}
            required
            placeholder="Downpatrick / Kilkeel / Newcastle"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label>
          Your Email (optional)
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

        <button type="submit" disabled={loading} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}>
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
