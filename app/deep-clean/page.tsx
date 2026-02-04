"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/supabaseClient";

type Item = { label: string; done: boolean; by: string; photos: any[] };
type Section = { title: string; items: Item[] };
type Row = { store: string; items: Section[]; updated_at?: string };

const STORES = ["Ballynahinch", "Downpatrick", "Kilkeel", "Newcastle"] as const;

function calcPct(items: Section[] | null | undefined) {
  if (!items) return 0;
  const flat = items.flatMap((s) => s.items || []);
  const total = flat.length || 0;
  const done = flat.filter((i) => i?.done).length;
  return total ? Math.round((done / total) * 100) : 0;
}

export default function DeepCleanHome() {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = supabase!;
      const { data, error } = await sb.from("deep_clean_submissions").select("*");
      if (!error && Array.isArray(data)) {
        const map: Record<string, Row> = {};
        for (const r of data as any[]) map[r.store] = r;
        setRows(map);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <div className="banner">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <section style={{ marginTop: 16, padding: 16 }}>
        <header style={{ display: "grid", gap: 4 }}>
          <strong style={{ fontSize: 22 }}>Deep Clean</strong>
          <small style={{ color: "var(--muted)" }}>
            Select a store to open its checklist. Progress updates as teams work.
          </small>
        </header>

        {loading ? (
          <div className="badge" style={{ marginTop: 12 }}>Loading…</div>
        ) : (
          <div style={{ display: "grid", gap: 12, maxWidth: 520, marginTop: 12 }}>
            {STORES.map((s) => {
              const row = rows[s] as Row | undefined;
              const pct = calcPct(row?.items);
              const updated = row?.updated_at ? new Date(row.updated_at) : null;

              return (
                <a key={s} href={`/deep-clean/${s.toLowerCase()}`} style={{ textDecoration: "none" }}>

                  <div
                    style={{
                      border: "1px solid var(--softline)",
                      borderRadius: 12,
                      padding: 14,
                      background: "#fff",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 18 }}>{s}</strong>
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>
                        {updated ? `Updated ${timeSince(updated)} ago` : "No saves yet"}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{pct}% complete</div>
                    <div
                      style={{
                        height: 10,
                        background: "#eef2f5",
                        borderRadius: 999,
                        border: "1px solid var(--softline)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: "var(--brand, #006491)",
                          transition: "width .35s ease",
                        }}
                      />
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <a href="/">
            <button>⬅ Back to Home</button>
          </a>
        </div>
      </section>
      <style jsx>{`
  .banner {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 8px 0 12px;
    background: #ffffff;
    border-bottom: 3px solid #006491;
    box-shadow: 0 4px 8px rgba(0,0,0,0.05);
  }

  .banner img {
    max-width: 92%;
    height: auto;
    display: block;
  }
`}</style>
    </main>
  );
}

function timeSince(d: Date) {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
