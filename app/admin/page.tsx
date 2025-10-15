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
  const [email, setEmail] = React.useState<string | null>(null);

  // data
  const [rows, setRows] = React.useState<Row[]>([]);
  const [stores, setStores] = React.useState<string[]>([]);

  // ui state
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [storeFilter, setStoreFilter] = React.useState<string>("ALL");
  const [search, setSearch] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = React.useState<string>(() => new Date().toISOString().slice(0, 10));

  // auth watcher
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s);
      setEmail(s?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // load stores (membership) + initial data
  React.useEffect(() => {
    if (authed !== true || !email) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // load user's stores from membership table
        const { data: sm, error: smErr } = await supabase
          .from("store_members")
          .select("store")
          .eq("email", email);
        if (smErr) throw smErr;

        const myStores = Array.from(new Set((sm ?? []).map((x: any) => x.store))).filter(Boolean) as string[];
        setStores(myStores);
        if (storeFilter === "ALL" && myStores.length) {
          setStoreFilter(myStores[0]); // default to first store
        }

        // fetch submissions (RLS already restricts to member stores)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, email]);

  // derived filtering
  const filtered = rows.filter((r) => {
    // date
    const d = new Date(r.created_at).toISOString().slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;

    // store
    if (storeFilter !== "ALL" && r.store !== storeFilter) return false;

    // search
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.store ?? "").toLowerCase().includes(q) ||
      (r.user_email ?? "").toLowerCase().includes(q)
    );
  });

  // quick totals
  const totals = filtered.reduce(
    (acc, r) => {
      acc.count += 1;
      acc.walk += r.section_total || 0;
      acc.service += r.service_total || 0;
      acc.predicted += r.predicted || 0;
      return acc;
    },
    { count: 0, walk: 0, service: 0, predicted: 0 }
  );

  function downloadCSV() {
    const headers = [
      "id",
      "created_at",
      "store",
      "user_email",
      "section_total",
      "adt",
      "extreme_lates",
      "sbr",
      "service_total",
      "predicted",
    ];
    const csv = [
      headers.join(","),
      ...filtered.map((r) =>
        [
          r.id,
          r.created_at,
          r.store ?? "",
          r.user_email ?? "",
          r.section_total,
          r.adt ?? "",
          r.extreme_lates ?? "",
          r.sbr ?? "",
          r.service_total,
          r.predicted,
        ]
          .map((v) => String(v).replaceAll('"', '""'))
          .map((v) => `"${v}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = "walkthrough_submissions.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
  }

  if (authed === null) return <main style={{ padding: 20 }}>Checking login…</main>;
  if (!authed)
    return (
      <main style={{ padding: 20 }}>
        <h1>🧭 Admin — Walkthrough Submissions</h1>
        <p>
          You must <a href="/login">log in</a> to view submissions.
        </p>
      </main>
    );

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, marginBottom: 10 }}>🧭 Admin — Walkthrough Submissions</h1>

      {/* Controls */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          display: "grid",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 4 }}>
            Store
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              style={{ padding: 8, minWidth: 160 }}
            >
              <option value="ALL">All (RLS applies)</option>
              {stores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ padding: 8 }}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            To
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ padding: 8 }}
            />
          </label>

          <label style={{ display: "grid", gap: 4, flex: 1, minWidth: 240 }}>
            Search (store or email)
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. downpatrick or alice@company.com"
              style={{ padding: 8 }}
            />
          </label>

          <button onClick={downloadCSV} style={btn()}>
            ⬇️ Download CSV ({filtered.length})
          </button>
        </div>

        {/* Totals row */}
        <div
          style={{
            fontSize: 14,
            color: "#374151",
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span>
            <strong>{filtered.length}</strong> results
          </span>
          <span>
            Walkthrough avg:{" "}
            <strong>
              {filtered.length ? (totals.walk / filtered.length).toFixed(1) : "-"}
            </strong>
            /75
          </span>
          <span>
            Service avg:{" "}
            <strong>
              {filtered.length ? (totals.service / filtered.length).toFixed(1) : "-"}
            </strong>
            /25
          </span>
          <span>
            Predicted avg:{" "}
            <strong>
              {filtered.length ? (totals.predicted / filtered.length).toFixed(1) : "-"}
            </strong>
            /100
          </span>
        </div>
      </div>

      {/* Table */}
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
                  "Email",
                  "Walkthrough (75)",
                  "ADT",
                  "XLates%",
                  "SBR%",
                  "Service (25)",
                  "Predicted (100)",
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
function btn(): React.CSSProperties {
  return {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "white",
    cursor: "pointer",
    fontWeight: 600,
  };
}
