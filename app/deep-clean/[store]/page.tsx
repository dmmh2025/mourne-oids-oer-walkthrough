"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/supabaseClient";

type PhotoRef = { url: string; path: string };
type ItemState = { label: string; done: boolean; by: string; photos: PhotoRef[] };
type SectionState = { title: string; items: ItemState[] };

const RAW: { title: string; items: string[] }[] = [
  {
    title: "Front of House & CSR",
    items: [
      "Deep scrub entrance matting (inside/outside)",
      "Deck scrub & mop all customer area tiles",
      "Clean window ledges (inside/outside) and frames",
      "Wipe walls, skirting boards, doors, ledges",
      "Clean ceiling vents & lights",
      "Deep clean seating & tables",
      "Clear out and wipe down CSR cupboards & drawers",
      "Empty, clean and refil napkin dispenser",
      "Clean down all CSR surfaces",
      "Remove boxes, clean and sanitise boxes table",
      "Clean & sanitise computer screens, keyboards, phones, printers and just eat and uber eats terminals",
      "Clean down walls around CSR",
    ],
  },
  {
    title: "Kitchen",
    items: [
      "Deck scrub floors, pulling out the makeline and pushing back the cut table. Make sure to scrub under oven too.",
      "Clean down and sanitise all shelves (including under the shelves) and tables/benches (including under tables/benches)",
      "Empty out the makeline, remove all parts, hoover out, wash down and sanitise",
      "Remove makeline seals & wash. Wash down makeline doors and sanitise",
      "Replace all tubs (gf container, wrap tubs, tc tubs, tubs at end of makeline etc…) with new ones",
      "Cean table legs and feet",
      "Wash down and sanitise hand washing sink and saniflow",
      "Scrub and clean oven windows",
      "Scrub and clean chamber entrance and exits",
      "Scrub and clean down all outer surfaces of the oven including legs and wheels.",
      "Wash down and sanitise all walls.",
      "Wash down and sanitise all wall fittings (brush mop hooks, towel dispensers etc…)",
      "Empty, wash and sanitise the cut table, including where the boxes are stored.",
      "Wash out and sanitise all bins.",
    ],
  },
  {
    title: "Routing & Hot rack",
    items: [
      "Clean and wash dip containers",
      "Clean and wash any storage containers",
      "Wash and sanitise all parts of hot rack, including top and under each shelf.",
      "Clean computer screens and keyboards",
      "Wash down and sanitise all shelves",
    ],
  },
  {
    title: "Drinks fridge",
    items: ["Empty out and wash down", "Clean in and around fan", "Clean down door and seals"],
  },
  {
    title: "Walk in",
    items: [
      "Remove all shelving, wash down and dry",
      "Wash, sanitise and dry shelving legs",
      "Remove door flaps, wash and dry",
      "Clean around fan and remove any dust in fans",
      "Wash down and dry all walls and ceiling",
      "Wash down and dry door (inside/outside)",
      "Brush, deckscrub and mop floors.",
    ],
  },
  {
    title: "Back Areas",
    items: [
      "Wash and clean all shelving and dunnage racks",
      "Wash and sanitise all tables/surfaces including underneath",
      "Wash down all walls",
      "Wash all doors/ handles/ skirting boards",
    ],
  },
  {
    title: "Wash-Up room",
    items: [
      "Scrub sink drains & traps",
      "Clean under sinks & shelving",
      "Clean inside and outside washing machine",
      "Take everything off the shelves and storage areas and wash and sanitise",
      "Wash out all bins",
      "Clean under shelving",
      "Wash down all dunnage racks",
      "Clean down all walls",
      "Wash and sanitise mop sink",
      "Brush, deck scrub and mop floors",
    ],
  },
  {
    title: "Toilet",
    items: [
      "Bleach and scrub toilet bowl",
      "Clean and sanitise around the toilet including pipes and cistern",
      "Clean and sanitise all pipes and wall fittings",
      "Use glass/steel cleaner to clean the mirrors",
      "Wipe down all walls",
      "Brush, deck scrub and mop the floor",
    ],
  },
  {
    title: "External Areas",
    items: [
      "Sweep car park & delivery area",
      "Remove all branded rubbish",
      "Remove all weeds, dirt, cobwebs and dirt around bottom of the building, including around the shutter area",
      "Clean all signage",
      "Remove any decals with dog ears and order new ones",
      "Clean entrance around shop",
    ],
  },
];

function toInitialState(): SectionState[] {
  return RAW.map((s) => ({
    title: s.title,
    items: s.items.map((label) => ({ label, done: false, by: "", photos: [] })),
  }));
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function fmtSince(date?: Date) {
  if (!date) return "";
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function StoreDeepCleanPage() {
  const params = useParams();
  const storeParam = String(params?.store || "");
  const store = useMemo(() => {
    const s = storeParam.toLowerCase();
    if (s === "downpatrick") return "Downpatrick";
    if (s === "kilkeel") return "Kilkeel";
    if (s === "newcastle") return "Newcastle";
    return "";
  }, [storeParam]);

  const [sections, setSections] = useState<SectionState[]>(toInitialState());
  // track open/closed per section for smart collapse
  const [open, setOpen] = useState<boolean[]>(RAW.map(() => true));
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lightbox
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Derived progress
  const flat = sections.flatMap((s) => s.items);
  const total = flat.length;
  const done = flat.filter((i) => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Load existing for this store
  useEffect(() => {
    (async () => {
      if (!store) {
        setLoading(false);
        return;
      }
      const sb = supabase!;
      const { data, error } = await sb
        .from("deep_clean_submissions")
        .select("*")
        .eq("store", store)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error(error);
        setMsg("Could not load existing progress.");
      }
      if (data?.items) {
        setSections(data.items as SectionState[]);
        // auto-close fully complete sections
        const nextOpen = (data.items as SectionState[]).map((sec) =>
          sec.items.every((i) => i.done) ? false : true
        );
        setOpen(nextOpen);
      }
      setLoading(false);
    })();
  }, [store]);

  // Debounced auto-save on changes
  useEffect(() => {
    if (!store || loading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveProgress(true);
    }, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  function toggleSection(si: number, value?: boolean) {
    setOpen((prev) => {
      const next = [...prev];
      next[si] = typeof value === "boolean" ? value : !prev[si];
      return next;
    });
  }

  function setAll(openVal: boolean) {
    setOpen(RAW.map(() => openVal));
  }

  async function handlePhotoUpload(secIdx: number, itemIdx: number, files: FileList | null) {
    if (!files || !store) return;
    const sb = supabase!;
    const fileArr = Array.from(files);
    const uploaded: PhotoRef[] = [];

    for (let i = 0; i < fileArr.length; i++) {
      const f = fileArr[i];
      const path = `${slug(store)}/${Date.now()}_${slug(
        sections[secIdx].title
      )}_${slug(sections[secIdx].items[itemIdx].label)}_${i}_${f.name}`;
      const { error } = await sb.storage.from("deep-clean").upload(path, f, { upsert: false });
      if (error) {
        console.error(error);
        setMsg("Upload failed for one or more photos.");
        continue;
      }
      const { data: pub } = sb.storage.from("deep-clean").getPublicUrl(path);
      uploaded.push({ url: pub.publicUrl, path });
    }

    setSections((prev) => {
      const next = [...prev];
      next[secIdx] = { ...next[secIdx] };
      next[secIdx].items = [...next[secIdx].items];
      next[secIdx].items[itemIdx] = {
        ...next[secIdx].items[itemIdx],
        photos: [...next[secIdx].items[itemIdx].photos, ...uploaded],
      };
      return next;
    });
  }

  async function saveProgress(silent = false) {
    if (!store) {
      if (!silent) setMsg("Unknown store in URL.");
      return;
    }
    if (!silent) setSaving(true);
    const res = await fetch("/api/deep-clean/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store, sections }),
    });
    if (!silent) setSaving(false);

    if (!res.ok) {
      const t = await res.text();
      setMsg(`Save failed: ${t}`);
      return;
    }
    setLastSavedAt(new Date());
    if (!silent) setMsg("Saved!");
  }

  return (
    <main>
      <div className="banner">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      {/* Back buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          gap: 10,
          padding: "10px 16px",
        }}
      >
        <a href="/deep-clean">
          <button style={{ fontSize: 14 }}>⬅ Back to Stores</button>
        </a>
        <a href="/">
          <button style={{ fontSize: 14 }}>🏠 Home</button>
        </a>
      </div>

      <section style={{ padding: 16, marginBottom: 14 }}>
        <header style={{ display: "grid", gap: 4 }}>
          <strong style={{ fontSize: 22 }}>{store ? `${store} • Autumn Deep Clean` : "Autumn Deep Clean"}</strong>
          <small style={{ color: "var(--muted)" }}>
            Auto-saves as you work. {lastSavedAt ? `Saved ${fmtSince(lastSavedAt)}.` : "No recent save yet."}
          </small>
        </header>

        {/* Overall progress */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
            {done} of {total} tasks complete ({pct}%)
          </div>
          <div
            style={{
              height: 10,
              background: "#eef2f5",
              borderRadius: 999,
              border: "1px solid var(--softline)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: "var(--brand, #006491)",
                transition: "width .35s ease",
              }}
            />
          </div>
        </div>

        {/* Section expand/collapse controls */}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button onClick={() => setAll(true)}>Expand all</button>
          <button onClick={() => setAll(false)}>Collapse all</button>
        </div>

        {loading ? (
          <div className="badge" style={{ marginTop: 12 }}>
            Loading…
          </div>
        ) : !store ? (
          <div className="badge" style={{ marginTop: 12 }}>
            Unknown store. Go back and pick a store.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {/* Sections */}
            {sections.map((sec, si) => {
              const secTotal = sec.items.length;
              const secDone = sec.items.filter((i) => i.done).length;
              const secComplete = secDone === secTotal && secTotal > 0;

              return (
                <div key={sec.title} style={{ border: "1px solid var(--softline)", borderRadius: 12, overflow: "hidden" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: 12,
                      background: secComplete ? "rgba(0,128,0,.05)" : "#fff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong>{sec.title}</strong>
                      <span
                        className="badge"
                        style={{
                          fontSize: 12,
                          background: "#f3f4f6",
                          borderColor: "var(--softline)",
                        }}
                      >
                        {secDone}/{secTotal}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => toggleSection(si)} style={{ fontSize: 13 }}>
                        {open[si] ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  {open[si] && (
                    <div style={{ padding: 12, display: "grid", gap: 12, background: "#fff" }}>
                      {sec.items.map((it, ii) => (
                        <div
                          key={`${sec.title}-${ii}`}
                          style={{
                            border: "1px solid var(--softline)",
                            borderRadius: 12,
                            padding: 12,
                            background: it.done ? "rgba(0,100,145,.03)" : "#fff",
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <label style={{ display: "flex", gap: 10 }}>
                            <input
                              type="checkbox"
                              checked={it.done}
                              onChange={(e) =>
                                setSections((prev) => {
                                  const next = [...prev];
                                  next[si] = { ...next[si] };
                                  next[si].items = [...next[si].items];
                                  next[si].items[ii] = { ...next[si].items[ii], done: e.target.checked };
                                  // auto-collapse if a section becomes fully complete
                                  const allDone = next[si].items.every((x) => x.done);
                                  setOpen((prevOpen) => {
                                    const n = [...prevOpen];
                                    n[si] = allDone ? false : n[si];
                                    return n;
                                  });
                                  return next;
                                })
                              }
                            />
                            <span>{it.label}</span>
                          </label>

                          <div style={{ display: "grid", gap: 6 }}>
                            <label style={{ fontSize: 13, color: "var(--muted)" }}>Team member name</label>
                            <input
                              type="text"
                              placeholder="Your name…"
                              value={it.by}
                              onChange={(e) =>
                                setSections((prev) => {
                                  const next = [...prev];
                                  next[si] = { ...next[si] };
                                  next[si].items = [...next[si].items];
                                  next[si].items[ii] = { ...next[si].items[ii], by: e.target.value };
                                  return next;
                                })
                              }
                            />
                          </div>

                          <div style={{ display: "grid", gap: 6 }}>
                            <label style={{ fontSize: 13, color: "var(--muted)" }}>Upload photo(s)</label>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handlePhotoUpload(si, ii, e.target.files)}
                            />
                            {!!it.photos.length && (
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {it.photos.map((p, idx) => (
                                  <img
                                    key={idx}
                                    src={p.url}
                                    alt="proof"
                                    onClick={() => setLightbox(p.url)}
                                    style={{
                                      width: 84,
                                      height: 84,
                                      objectFit: "cover",
                                      borderRadius: 8,
                                      border: "1px solid var(--line)",
                                      cursor: "zoom-in",
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="brand" onClick={() => saveProgress(false)} disabled={saving}>
                {saving ? "Saving…" : "Save now"}
              </button>
              <a href="/deep-clean">
                <button>Change Store</button>
              </a>
              <a href="/">
                <button>Back to Home</button>
              </a>
            </div>

            {/* Save toast */}
            {lastSavedAt && (
              <div
                className="badge"
                style={{
                  background: "rgba(0,100,145,.06)",
                  borderColor: "var(--softline)",
                }}
              >
                ✓ Saved {fmtSince(lastSavedAt)}
              </div>
            )}
            {msg && !lastSavedAt && (
              <div className="badge" style={{ background: "#fff7ed", borderColor: "#fed7aa" }}>
                {msg}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Lightbox Modal */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <img
            src={lightbox}
            alt="preview"
            style={{
              maxWidth: "95vw",
              maxHeight: "88vh",
              objectFit: "contain",
              boxShadow: "0 10px 40px rgba(0,0,0,.5)",
              borderRadius: 12,
            }}
          />
        </div>
      )}
    </main>
  );
}
