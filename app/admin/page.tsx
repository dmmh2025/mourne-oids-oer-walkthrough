"use client";
export const dynamic = "force-dynamic";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(url, anon);

type Row = {
  id: string;
  created_at: string;
  store: string | null;
  user_name: string | null;     // 👈 now using user_name
  section_total: number;        // /75
  adt: number | null;           // minutes
  extreme_lates: number | null; // per 1000
  sbr: number | null;           // %
  service_total: number;        // /25
  predicted: number;            // /100
};

// Stars from % bands
function starsFromPercent(p: number) {
  if (p >= 90) return 5;
  if (p >= 80) return 4;
  if (p >= 70) return 3;
  if (p >= 60) return 2;
  if (p >= 50) return 1;
  return 0;
}

export default function AdminPage() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [storeFilter, setStoreFilter] = React.useState<string>("ALL");
  const [search, setSearch] = React.useState("");

  const [dateFrom, setDateFrom] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = React.useState(() => new Date().toISOString().slice(0, 10));

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("walkthrough_submissions")
          .select(
            "id,created_at,store,user_name,section_total,adt,extreme_lates,sbr,service_total,predicted"
          )
          .order("created_at", { ascending: false })
          .limit(1000);
        if (error) throw error;
        setRows((data as Row[]) ?? []);
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allStores = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.store).filter(Boolean))) as string[],
    [rows]
  );

  const filtered = rows.filter((r) => {
    const d = new Date(r.created_at).toISOString().slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    if (storeFilter !== "ALL" && r.store !== storeFilter) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.store ?? "").toLowerCase().includes(q) ||
      (r.user_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      {/* Header with Back button */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            textDecoration: "none",
            background: "white",
            boxShadow: "0 2px 6px rgba(0,0,0,.06)",
            fontWeight: 600,
          }}
          aria-label="Back to Home"
        >
          <span style={{ fontSize: 18 }}>←</span> Back to Home
        </a>

        <h1 style={{ margin: 0, fontSize: 22 }}>Admin — Walkthrough Submissions</h1>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label>
          Store&nbsp;
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            style={{ padding: 8, minWidth: 160 }}
          >
            <option value="ALL">All stores</option>
            {allStores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label>
          From&nbsp;
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: 8 }}
          />
        </label>

        <label>
          To&nbsp;
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: 8 }}
          />
        </label>

        <label style={{ flex: 1, minWidth: 220 }}>
          Search&nbsp;
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="store or name"
            style={{ padding: 8, width: "100%" }}
          />
        </label>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {!loading && !error && filtered.length === 0 && <p>No submissions match your filter.</p>}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  "Date/Time",
                  "Store",
                  "Name",              // 👈 header changed
                  "Walkthrough (75)",
                  "ADT",
                  "XLates/1000",
                  "SBR%",
                  "Service (25)",
                  "Predicted (100)",
                  "Stars",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #ddd",
                      padding: 8,
                      whiteSpace: "nowrap",
                      background: "#fafafa",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const stars = starsFromPercent(r.predicted);
                return (
                  <tr key={r.id}>
                    <td style={td()}>{new Date(r.created_at).toLocaleString()}</td>
                    <td style={td()}>{r.store ?? "-"}</td>
                    <td style={td()}>{r.user_name ?? "-"}</td>
                    <td style={td()}>{r.section_total}</td>
                    <td style={td()}>{r.adt ?? "-"}</td>
                    <td style={td()}>{r.extreme_lates ?? "-"}</td>
                    <td style={td()}>{r.sbr ?? "-"}</td>
                    <td style={td()}>{r.service_total}</td>
                    <td style={{ ...td(), fontWeight: 700 }}>{r.predicted}</td>
                    <td style={{ ...td(), fontFamily: "system-ui, Segoe UI, Apple Color Emoji" }}>
                      {"★".repeat(stars)}
                      {"☆".repeat(5 - stars)} ({stars})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Legend */}
          <div style={{ marginTop: 10, color: "#6b7280", fontSize: 13 }}>
            90%+ = 5★ • 80–89.99% = 4★ • 70–79.99% = 3★ • 60–69.99% = 2★ • 50–59.99% = 1★ • &lt;50% = 0★
          </div>
        </div>
      )}
    </main>
  );
}

function td(): React.CSSProperties {
  return { borderBottom: "1px solid #eee", padding: 8, whiteSpace: "nowrap" };
}
