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
  const [authed, setAuthed] = React.useState<boolean | null>(null);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    if (authed !== true) return;
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
  }, [authed]);

  if (authed === null) return <main style={{ padding: 20 }}>Checking login…</main>;
  if (!authed)
    return (
      <main style={{ padding: 20 }}>
        <h1>🧭 Admin — Walkthrough Submissions</h1>
        <p>You must <a href="/login">log in</a> to view submissions.</p>
      </main>
    );

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
    </main>
  );
}
