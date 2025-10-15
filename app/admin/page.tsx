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
  user_email: string | null;
  section_total: number;
  adt: number | null;
  extreme_lates: number | null;
  sbr: number | null;
  service_total: number;
  predicted: number;
};

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
          .select("id,created_at,store,user_email,section_total,adt,extreme_lates,sbr,service_total,predicted")
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

  const allStores = React.useMemo(() => {
    return Array.from(new Set(rows.map(r => r.store).filter(Boolean))) as string[];
  }, [rows]);

  const filtered = rows.filter((r) => {
    const d = new Date(r.created_at).toISOString().slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;

    if (storeFilter !== "ALL" && r.store !== storeFilter) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (r.store ?? "").toLowerCase().includes(q) || (r.user_email ?? "").toLowerCase().includes(q);
  });

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, marginBottom: 10 }}>🧭 Admin — Walkthrough Submissions</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label>
          Store&nbsp;
          <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} style={{ padding: 8, minWidth: 160 }}>
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
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: 8 }} />
        </label>

        <label>
          To&nbsp;
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: 8 }} />
        </label>

        <label style={{ flex: 1, minWidth: 220 }}>
          Search&nbsp;
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="store or email" style={{ padding: 8, width: "100%" }} />
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
                {["Date/Time","Store","Email","Walkthrough (75)","ADT","XLates%","SBR%","Service (25)","Predicted (100)"].map((h) => (
                  <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8, whiteSpace: "nowrap", background: "#fafafa" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={td()}>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={td()}>{r.store ?? "-"}</td>
                  <td style={td()}>{r.user_email ?? "-"}</td>
                  <td style={td()}>{r.section_total}</td>
                  <td style={td()}>{r.adt ?? "-"}</td>
                  <td style={td()}>{r.extreme_lates ?? "-"}</td>
                  <td style={td()}>{r.sbr ?? "-"}</td>
                  <td style={td()}>{r.service_total}</td>
                  <td style={{ ...td(), fontWeight: 700 }}>{r.predicted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function td(): React.CSSProperties {
  return { borderBottom: "1px solid #eee", padding: 8, whiteSpace: "nowrap" };
}
