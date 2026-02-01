"use client";

import * as React from "react";

// ---------- OSA Standards status types ----------
type OsaStatusRow = {
  store: string;
  walkthrough_type: "pre_open" | "handover";
  completed_at: string;
  completed_by: string;
  is_admin_override?: boolean;
};
type OsaStatusResponse = {
  ok: boolean;
  data: OsaStatusRow[];
  error?: string;
};

// ---------- STORES (includes Ballynahinch) ----------
const STORES = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"] as const;
type Store = (typeof STORES)[number];
const STORE_OPTIONS: Array<"All" | Store> = ["All", ...STORES];

// ---------- Helpers ----------
function typeLabel(t: OsaStatusRow["walkthrough_type"]) {
  return t === "pre_open" ? "Pre-Open" : "Handover";
}
function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
function sortDescByCompletedAt(a: OsaStatusRow, b: OsaStatusRow) {
  return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
}

export default function AdminPage() {
  // Filters
  const todayISO = new Date().toISOString().slice(0, 10);
  const thirtyAgoISO = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = React.useState(thirtyAgoISO);
  const [toDate, setToDate] = React.useState(todayISO);
  const [storeFilter, setStoreFilter] = React.useState<"All" | Store>("All");

  // Data state
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<OsaStatusRow[]>([]);

  async function load() {
    try {
      setErr(null);
      setLoading(true);

      const qs = new URLSearchParams({
        from: fromDate,
        to: toDate,
        store: storeFilter,
      });

      const res = await fetch(`/api/osa-standards/status?${qs.toString()}`, { cache: "no-store" });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || res.statusText);
      }

      const json = (await res.json()) as OsaStatusResponse;
      if (!json.ok) throw new Error(json.error || "Failed to load completion log");

      const data = Array.isArray(json.data) ? json.data : [];
      setRows(data.sort(sortDescByCompletedAt));
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // Load whenever filters change
  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, storeFilter]);

  // Optional auto-refresh every 60s
  React.useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, storeFilter]);

  return (
    <>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        {/* Banner + blue underline */}
        <div
          style={{
            borderBottom: "4px solid #006491",
            marginBottom: 12,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 6px 18px rgba(0,0,0,.06)",
          }}
        >
          <img
            src="/mourneoids_forms_header_1600x400.png"
            alt="Mourne-oids Header Banner"
            style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
          />
        </div>

        {/* Controls */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => (window.location.href = "/")}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ← Back to Home
            </button>

            <h1 style={{ margin: 0, fontSize: 22 }}>Admin — OSA Standards Completion</h1>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                From
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                To
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Store
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value as "All" | Store)}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                >
                  {STORE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={load}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          {loading && <p style={{ color: "#64748b", margin: 0 }}>Loading…</p>}
          {err && <p style={{ color: "#7f1d1d", fontWeight: 700, margin: 0 }}>❌ {err}</p>}
        </div>

        {/* ===== COMPLETION LOG TABLE ===== */}
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", padding: 12 }}>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #eef2f7",
              paddingBottom: 8,
              marginBottom: 10,
            }}
          >
            <strong style={{ fontSize: 18 }}>Completion Log ({rows.length})</strong>
            <small style={{ color: "#64748b" }}>
              Records whether the Pre-Open and Handover walkthroughs were completed, by whom, and when.
            </small>
          </header>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thPlain()}>Store</th>
                  <th style={thPlain()}>Type</th>
                  <th style={thPlain()}>Completed at</th>
                  <th style={thPlain()}>Completed by</th>
                  <th style={thPlain()}>Override</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${r.store}-${r.walkthrough_type}-${r.completed_at}-${idx}`}>
                    <td style={tdPlain()}>{r.store}</td>
                    <td style={tdPlain()}>{typeLabel(r.walkthrough_type)}</td>
                    <td style={tdPlain()}>{fmtDateTime(r.completed_at)}</td>
                    <td style={tdPlain()}>{r.completed_by || "—"}</td>
                    <td style={tdPlain()}>{r.is_admin_override ? "Yes" : "No"}</td>
                  </tr>
                ))}

                {!loading && !err && rows.length === 0 && (
                  <tr>
                    <td style={tdPlain()} colSpan={5}>
                      No completions found for the selected range / store.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <style jsx global>{`
        @media (max-width: 640px) {
          main {
            padding: 12px;
          }
          table th,
          table td {
            font-size: 12px;
          }
        }
        table th,
        table td {
          border-bottom: 1px solid #f1f5f9;
          padding: 8px 10px;
          text-align: left;
        }
        table tbody tr:hover {
          background: #f8fafc;
        }
      `}</style>
    </>
  );
}

const thPlain = (): React.CSSProperties => ({
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 13,
  color: "#475569",
  userSelect: "none" as React.CSSProperties["userSelect"],
});

const tdPlain = (): React.CSSProperties => ({
  padding: "8px 10px",
  fontSize: 13,
  color: "#111827",
});
