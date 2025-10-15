"use client";
import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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

  React.useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("walkthrough_submissions")
          .select("id,created_at,store,user_email,section_total,adt,extreme_lates,sbr,service_total,predicted")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        setRows((data as Row[]) ?? []);
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function downloadCSV() {
    const headers = [
      "id","created_at","store","user_email",
      "section_total","adt","extreme_lates","sbr",
      "service_total","predicted"
    ];
    const csv = [
      headers.join(","),
      ...rows.map(r => [
        r.id, r.created_at, r.store ?? "", r.user_email ?? "",
        r.section_total, r.adt ?? "", r.extreme_lates ?? "", r.sbr ?? "",
        r.service_total, r.predicted
      ].map(v => String(v).replaceAll('"','""')).map(v => `"${v}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "walkthrough_submissions.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26 }}>🧭 Admin — Walkthrough Submissions</h1>
      <p style={{ marginTop: 0 }}>
        Latest 100 entries. <button onClick={downloadCSV} style={{ marginLeft: 8, padding: "6px 10px" }}>Download CSV</button>
      </p>
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
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.store || "-"}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{r.user_email || "-"}</td>
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
      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
        Note: For MVP we allow anon read. We’ll switch to proper auth & per-store access later.
      </p>
    </main>
  );
}
