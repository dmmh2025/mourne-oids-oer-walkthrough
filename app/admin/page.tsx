"use client";

import * as React from "react";
import Script from "next/script";
import { createClient } from "@supabase/supabase-js";

type Item = {
  key: string;
  label: string;
  pts?: number | null;
  details?: string[] | null;
  checked?: boolean;
  photos?: string[]; // public URLs
};
type SectionPayload = {
  key: string;
  title: string;
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

// Small helpers
const fmt = (n: number | null | undefined) =>
  typeof n === "number" && !Number.isNaN(n) ? n.toFixed(Number.isInteger(n) ? 0 : 2) : "—";

function starsForPercent(p: number) {
  if (p >= 90) return 5;
  if (p >= 80) return 4;
  if (p >= 70) return 3;
  if (p >= 60) return 2;
  if (p >= 50) return 1;
  return 0;
}

export default function AdminPage() {
  const [rows, setRows] = React.useState<Submission[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [sinceDays, setSinceDays] = React.useState(30);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const sinceISO = new Date(Date.now() - sinceDays * 24 * 3600 * 1000).toISOString();
        const { data, error } = await supabase
          .from("walkthrough_submissions")
          .select(
            "id, created_at, store, user_name, section_total, service_total, predicted, adt, sbr, extreme_lates, sections"
          )
          .gte("created_at", sinceISO)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        // Normalize photos arrays
        const normalized: Submission[] =
          (data as any[]).map((r) => ({
            ...r,
            sections: (r.sections || []).map((s: any) => ({
              ...s,
              items: (s.items || []).map((i: any) => ({
                ...i,
                photos: Array.isArray(i?.photos) ? i.photos : [],
              })),
            })),
          })) || [];
        setRows(normalized);
      } catch (e: any) {
        setErr(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [sinceDays]);

  // Collect all photo URLs for a submission
  function collectPhotos(sub: Submission) {
    const urls: string[] = [];
    for (const sec of sub.sections || []) {
      for (const it of sec.items || []) {
        if (it.photos && it.photos.length) urls.push(...it.photos);
      }
    }
    return urls;
  }

  // Download all photos as a ZIP (client-only via CDN libs)
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
      `${(sub.store || "Unknown").replace(/[^a-z0-9_-]/gi, "_")}-${new Date(sub.created_at).toISOString().slice(0, 19).replace(/[:T]/g, "-")}`
    );

    // Fetch all images as blobs and add to zip
    const failures: string[] = [];
    await Promise.all(
      urls.map(async (url, idx) => {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const extGuess = (url.split(".").pop() || "jpg").split("?")[0].slice(0, 5);
          folder.file(`photo-${String(idx + 1).padStart(2, "0")}.${extGuess}`, blob);
        } catch {
          failures.push(url);
        }
      })
    );

    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(
      zipBlob,
      `OER-photos-${(sub.store || "Unknown").replace(/[^a-z0-9_-]/gi, "_")}-${new Date(sub.created_at)
        .toISOString()
        .slice(0, 10)}.zip`
    );

    if (failures.length) {
      alert(`Downloaded with ${failures.length} failed file(s).`);
    }
  }

  return (
    <>
      {/* JSZip + FileSaver for in-browser .zip downloads */}
      <Script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js" strategy="afterInteractive" />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
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

        {/* Header */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
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

          <h1 style={{ margin: 0, fontSize: 22 }}>Admin — Submissions</h1>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Show last
              <select
                value={sinceDays}
                onChange={(e) => setSinceDays(Number(e.target.value))}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>1 year</option>
              </select>
            </label>
          </div>
        </div>

        {/* Status */}
        {loading && <p style={{ color: "#64748b" }}>Loading submissions…</p>}
        {err && (
          <p style={{ color: "#7f1d1d", fontWeight: 700 }}>
            ❌ {err}
          </p>
        )}
        {!loading && !err && rows.length === 0 && <p>No submissions found in this period.</p>}

        {/* List */}
        <div style={{ display: "grid", gap: 14 }}>
          {rows.map((sub) => {
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
                  {sub.sections?.map((sec) => {
                    // flatten photos count per section
                    const secPhotos = sec.items.flatMap((i) => i.photos || []);
                    return (
                      <section key={sec.key} style={{ border: "1px solid #eef2f7", borderRadius: 10 }}>
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
                          <strong>{sec.title}</strong>
                          <small style={{ color: "#64748b" }}>
                            Max {sec.max} • {sec.mode === "all_or_nothing" ? "All-or-nothing" : "Weighted"}
                            {secPhotos.length ? ` • ${secPhotos.length} photo${secPhotos.length > 1 ? "s" : ""}` : ""}
                          </small>
                        </header>

                        <div style={{ padding: 10, display: "grid", gap: 8 }}>
                          {sec.items.map((it) => {
                            const ptsText =
                              sec.mode === "normal" && typeof it.pts === "number" ? ` (${it.pts} pts)` : "";
                            const photos = it.photos || [];
                            return (
                              <div
                                key={it.key}
                                style={{
                                  border: "1px solid #f1f5f9",
                                  borderRadius: 10,
                                  padding: 10,
                                  background: "#fff",
                                }}
                              >
                                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                                  <span title={it.checked ? "Checked" : "Not checked"}>
                                    {it.checked ? "✅" : "⬜️"}
                                  </span>
                                  <div style={{ fontWeight: 600 }}>{it.label}{ptsText}</div>
                                </div>

                                {/* Gallery */}
                                {photos.length > 0 && (
                                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {photos.map((url, idx) => (
                                      <button
                                        key={`${url}-${idx}`}
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
      `}</style>
    </>
  );
}

// Badges
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
