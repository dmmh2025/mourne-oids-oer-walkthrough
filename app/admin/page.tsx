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

// Make sure we always have arrays (handles null, stringified JSON, or objects)
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
  if (typeof v === "object") {
    return Object.values(v) as T[];
  }
  return [];
}

function computeSectionScore(sec: SectionPayload): number {
  const mode = (sec.mode as any) === "all_or_nothing" ? "all_or_nothing" : "normal";
  const max = typeof sec.max === "number" ? sec.max : 0;
  const items = toArray<Item>(sec.items);

  if (mode === "all_or_nothing") {
    const allChecked = items.every((i) => !!i.checked);
    return allChecked ? max : 0;
  }
  const raw = items.reduce((s, i) => (i?.checked ? s + (i?.pts || 0) : s), 0);
  return Math.min(raw, max);
}

function collectPhotos(sub: Submission) {
  const urls: string[] = [];
  toArray<SectionPayload>(sub.sections).forEach((s) =>
    toArray<Item>(s.items).forEach((i) => toArray<string>(i.photos).forEach((u) => urls.push(u)))
  );
  return urls;
}

// ---------- Tiny SVG charts ----------
function Sparkline({
  points,
  width = 220,
  height = 64,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
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
  values, // 0..1
  width = 480,
  height = 180,
}: {
  labels: string[];
  values: number[];
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
      {/* axes */}
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

      {/* y-axis labels */}
      <text x={pad - 6} y={pad + 6} textAnchor="end" fontSize="10" fill="#94a3b8">
        100%
      </text>
      <text x={pad - 6} y={pad + innerH} textAnchor="end" fontSize="10" fill="#94a3b8">
        0%
      </text>
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

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);

  // Fetch whenever filters change
  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const fromISO = new Date(fromDate + "T00:00:00.000Z").toISOString();
        const toISO = new Date(toDate + "T23:59:59.999Z").toISOString();

        let query = supabase
          .from("walkthrough_submissions")
          .select(
            "id, created_at, store, user_name, section_total, service_total, predicted, adt, sbr, extreme_lates, sections"
          )
          .gte("created_at", fromISO)
          .lte("created_at", toISO)
          .order("created_at", { ascending: false })
          .limit(1000);

        if (storeFilter !== "All") {
          query = query.eq("store", storeFilter);
        }

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
            predicted:
              typeof r.predicted === "number"
                ? r.predicted
                : (Number(r.section_total) || 0) + (Number(r.service_total) || 0),
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

  // Unique stores (for dropdown)
  const allStores = React.useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add((r.store || "Unknown").trim()));
    return ["All", ...Array.from(set).sort()];
  }, [rows]);

  // ---- Build per-store analytics ----
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
    trendDates: string[];
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

      // best/worst by predicted
      const sorted = [...subs].sort((a, b) => (b.predicted || 0) - (a.predicted || 0));
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      // section averages
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

      // trend (type-safe)
      const trend = [...subs]
        .sort(
          (a, b) =>
            new Date(a.created_at as any).getTime() -
            new Date(b.created_at as any).getTime()
        )
        .map((s) => ({
          d: String(s.created_at),
          p: Number(s.predicted || 0),
        }));

      const trendDates = trend.map((t) => t.d);
      const trendPred = trend.map((t) => t.p);

      result.push({
        store,
        count,
        avgWalk,
        avgService,
        avgPred,
        best,
        worst,
        secLabels,
        secAvgPoints,
        secMax,
        trendDates,
        trendPred,
      });
    }

    return result.sort((a, b) => b.avgPred - a.avgPred);
  }, [rows]);

  // ---------- CSV Exports ----------
  function csvEscape(v: any) {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }
  function download(name: string, text: string) {
    // @ts-ignore
    const saveAs = (window as any).saveAs;
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    if (saveAs) saveAs(blob, name);
    else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  function exportStoreSummaryCSV() {
    const headers = [
      "Store","Submissions",
      "AvgWalk","AvgService","AvgPredicted","Grade",
      "Best_Name","Best_Predicted","Best_Date",
      "Worst_Name","Worst_Predicted","Worst_Date"
    ];
    const lines = [headers.join(",")];

    storesAnalytics.forEach((s) => {
      const grade = starsForPercent(s.avgPred);
      lines.push(
        [
          csvEscape(s.store),
          s.count,
          fmt(s.avgWalk),
          fmt(s.avgService),
          fmt(s.avgPred),
          grade,
          csvEscape(s.best?.user_name || "—"),
          fmt(s.best?.predicted || 0),
          s.best ? new Date(s.best.created_at).toLocaleString() : "—",
          csvEscape(s.worst?.user_name || "—"),
          fmt(s.worst?.predicted || 0),
          s.worst ? new Date(s.worst.created_at).toLocaleString() : "—",
        ].join(",")
      );
    });

    download(`oer_store_summary_${fromDate}_to_${toDate}.csv`, lines.join("\n"));
  }

  function exportSectionAveragesCSV() {
    const headers = ["Store","Section","AvgPoints","Max","Percent"];
    const lines = [headers.join(",")];

    storesAnalytics.forEach((s) => {
      s.secLabels.forEach((lab, i) => {
        const avg = s.secAvgPoints[i] || 0;
        const max = s.secMax[i] || 0;
        const pct = max ? (avg / max) * 100 : 0;
        lines.push([csvEscape(s.store), csvEscape(lab), fmt(avg), max, fmt(pct)].join(","));
      });
    });

    download(`oer_section_averages_${fromDate}_to_${toDate}.csv`, lines.join("\n"));
  }

  function exportRawSubmissionsCSV() {
    const headers = [
      "ID","CreatedAt","Store","Name","Walkthrough","Service","Predicted","ADT","SBR","ExtremesPer1000"
    ];
    const lines = [headers.join(",")];

    rows.forEach((r) => {
      lines.push([
        r.id, r.created_at,
        csvEscape(r.store || ""),
        csvEscape(r.user_name || ""),
        fmt(r.section_total), fmt(r.service_total), fmt(r.predicted),
        fmt(r.adt), fmt(r.sbr), fmt(r.extreme_lates),
      ].join(","));
    });

    download(`oer_raw_submissions_${fromDate}_to_${toDate}.csv`, lines.join("\n"));
  }

  // Download .zip of photos (per submission)
  async function downloadAllPhotos(sub: Submission) {
    const urls = collectPhotos(sub);
    if (urls.length === 0) return alert("No photos attached to this submission.");
    // @ts-ignore
    const JSZip = (window as any).JSZip;
    // @ts-ignore
    const saveAs = (window as any).saveAs;
    if (!JSZip || !saveAs) {
      alert("Downloader not ready yet — please wait a second and try again.");
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder(
      `${(sub.store || "Unknown").replace(/[^a-z0-9_-]/gi, "_")}-${new Date(sub.created_at)
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-")}`
    );

    const failures: string[] = [];
    await Promise.all(
      urls.map(async (url, idx) => {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const extGuess = (url.split(".").pop() || "jpg").split("?")[0].slice(0, 5);
          folder!.file(`photo-${String(idx + 1).padStart(2, "0")}.${extGuess}`, blob);
        } catch {
          failures.push(url);
        }
      })
    );

    const zipBlob = await zip.generateAsync({ type: "blob" });
    // @ts-ignore
    (window as any).saveAs(
      zipBlob,
      `OER-photos-${(sub.store || "Unknown").replace(/[^a-z0-9_-]/gi, "_")}-${new Date(sub.created_at)
        .toISOString()
        .slice(0, 10)}.zip`
    );
    if (failures.length) alert(`Downloaded with ${failures.length} failed file(s).`);
  }

  // Visible submissions after store filter
  const visibleRows = React.useMemo(() => {
    if (storeFilter === "All") return rows;
    return rows.filter((r) => (r.store || "").trim() === storeFilter);
  }, [rows, storeFilter]);

  return (
    <>
      {/* libs for zip + filesaver */}
      <Script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js" strategy="afterInteractive" />

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
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                >
                  {allStores.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              {/* CSV exports */}
              <button type="button" onClick={exportStoreSummaryCSV} style={pillBtn()}>
                ⬇ Store Summary CSV
              </button>
              <button type="button" onClick={exportSectionAveragesCSV} style={pillBtn()}>
                ⬇ Section Averages CSV
              </button>
              <button type="button" onClick={exportRawSubmissionsCSV} style={pillBtn()}>
                ⬇ Raw Submissions CSV
              </button>
            </div>
          </div>

          {loading && <p style={{ color: "#64748b", margin: 0 }}>Loading…</p>}
          {err && (
            <p style={{ color: "#7f1d1d", fontWeight: 700, margin: 0 }}>
              ❌ {err}
            </p>
          )}
        </div>

        {/* ===== ANALYTICS ===== */}
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "white",
            padding: 12,
            marginBottom: 14,
          }}
        >
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
            <strong style={{ fontSize: 18 }}>Store Analytics</strong>
            <small style={{ color: "#64748b" }}>
              Period: {fromDate} → {toDate} {storeFilter !== "All" ? `• Store: ${storeFilter}` : ""}
            </small>
          </header>

          {storesAnalytics.length === 0 && <p style={{ margin: 0, color: "#6b7280" }}>No submissions for the selected range.</p>}

          <div style={{ display: "grid", gap: 12 }}>
            {storesAnalytics.map((s) => {
              const stars = starsForPercent(s.avgPred);
              const sectionPercents = s.secAvgPoints.map((p, i) => (s.secMax[i] ? p / s.secMax[i] : 0));
              return (
                <article key={s.store} style={{ border: "1px solid #eef2f7", borderRadius: 12, overflow: "hidden" }}>
                  {/* Store header row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr 1fr",
                      gap: 10,
                      padding: 12,
                      background: "#f8fafc",
                      borderBottom: "1px solid #eef2f7",
                    }}
                  >
                    {/* Summary cards */}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <strong style={{ fontSize: 16 }}>{s.store}</strong>
                      <Badge label="Avg Walk" value={`${fmt(s.avgWalk)}/75`} />
                      <Badge label="Avg Service" value={`${fmt(s.avgService)}/25`} />
                      <Badge label="Avg Predicted" value={`${fmt(s.avgPred)}/100`} strong />
                      <Badge label="Grade" value={`${"★".repeat(stars)}${"☆".repeat(5 - stars)} (${stars})`} />
                      <Badge label="Submissions" value={`${s.count}`} />
                    </div>

                    {/* Best / Worst */}
                    <div style={{ display: "grid", gap: 6 }}>
                      <div>
                        <span style={{ fontWeight: 700, color: "#065f46" }}>Best:</span>{" "}
                        {s.best ? (
                          <>
                            <strong>{s.best.user_name || "Anon"}</strong> — {fmt(s.best.predicted)}/100{" "}
                            <span style={{ color: "#64748b" }}>({new Date(s.best.created_at).toLocaleString()})</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </div>
                      <div>
                        <span style={{ fontWeight: 700, color: "#7f1d1d" }}>Worst:</span>{" "}
                        {s.worst ? (
                          <>
                            <strong>{s.worst.user_name || "Anon"}</strong> — {fmt(s.worst.predicted)}/100{" "}
                            <span style={{ color: "#64748b" }}>({new Date(s.worst.created_at).toLocaleString()})</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>

                    {/* Trend sparkline */}
                    <div style={{ display: "grid", justifyItems: "end" }}>
                      <Sparkline points={s.trendPred} />
                      <small style={{ color: "#64748b" }}>
                        Trend: {s.trendPred.length ? `${fmt(s.trendPred[0])} → ${fmt(s.trendPred.at(-1)!)}` : "—"}
                      </small>
                    </div>
                  </div>

                  {/* Section averages table + bar chart */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12, padding: 12 }}>
                    {/* Table */}
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

                    {/* Bar chart */}
                    <div style={{ display: "grid", gap: 6 }}>
                      <BarChart
                        labels={s.secLabels.map((l) => l.replace(" & ", "/").split(" ")[0])}
                        values={sectionPercents}
                      />
                      <small style={{ color: "#64748b" }}>Section performance (avg % of max)</small>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ===== SUBMISSIONS LIST ===== */}
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
            <strong style={{ fontSize: 18 }}>Submissions ({visibleRows.length})</strong>
            <small style={{ color: "#64748b" }}>
              Inline photo galleries • Click thumbnail to view • “Download all photos” per submission
            </small>
          </header>

          <div style={{ display: "grid", gap: 14 }}>
            {visibleRows.map((sub) => {
              const predicted = sub.predicted ?? (sub.section_total ?? 0) + (sub.service_total ?? 0);
              const stars = starsForPercent(predicted);
              const allPhotos = collectPhotos(sub);
              return (
                <article
                  key={`${sub.id}-${sub.created_at}`}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    background: "white",
                    padding: 12,
                  }}
                >
                  {/* Top row summary */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 18 }}>
                          {sub.store || "Unknown"} — {sub.user_name || "Anon"}
                        </strong>
                        <span style={{ color: "#6b7280" }}>
                          {new Date(sub.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Badge label="Walkthrough" value={`${fmt(sub.section_total)}/75`} />
                        <Badge label="Service" value={`${fmt(sub.service_total)}/25`} />
                        <Badge label="Predicted" value={`${fmt(predicted)}/100`} strong />
                        <Badge label="Grade" value={`${"★".repeat(stars)}${"☆".repeat(5 - stars)} (${stars})`} />
                        <Badge label="ADT" value={fmt(sub.adt)} />
                        <Badge label="SBR%" value={fmt(sub.sbr)} />
                        <Badge label="Ext/1000" value={fmt(sub.extreme_lates)} />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => downloadAllPhotos(sub)}
                        disabled={allPhotos.length === 0}
                        title={allPhotos.length ? `Download ${allPhotos.length} photo(s)` : "No photos"}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #004e73",
                          background: allPhotos.length ? "#006491" : "#9ca3af",
                          color: "white",
                          fontWeight: 700,
                          cursor: allPhotos.length ? "pointer" : "not-allowed",
                        }}
                      >
                        ⬇ Download all photos ({allPhotos.length})
                      </button>
                    </div>
                  </div>

                  {/* Sections with inline photo galleries */}
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    {toArray<SectionPayload>(sub.sections).map((sec) => {
                      const secPhotos = toArray<Item>(sec.items).flatMap((i) => toArray<string>(i.photos));
                      const title = (sec.title || sec.key || "Section").toString();
                      const max = Number(sec.max) || 0;
                      const mode = (sec.mode as any) === "all_or_nothing" ? "All-or-nothing" : "Weighted";

                      return (
                        <section key={`${title}-${max}-${mode}`} style={{ border: "1px solid #eef2f7", borderRadius: 10 }}>
                          <header
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "8px 10px",
                              borderBottom: "1px solid #eef2f7",
                              background: "#f8fafc",
                              borderRadius: "10px 10px 0 0",
                            }}
                          >
                            <strong>{title}</strong>
                            <small style={{ color: "#64748b" }}>
                              Max {max} • {mode}
                              {secPhotos.length ? ` • ${secPhotos.length} photo${secPhotos.length > 1 ? "s" : ""}` : ""}
                            </small>
                          </header>

                          <div style={{ padding: 10, display: "grid", gap: 8 }}>
                            {toArray<Item>(sec.items).map((it, idx) => {
                              const ptsText = it && typeof it.pts === "number" ? ` (${it.pts} pts)` : "";
                              const photos = toArray<string>(it?.photos);
                              const label = (it?.label || it?.key || `Item ${idx + 1}`).toString();
                              const checked = !!it?.checked;

                              return (
                                <div
                                  key={`${label}-${idx}`}
                                  style={{
                                    border: "1px solid #f1f5f9",
                                    borderRadius: 10,
                                    padding: 10,
                                    background: "#fff",
                                  }}
                                >
                                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                                    <span title={checked ? "Checked" : "Not checked"}>
                                      {checked ? "✅" : "⬜️"}
                                    </span>
                                    <div style={{ fontWeight: 600 }}>
                                      {label}
                                      {ptsText}
                                    </div>
                                  </div>

                                  {/* Gallery */}
                                  {photos.length > 0 && (
                                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                      {photos.map((url, pidx) => (
                                        <button
                                          key={`${url}-${pidx}`}
                                          type="button"
                                          onClick={() => setLightboxUrl(url)}
                                          style={{
                                            border: "1px solid #e5e7eb",
                                            padding: 0,
                                            borderRadius: 8,
                                            overflow: "hidden",
                                            cursor: "pointer",
                                            background: "transparent",
                                          }}
                                          title="Click to view"
                                        >
                                          <img
                                            src={url}
                                            alt="attachment"
                                            style={{ width: 96, height: 96, objectFit: "cover", display: "block" }}
                                          />
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      {/* Lightbox modal */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.7)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: "95vw",
              maxHeight: "90vh",
              borderRadius: 12,
              overflow: "hidden",
              background: "#000",
              boxShadow: "0 10px 30px rgba(0,0,0,.4)",
            }}
          >
            <img
              src={lightboxUrl}
              alt="full"
              style={{ maxWidth: "95vw", maxHeight: "90vh", objectFit: "contain", display: "block" }}
            />
            <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 8 }}>
              <a
                href={lightboxUrl}
                download
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  fontWeight: 700,
                }}
              >
                ⬇ Download
              </a>
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile tweaks */}
      <style jsx global>{`
        @media (max-width: 640px) {
          main { padding: 12px; }
          article { padding: 10px !important; }
        }
        table th, table td { border-bottom: 1px solid #f1f5f9; }
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
const th = () => ({ textAlign: "left" as const, padding: "8px 10px", fontSize: 12, color: "#64748b" });
const td = () => ({ padding: "8px 10px", fontSize: 13, color: "#111827" });
const pillBtn = (): React.CSSProperties => ({
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "white",
  fontWeight: 700,
  cursor: "pointer",
});
