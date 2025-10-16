"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

const fmt = (n: number | null | undefined) =>
  typeof n === "number" && !Number.isNaN(n)
    ? n.toFixed(Number.isInteger(n) ? 0 : 2)
    : "—";

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

export default function SubmissionDetailPage() {
  const params = useParams() as { id?: string };
  const id = params?.id ? decodeURIComponent(params.id) : "";
  const [sub, setSub] = React.useState<Submission | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [lightbox, setLightbox] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabase
          .from("walkthrough_submissions")
          .select("*")
          .eq("id", id)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Submission not found");

        const sections = toArray<any>(data.sections).map((s) => ({
          ...s,
          items: toArray<any>(s?.items).map((i) => ({
            ...i,
            photos: toArray<string>(i?.photos),
          })),
        }));

        const normalized: Submission = {
          ...data,
          predicted:
            typeof data.predicted === "number"
              ? data.predicted
              : (Number(data.section_total) || 0) +
                (Number(data.service_total) || 0),
          sections,
        };

        setSub(normalized);
      } catch (e: any) {
        setErr(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (!id) return <p style={{ padding: 16 }}>Missing submission id.</p>;

  return (
    <>
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
        {/* Banner */}
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
            style={{
              width: "100%",
              maxHeight: 200,
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <button
            type="button"
            onClick={() => (window.location.href = "/admin")}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ← Back to Admin
          </button>
          <h1 style={{ margin: 0, fontSize: 20 }}>Submission Detail</h1>
        </div>

        {loading && <p style={{ color: "#64748b" }}>Loading…</p>}
        {err && <p style={{ color: "#7f1d1d", fontWeight: 700 }}>❌ {err}</p>}

        {sub && (
          <article
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "white",
              padding: 12,
            }}
          >
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "baseline",
                }}
              >
                <strong style={{ fontSize: 18 }}>
                  {sub.store || "Unknown"} — {sub.user_name || "Anon"}
                </strong>
                <span style={{ color: "#6b7280" }}>
                  {new Date(sub.created_at).toLocaleString()}
                </span>
              </div>

              {/* ✅ Badge Summary */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge
                  label="Walkthrough"
                  value={`${fmt(sub.section_total)}/75`}
                />
                <Badge label="Service" value={`${fmt(sub.service_total)}/25`} />
                <span style={{ fontWeight: 800 }}>
                  <Badge
                    label="Total"
                    value={`${fmt(sub.predicted || 0)}/100`}
                  />
                </span>
                <Badge
                  label="Stars"
                  value={`${"★".repeat(
                    starsForPercent(sub.predicted || 0)
                  )}${"☆".repeat(5 - starsForPercent(sub.predicted || 0))}`}
                />
                <Badge label="ADT" value={fmt(sub.adt)} />
                <Badge label="SBR%" value={fmt(sub.sbr)} />
                <Badge label="Ext/1000" value={fmt(sub.extreme_lates)} />
              </div>
            </div>

            {/* Sections */}
            <div style={{ display: "grid", gap: 10 }}>
              {toArray<SectionPayload>(sub.sections).map((sec, sidx) => {
                const title =
                  sec.title || sec.key || `Section ${sidx + 1}`.toString();
                const max = Number(sec.max) || 0;
                const mode =
                  (sec.mode as any) === "all_or_nothing"
                    ? "All-or-nothing"
                    : "Weighted";

                return (
                  <section
                    key={`${title}-${sidx}`}
                    style={{
                      border: "1px solid #eef2f7",
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    <header
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 10px",
                        borderBottom: "1px solid #eef2f7",
                        background: "#f8fafc",
                      }}
                    >
                      <strong>{title}</strong>
                      <small style={{ color: "#64748b" }}>
                        Max {max} • {mode}
                      </small>
                    </header>

                    <div style={{ padding: 10, display: "grid", gap: 8 }}>
                      {toArray<Item>(sec.items).map((it, iidx) => {
                        const label =
                          it?.label || it?.key || `Item ${iidx + 1}`.toString();
                        const ptsText =
                          it && typeof it.pts === "number"
                            ? ` (${it.pts} pts)`
                            : "";
                        const photos = toArray<string>(it?.photos);

                        return (
                          <div
                            key={`${label}-${iidx}`}
                            style={{
                              border: "1px solid #f1f5f9",
                              borderRadius: 10,
                              padding: 10,
                              background: "#fff",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "flex-start",
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                title={it.checked ? "Checked" : "Not checked"}
                              >
                                {it.checked ? "✅" : "⬜️"}
                              </span>
                              <div style={{ fontWeight: 600 }}>
                                {label}
                                {ptsText}
                              </div>
                            </div>

                            {photos.length > 0 && (
                              <div
                                style={{
                                  marginTop: 8,
                                  display: "flex",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                {photos.map((url, pidx) => (
                                  <button
                                    key={`${url}-${pidx}`}
                                    type="button"
                                    onClick={() => setLightbox(url)}
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
                                      style={{
                                        width: 96,
                                        height: 96,
                                        objectFit: "cover",
                                        display: "block",
                                      }}
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
        )}
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
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
              src={lightbox}
              alt="full"
              style={{
                maxWidth: "95vw",
                maxHeight: "90vh",
                objectFit: "contain",
                display: "block",
              }}
            />
            <button
              type="button"
              onClick={() => setLightbox(null)}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
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
      )}
    </>
  );
}

/* ✅ Simplified Badge Component */
function Badge(props: { label: string; value: string }) {
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
        fontWeight: 700,
      }}
    >
      <span style={{ opacity: 0.7 }}>{props.label}</span>
      <span>{props.value}</span>
    </span>
  );
}
