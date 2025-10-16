"use client";

import * as React from "react";
import Script from "next/script";
import { createClient } from "@supabase/supabase-js";

// ---------- Types ----------
type Item = {
  key: string;
  label: string;
  pts?: number | null;
  details?: string[] | null;
  checked?: boolean;
  photos?: string[];
};
type SectionPayload = {
  key: string;
  title?: string;
  max: number;
  mode: "normal" | "all_or_nothing";
  items: Item[];
};
type Submission = {
  id: string | number;
  created_at: string;
  store: string | null;
  user_name: string | null;
  section_total: number | null;
  service_total: number | null;
  predicted: number | null;
  adt: number | null;
  sbr: number | null;
  extreme_lates: number | null;
  sections: SectionPayload[];
};

// ---------- Supabase ----------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

// ---------- Helpers ----------
const fmt = (n: number | null | undefined) =>
  typeof n === "number" && !Number.isNaN(n) ? n.toFixed(Number.isInteger(n) ? 0 : 2) : "—";
const starsForPercent = (p: number) =>
  p >= 90 ? 5 : p >= 80 ? 4 : p >= 70 ? 3 : p >= 60 ? 2 : p >= 50 ? 1 : 0;

function toArray<T = any>(v: any): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v == null) return [];
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p as T[];
      if (p && typeof p === "object") return Object.values(p) as T[];
      return [];
    } catch {
      return [];
    }
  }
  if (typeof v === "object") return Object.values(v) as T[];
  return [];
}

function computeSectionScore(sec: SectionPayload): number {
  const mode = (sec.mode as any) === "all_or_nothing" ? "all_or_nothing" : "normal";
  const max = typeof sec.max === "number" ? sec.max : 0;
  const items = toArray<Item>(sec.items);
  if (mode === "all_or_nothing") return items.every((i) => !!i.checked) ? max : 0;
  const raw = items.reduce((s, i) => (i?.checked ? s + (i?.pts || 0) : s), 0);
  return Math.min(raw, max);
}

// ---------- Tiny SVG charts ----------
function Sparkline({ points, width = 220, height = 64 }: { points: number[]; width?: number; height?: number }) {
  if (!points.length) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const norm = points.map((v) => (max === min ? 0.5 : (v - min) / (max - min)));
  const step = width / Math.max(1, points.length - 1);
  const d = norm.map((n, i) => `${i === 0 ? "M" : "L"} ${i * step} ${height - n * height}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={`0,${height} ${width},${height}`} fill="none" stroke="#e5e7eb" strokeWidth="1" />
      <path d={d} fill="none" stroke="#0ea5e9" strokeWidth="2" />
    </svg>
  );
}

function BarChart({
  labels,
  values,
  width = 480,
  height = 180,
}: {
  labels: string[];
  values: number[]; // 0..1
  width?: number;
  height?: number;
}) {
  const pad = 24;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const gap = 8;
  const barW = Math.max(6, innerW / Math.max(1, values.length) - gap);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <line x1={pad} y1={pad} x2={pad} y2={pad + innerH} stroke="#e5e7eb" />
      <line x1={pad} y1={pad + innerH} x2={pad + innerW} y2={pad + innerH} stroke="#e5e7eb" />
      {values.map((v, i) => {
        const x = pad + i * (barW + gap) + gap / 2;
        const h = innerH * Math.max(0, Math.min(1, v));
        const y = pad + innerH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} fill="#0ea5e9" opacity={0.85} />
            <text x={x + barW / 2} y={pad + innerH + 12} textAnchor="middle" fontSize="10" fill="#64748b">
              {labels[i]}
            </text>
          </g>
        );
      })}
      <text x={pad - 6} y={pad + 6} textAnchor="end" fontSize="10" fill="#94a3b8">100%</text>
      <text x={pad - 6} y={pad + innerH} textAnchor="end" fontSize="10" fill="#94a3b8">0%</text>
    </svg>
  );
}

// ---------- Admin Page ----------
export default function AdminPage() {
  const [rows, setRows] = React.useState<Submission[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // Filters: date range + store
  const todayISO = new Date().toISOString().slice(0, 10);
  const thirtyAgoISO = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = React.useState(thirtyAgoISO);
  const [toDate, setToDate] = React.useState(todayISO);
  const [storeFilter, setStoreFilter] = React.useState<string>("All");

  // Table sort
  const [sortKey, setSortKey] = React.useState<"created_at" | "store" | "user_name" | "service" | "walk" | "total" | "stars">("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const fromISO = new Date(fromDate + "T00:00:00.000Z").toISOString();
        const toISO = new Date(toDate + "T23:59:59.999Z").toISOString();

        let query = supabase
          .from("walkthrough_submissions")
          .select("id, created_at, store, user_name, section_total, service_total, predicted, adt, sbr, extreme_lates, sections")
          .gte("created_at", fromISO)
          .lte("created_at", toISO)
          .order("created_at", { ascending: false })
          .limit(1000);

        if (storeFilter !== "All") query = query.eq("store", storeFilter);

        const { data, error } = await query;
        if (error) throw error;

        const normalized: Submission[] = (data as any[]).map((r) => {
          const sections = toArray<any>(r.sections).map((s) => ({
            ...s,
            items: toArray<any>(s?.items).map((i) => ({
              ...i,
              photos: toArray<string>(i?.photos),
            })),
          }));
          return {
            ...r,
            predicted: typeof r.predicted === "number" ? r.predicted : (Number(r.section_total) || 0) + (Number(r.service_total) || 0),
            sections,
          };
        });

        setRows(normalized);
      } catch (e: any) {
        setErr(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [fromDate, toDate, storeFilter]);

  const allStores = React.useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add((r.store || "Unknown").trim()));
    return ["All", ...Array.from(set).sort()];
  }, [rows]);

  // ---- Per-store analytics ----
  type StoreStats = {
    store: string;
    count: number;
    avgWalk: number;
    avgService: number;
    avgPred: number;
    best?: Submission;
    worst?: Submission;
    secLabels: string[];
    secAvgPoints: number[];
    secMax: number[];
    trendPred: number[];
  };

  const storesAnalytics: StoreStats[] = React.useMemo(() => {
    const byStore = new Map<string, Submission[]>();
    rows.forEach((r) => {
      const key = (r.store || "Unknown").trim();
      if (!byStore.has(key)) byStore.set(key, []);
      byStore.get(key)!.push(r);
    });

    const result: StoreStats[] = [];
    for (const [store, subs] of byStore.entries()) {
      const count = subs.length;
      const avgWalk = subs.reduce((s, r) => s + (r.section_total || 0), 0) / Math.max(1, count);
      const avgService = subs.reduce((s, r) => s + (r.service_total || 0), 0) / Math.max(1, count);
      const avgPred = subs.reduce((s, r) => s + (r.predicted || 0), 0) / Math.max(1, count);

      const sorted = [...subs].sort((a, b) => (b.predicted || 0) - (a.predicted || 0));
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      const secMap = new Map<string, { total: number; max: number; n: number }>();
      subs.forEach((sub) => {
        toArray<SectionPayload>(sub.sections).forEach((sec) => {
          const pts = computeSectionScore(sec);
          const title = (sec.title || sec.key || "Section").toString();
          const entry = secMap.get(title) || { total: 0, max: Number(sec.max) || 0, n: 0 };
          entry.total += pts;
          entry.max = Number(sec.max) || entry.max || 0;
          entry.n += 1;
          secMap.set(title, entry);
        });
      });

      const secLabels = Array.from(secMap.keys());
      const secAvgPoints = secLabels.map((k) => secMap.get(k)!.total / Math.max(1, secMap.get(k)!.n));
      const secMax = secLabels.map((k) => secMap.get(k)!.max);

      const trendPred = [...subs]
        .sort((a, b) => new Date(a.created_at as any).getTime() - new Date(b.created_at as any).getTime())
        .map((s) => Number(s.predicted || 0));

      result.push({ store, count, avgWalk, avgService, avgPred, best, worst, secLabels, secAvgPoints, secMax, trendPred });
    }

    return result.sort((a, b) => b.avgPred - a.avgPred);
  }, [rows]);

  // ---- Sorted table data ----
  const tableRows = React.useMemo(() => {
    const list = [...rows];
    const getVal = (r: Submission) => {
      if (sortKey === "created_at") return new Date(r.created_at as any).getTime();
      if (sortKey === "store") return (r.store || "").toLowerCase();
      if (sortKey === "user_name") return (r.user_name || "").toLowerCase();
      if (sortKey === "service") return Number(r.service_total || 0);
      if (sortKey === "walk") return Number(r.section_total || 0);
      if (sortKey === "total") return Number(r.predicted || 0);
      if (sortKey === "stars") return starsForPercent(Number(r.predicted || 0));
      return 0;
    };
    list.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [rows, sortKey, sortDir]);

  const setSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "created_at" ? "desc" : "asc");
    }
  };

  const arrow = (key: typeof sortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <>
      {/* libs for zip + filesaver (still used by detail page, safe to keep loaded here too) */}
      <Script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js" strategy="afterInteractive" />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        {/* Banner + blue underline */}
        <div style={{ borderBottom: "4px solid #006491", marginBottom: 12, borderRadius: 12, overflow: "hidden", boxShadow: "0 6px 18px rgba(0,0,0,.06)" }}>
          <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
        </div>

        {/* Controls */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => (window.location.href = "/")}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 700, cursor: "pointer" }}
            >
              ← Back to Home
            </button>

            <h1 style={{ margin: 0, fontSize: 22 }}>Admin — Analytics & Submissions</h1>

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
                <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
                  {allStores.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {loading && <p style={{ color: "#64748b", margin: 0 }}>Loading…</p>}
          {err && <p style={{ color: "#7f1d1d", fontWeight: 700, margin: 0 }}>❌ {err}</p>}
        </div>

        {/* ===== COLLAPSIBLE STORE ANALYTICS ===== */}
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", padding: 12, marginBottom: 14 }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #eef2f7", paddingBottom: 8, marginBottom: 10 }}>
            <strong style={{ fontSize: 18 }}>Store Analytics</strong>
            <small style={{ color: "#64748b" }}>
              Period: {fromDate} → {toDate} {storeFilter !== "All" ? `• Store: ${storeFilter}` : ""}
            </small>
          </header>

          {storesAnalytics.length === 0 && <p style={{ margin: 0, color: "#6b7280" }}>No submissions for the selected range.</p>}

          <div style={{ display: "grid", gap: 10 }}>
            {storesAnalytics.map((s) => {
              const stars = starsForPercent(s.avgPred);
              const sectionPercents = s.secAvgPoints.map((p, i) => (s.secMax[i] ? p / s.secMax[i] : 0));

              return (
                <details key={s.store} style={{ border: "1px solid #eef2f7", borderRadius: 12, overflow: "hidden", background: "white" }}>
                  <summary style={{ cursor: "pointer", listStyle: "none", padding: 12, background: "#f8fafc", display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 10, alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <strong style={{ fontSize: 16 }}>{s.store}</strong>
                      <Badge label="Avg Walk" value={`${fmt(s.avgWalk)}/75`} />
                      <Badge label="Avg Service" value={`${fmt(s.avgService)}/25`} />
                      <Badge label="Avg Predicted" value={`${fmt(s.avgPred)}/100`} strong />
                      <Badge label="Grade" value={`${"★".repeat(stars)}${"☆".repeat(5 - stars)} (${stars})`} />
                      <Badge label="Submissions" value={`${s.count}`} />
                    </div>
                    <div>
                      <div><span style={{ fontWeight: 700, color: "#065f46" }}>Best:</span> {s.best ? <><strong>{s.best.user_name || "Anon"}</strong> — {fmt(s.best.predicted)}/100</> : "—"}</div>
                      <div><span style={{ fontWeight: 700, color: "#7f1d1d" }}>Worst:</span> {s.worst ? <><strong>{s.worst.user_name || "Anon"}</strong> — {fmt(s.worst.predicted)}/100</> : "—"}</div>
                    </div>
                    <div style={{ display: "grid", justifyItems: "end" }}>
                      <Sparkline points={s.trendPred} />
                      <small style={{ color: "#64748b" }}>
                        Trend: {s.trendPred.length ? `${fmt(s.trendPred[0])} → ${fmt(s.trendPred.at(-1)!)}` : "—"}
                      </small>
                    </div>
                  </summary>

                  {/* expanded content */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12, padding: 12 }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={th()}>Section</th>
                            <th style={th()}>Avg Points</th>
                            <th style={th()}>Max</th>
                            <th style={th()}>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.secLabels.map((lab, i) => {
                            const avg = s.secAvgPoints[i] || 0;
                            const max = s.secMax[i] || 0;
                            const pct = max ? Math.round((avg / max) * 100) : 0;
                            return (
                              <tr key={lab}>
                                <td style={td()}>{lab}</td>
                                <td style={td()}>{fmt(avg)}</td>
                                <td style={td()}>{max}</td>
                                <td style={td()}>{pct}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                      <BarChart labels={s.secLabels.map((l) => l.replace(" & ", "/").split(" ")[0])} values={sectionPercents} />
                      <small style={{ color: "#64748b" }}>Section performance (avg % of max)</small>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        {/* ===== SORTABLE TABLE OF SUBMISSIONS ===== */}
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", padding: 12 }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #eef2f7", paddingBottom: 8, marginBottom: 10 }}>
            <strong style={{ fontSize: 18 }}>Submissions Table ({tableRows.length})</strong>
            <small style={{ color: "#64748b" }}>Click a row to view the full report</small>
          </header>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th()} onClick={() => setSort("created_at")}>Date{arrow("created_at")}</th>
                  <th style={th()} onClick={() => setSort("store")}>Store{arrow("store")}</th>
                  <th style={th()} onClick={() => setSort("user_name")}>By{arrow("user_name")}</th>
                  <th style={th()} onClick={() => setSort("service")}>Service /25{arrow("service")}</th>
                  <th style={th()} onClick={() => setSort("walk")}>Walkthrough /75{arrow("walk")}</th>
                  <th style={th()} onClick={() => setSort("total")}>Total /100{arrow("total")}</th>
                  <th style={th()} onClick={() => setSort("stars")}>Stars{arrow("stars")}</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => {
                  const total = Number(r.predicted || 0);
                  const stars = starsForPercent(total);
                  return (
                    <tr
                      key={`${r.id}-${r.created_at}`}
                      onClick={() => (window.location.href = `/admin/submission/${encodeURIComponent(String(r.id))}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={td()}>{new Date(r.created_at).toLocaleString()}</td>
                      <td style={td()}>{r.store || "Unknown"}</td>
                      <td style={td()}>{r.user_name || "Anon"}</td>
                      <td style={td()}>{fmt(r.service_total)}</td>
                      <td style={td()}>{fmt(r.section_total)}</td>
                      <td style={td()}>{fmt(total)}</td>
                      <td style={td()}>{`${"★".repeat(stars)}${"☆".repeat(5 - stars)} (${stars})`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <style jsx global>{`
        @media (max-width: 640px) {
          main { padding: 12px; }
          table th, table td { font-size: 12px; }
        }
        table th, table td { border-bottom: 1px solid #f1f5f9; padding: 8px 10px; text-align: left; }
        details + details { margin-top: 8px; }
        summary::-webkit-details-marker { display: none; }
      `}</style>
    </>
  );
}

// ---------- UI bits ----------
function Badge(props: { label: string; value: string; strong?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: "#f1f5f9",
        border: "1px solid #e5e7eb",
        color: "#111827",
        fontWeight: props.strong ? 800 : 600,
      }}
    >
      <span style={{ opacity: 0.7 }}>{props.label}</span>
      <span>{props.value}</span>
    </span>
  );
}

const th = (): React.CSSProperties => ({
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 13,
  color: "#475569",
  userSelect: "none" as React.CSSProperties["userSelect"],
  cursor: "pointer",
});

const td = (): React.CSSProperties => ({
  padding: "8px 10px",
  fontSize: 13,
  color: "#111827",
});
