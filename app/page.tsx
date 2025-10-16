"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/supabaseClient";

const STORES = ["Downpatrick", "Kilkeel", "Newcastle"] as const;

type Item = { done: boolean };
type Section = { items: Item[] };
type Row = { store: string; items: Section[]; updated_at?: string };

function calcPct(items: Section[] | null | undefined) {
  if (!items) return 0;
  const flat = items.flatMap((s) => s.items || []);
  const total = flat.length || 0;
  const done = flat.filter((i) => i?.done).length;
  return total ? Math.round((done / total) * 100) : 0;
}

export default function HomePage() {
  const [rows, setRows] = useState<Record<string, Row>>({});

  useEffect(() => {
    (async () => {
      const sb = supabase!;
      const { data, error } = await sb.from("deep_clean_submissions").select("*");
      if (!error && Array.isArray(data)) {
        const map: Record<string, Row> = {};
        for (const r of data as any[]) map[r.store] = r;
        setRows(map);
      }
    })();
  }, []);

  return (
    <main>
      {/* Banner */}
      {/* Banner */}
<div
  style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "12px 0",
    background: "#fff",
    borderBottom: "3px solid #006491", // thin Domino’s blue bottom border
  }}
>
  <img
    src="/mourneoids_forms_header_1600x400.png"
    alt="Mourne-oids Header Banner"
    style={{
      maxWidth: "90%",
      height: "auto",
      display: "block",
    }}
  />
</div>


      <section style={{ padding: 24, display: "grid", gap: 16 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Mourne-oids Tools</h1>
        <p style={{ color: "var(--muted)", marginBottom: 12 }}>
          Choose a section to get started.
        </p>

        {/* Main buttons */}
        <div style={{ display: "grid", gap: 14, maxWidth: 400 }}>
          <a href="/walkthrough">
            <button className="brand" style={{ width: "100%", fontSize: 16 }}>
              Daily OER Walkthrough
            </button>
          </a>

          <a href="/deep-clean">
            <button className="brand" style={{ width: "100%", fontSize: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Autumn Deep Clean
              <span style={{
                background: "#fff",
                color: "#006491",
                fontWeight: 600,
                padding: "2px 10px",
                borderRadius: 999,
                fontSize: 13,
                border: "1px solid #006491",
              }}>
                {overallPct(rows)}%
              </span>
            </button>
          </a>

          <a href="/admin">
            <button style={{ width: "100%", fontSize: 16 }}>Admin Dashboard</button>
          </a>
        </div>
      </section>
    </main>
  );
}

function overallPct(rows: Record<string, Row>) {
  const vals = Object.values(rows);
  if (!vals.length) return 0;
  const pcts = vals.map((r) => calcPct(r.items));
  const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  return avg || 0;
}
