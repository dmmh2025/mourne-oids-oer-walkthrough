"use client";

import * as React from "react";
import { useState } from "react";
import { supabase } from "@/supabaseClient";

type PhotoRef = { url: string; path: string };
type ItemState = {
  label: string;
  done: boolean;
  by: string;
  photos: PhotoRef[];
};
type SectionState = {
  title: string;
  items: ItemState[];
};

const STORES = ["Downpatrick", "Kilkeel", "Newcastle"] as const;

// --- Checklist content ---
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
    items: [
      "Empty out and wash down",
      "Clean in and around fan",
      "Clean down door and seals",
    ],
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

function toState(): SectionState[] {
  return RAW.map((s) => ({
    title: s.title,
    items: s.items.map((label) => ({
      label,
      done: false,
      by: "",
      photos: [],
    })),
  }));
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function DeepCleanPage() {
  const [store, setStore] = useState<typeof STORES[number] | "">("");
  const [sections, setSections] = useState<SectionState[]>(toState());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handlePhotoUpload(
    secIdx: number,
    itemIdx: number,
    files: FileList | null
  ) {
    if (!files || !store) return;

    // ✅ Non-null Supabase client reference for TS
    const sb = supabase!;
    if (!sb) {
      setMsg("Supabase is not initialised. Check NEXT_PUBLIC_SUPABASE_* env vars.");
      return;
    }

    const fileArr = Array.from(files);
    const uploaded: PhotoRef[] = [];

    for (let i = 0; i < fileArr.length; i++) {
      const f = fileArr[i];
      const path = `${slug(store)}/${Date.now()}_${slug(
        sections[secIdx].title
      )}_${slug(sections[secIdx].items[itemIdx].label)}_${i}_${f.name}`;

      const { error } = await sb.storage
        .from("deep-clean")
        .upload(path, f, { upsert: false });

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
      const it = { ...next[secIdx].items[itemIdx] };
      it.photos = [...it.photos, ...uploaded];
      next[secIdx].items[itemIdx] = it;
      return next;
    });
  }

  async function submit() {
    if (!store) {
      setMsg("Please select a store first.");
      return;
    }

    const sb = supabase!;
    if (!sb) {
      setMsg("Supabase is not initialised. Check NEXT_PUBLIC_SUPABASE_* env vars.");
      return;
    }

    setSaving(true);
    setMsg(null);

    const payload = {
      store,
      sections,
    };

    const res = await fetch("/api/deep-clean/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const t = await res.text();
      setMsg(`Save failed: ${t}`);
      return;
    }

    setMsg("Saved! Your deep clean progress has been recorded.");
    // Optionally reset:
    // setSections(toState());
  }

  return (
    <main>
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <section style={{ padding: 16, marginBottom: 14 }}>
        <header>
          <strong style={{ fontSize: 22 }}>Autumn Deep Clean Checklist</strong>
          <small style={{ color: "var(--muted)" }}>
            Save progress per store. Each check allows photo(s) and name.
          </small>
        </header>

        <div style={{ display: "grid", gap: 12 }}>
          {/* Store select */}
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "1fr",
              maxWidth: 420,
            }}
          >
            <label style={{ fontWeight: 600 }}>Store</label>
            <select
              value={store}
              onChange={(e) => setStore(e.target.value as any)}
            >
              <option value="">Select store…</option>
              {STORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Sections */}
          <div style={{ display: "grid", gap: 10 }}>
            {sections.map((sec, si) => (
              <details key={sec.title} open>
                <summary>
                  <div style={{ fontWeight: 700 }}>{sec.title}</div>
                </summary>
                <div style={{ padding: 12, display: "grid", gap: 12 }}>
                  {sec.items.map((it, ii) => (
                    <div
                      key={`${sec.title}-${ii}`}
                      style={{
                        border: "1px solid var(--softline)",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fff",
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
                              next[si].items[ii] = {
                                ...next[si].items[ii],
                                done: e.target.checked,
                              };
                              return next;
                            })
                          }
                        />
                        <span>{it.label}</span>
                      </label>

                      <div style={{ display: "grid", gap: 6 }}>
                        <label style={{ fontSize: 13, color: "var(--muted)" }}>
                          Team member name
                        </label>
                        <input
                          type="text"
                          placeholder="Your name…"
                          value={it.by}
                          onChange={(e) =>
                            setSections((prev) => {
                              const next = [...prev];
                              next[si] = { ...next[si] };
                              next[si].items = [...next[si].items];
                              next[si].items[ii] = {
                                ...next[si].items[ii],
                                by: e.target.value,
                              };
                              return next;
                            })
                          }
                        />
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <label style={{ fontSize: 13, color: "var(--muted)" }}>
                          Upload photo(s)
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) =>
                            handlePhotoUpload(si, ii, e.target.files)
                          }
                        />
                        {it.photos.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            {it.photos.map((p, idx) => (
                              <img
                                key={idx}
                                src={p.url}
                                alt="proof"
                                style={{
                                  width: 84,
                                  height: 84,
                                  objectFit: "cover",
                                  borderRadius: 8,
                                  border: "1px solid var(--line)",
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={submit} className="brand" disabled={saving}>
              {saving ? "Saving…" : "Save Progress"}
            </button>
            <a href="/">
              <button>Back to Home</button>
            </a>
          </div>

          {msg && (
            <div
              className="badge"
              style={{
                background: "rgba(0,100,145,.06)",
                borderColor: "var(--softline)",
              }}
            >
              {msg}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
