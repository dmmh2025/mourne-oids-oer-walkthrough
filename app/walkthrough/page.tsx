"use client";
export const dynamic = "force-dynamic"; // prevents prerendering at build

import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export default function WalkthroughPage() {
  const [store, setStore] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [sectionTotal, setSectionTotal] = useState(0);
  const [adt, setAdt] = useState("");
  const [extremeLates, setExtremeLates] = useState("");
  const [sbr, setSbr] = useState("");
  const [serviceTotal, setServiceTotal] = useState(0);
  const [predicted, setPredicted] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!supabaseUrl || !supabaseAnon) {
      setMessage("❌ Missing Supabase environment variables.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseAnon);
      const totalPredicted = Number(sectionTotal) + Number(serviceTotal);
      setPredicted(totalPredicted);

      const { error } = await supabase.from("walkthrough_submissions").insert([
        {
          store,
          user_email: userEmail,
          section_total: sectionTotal,
          adt,
          extreme_lates: extremeLates,
          sbr,
          service_total: serviceTotal,
          predicted: totalPredicted,
        },
      ]);

      if (error) throw error;
      setMessage("✅ Walkthrough submitted successfully!");
    } catch (err: any) {
      console.error(err);
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>
        🍕 Mourne-oids OER Walkthrough
      </h1>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <label>
          Store:
          <input
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder="Downpatrick, Kilkeel, Newcastle"
            required
            style={{ width: "100%", padding: 6 }}
          />
        </label>

        <label>
          Your Email:
          <input
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="you@mourne-oids.com"
            required
            style={{ width: "100%", padding: 6 }}
          />
        </label>

        <label>
          Walkthrough Total (75):
          <input
            type="number"
            value={sectionTotal}
            onChange={(e) => setSectionTotal(Number(e.target.value))}
            placeholder="Out of 75"
            style={{ width: "100%", padding: 6 }}
          />
        </label>

        <label>
          ADT:
          <input
            value={adt}
            onChange={(e) => setAdt(e.target.value)}
            placeholder="Minutes"
            style={{ width: "100%", padding: 6 }}
          />
        </label>

        <label>
          Extreme Lates %:
          <input
            value={extremeLates}
            onChange={(e) => setExtremeLates(e.target.value)}
            placeholder="%"
            style={{ width: "100%", padding: 6 }}
          />
        </label>

        <label>
          SBR %:
          <input
            value={sbr}
            onChange={(e) => setSbr(e.target.value)}
            placeholder="%"
            style={{ width: "100%", padding: 6 }}
          />
        </label>

        <label>
          Service Points (25):
          <input
            type="number"
            value={serviceTotal}
            onChange={(e) => setServiceTotal(Number(e.target.value))}
            placeholder="Out of 25"
            style={{ width: "100%", padding: 6 }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 10,
            fontWeight: 600,
            background: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {loading ? "Submitting..." : "Submit Walkthrough"}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: 20, fontWeight: 500, color: message.includes("❌") ? "red" : "green" }}>
          {message}
        </p>
      )}
    </main>
  );
}
