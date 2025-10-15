"use client";
export const dynamic = "force-dynamic"; // ⛔️ stop prerendering at build
import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export default function AdminPage() {
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Lazy-create client on the client only (avoids build-time env issues)
    if (!url || !anon) {
      setError("Missing Supabase env vars"); 
      setLoading(false);
      return;
    }
    const supabase = createClient(url, anon);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("walkthrough_submissions")
          .select("id,created_at,store,user_email,section_total,adt,extreme_lates,sbr,service_total,predicted")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        setRows(data ?? []);
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26 }}>🧭 Admin — Walkthrough Submissions</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {!loading && !error && rows.length === 0 && <p>No submissions yet.</p>}
      {!loading && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Date/Time","Store","Email","Walkthrough (75)","ADT","XLates%","SBR%","Service (25)","Predicted (100)"].map(h => (
                  <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.store ?? "-"}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.user_email ?? "-"}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.section_total}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.adt ?? "-"}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.extreme_lates ?? "-"}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.sbr ?? "-"}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.service_total}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, fontWeight: 600 }}>{r.predicted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
