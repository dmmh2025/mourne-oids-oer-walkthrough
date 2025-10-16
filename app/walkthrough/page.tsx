"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/supabaseClient";

/** ========= Types ========= */
type CheckItem = {
  label: string;
  weight: number;      // points for this check
  done: boolean;
  tips?: string[];     // expandable guidance
  photos: string[];    // public URLs uploaded for this check
};

type Section = {
  title: string;
  points: number;      // section total (sum of item weights)
  allOrNothing?: boolean; // if true, award points only if all checks done
  items: CheckItem[];
};

/** Small helpers */
const clamp = (n: number) => (Number.isFinite(n) ? n : 0);
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/* ======== Stars (by total %) ======== */
function starsForPercent(p: number) {
  if (p >= 90) return 5;
  if (p >= 80) return 4;
  if (p >= 70) return 3;
  if (p >= 60) return 2;
  if (p >= 50) return 1;
  return 0;
}

/* ======== Service scoring (25) ======== */
function pointsForADT(mins: number) {
  if (mins < 25) return 15;
  if (mins <= 26) return 10;
  if (mins <= 27) return 8;
  if (mins <= 28) return 6;
  if (mins <= 30) return 4;
  return 0;
}
function pointsForSBR(pct: number) {
  if (pct >= 75) return 5;
  if (pct >= 70) return 4;
  if (pct >= 50) return 3;
  return 0;
}
function pointsForExtremes(perThousand: number) {
  if (perThousand <= 15) return 5;
  if (perThousand <= 20) return 4;
  if (perThousand <= 25) return 3;
  if (perThousand <= 30) return 2;
  return 0;
}

/** ========= Sections (from your doc, total = 75) =========
 * Note: "Image" originally summed to 21; we merged 2×1pt checks into 1×1pt
 * “Walk-in & Makeline clean and working” so Image = 20 and overall stays 75.
 */
const SECTIONS_BASE: Omit<Section, "items"> & { items: Omit<CheckItem, "photos">[] }[] = [
  /* ---------------- Food Safety (18) ---------------- */
  {
    title: "Food Safety",
    points: 18,
    items: [
      { label: "Temps entered on time and within range", weight: 3, done: false },
      {
        label: "Products within shelf life – including ambient products, dips & drinks",
        weight: 3, done: false
      },
      { label: "Proper handwashing procedures – 20 seconds", weight: 3, done: false },
      {
        label: "Sanitation procedures followed",
        weight: 3, done: false,
        tips: [
          "Timer running",
          "Sanitiser sink correct concentration",
          "All bottle lids changed daily",
          "Can opener clean, rust free with no signs of food debris",
          "Sanitiser bottles filled and available",
          "All touch points clean – bubblepopper, sauce bottles, shakers, keyboards",
          "Sanitiser spray the only chemical in the kitchen area",
          "All dishes clean",
          "Mop bucket and sink clean",
          "Bins clean and free from sauce stains",
        ],
      },
      { label: "Proper cooking temp of food", weight: 3, done: false },
      { label: "4–6 week pest control service in place", weight: 3, done: false },
    ],
  },

  /* ---------------- Product (12) ---------------- */
  {
    title: "Product",
    points: 12,
    items: [
      {
        label: "Dough properly managed",
        weight: 5, done: false,
        tips: [
          "All sizes available at stretch table and in good condition",
          "Dough plan created and followed",
          "No blown dough",
          "No aired dough",
          "No dough past day 6",
        ],
      },
      {
        label: "Bread products properly prepared",
        weight: 2, done: false,
        tips: [
          "GPB with garlic spread, sauce and cheese to crust",
          "No dock in dippers",
          "Dough balls not opening",
        ],
      },
      {
        label: "Approved products and procedures (APP)",
        weight: 2, done: false,
        tips: [
          "Makeline bins filled for max 2 hours trade",
          "Allergen poster displayed, leaflets available",
          "Back doors securely closed at all times",
          "GF Kit complete – screens free of carbon",
          "Toppings in black tubs in bottom row of makeline bin",
          "PB procedures followed - PB cheese not over 1st tray",
          "All products available including sides and soft drinks",
          "Red and white dough scrapers available on makeline for doughballs",
        ],
      },
      {
        label: "All sides properly prepared",
        weight: 1, done: false,
        tips: [
          "Fries prepped",
          "2 pack and 4 pack cookies prepped and available",
          "Double Chocolate cookies prepped and available",
          "Flavoured wings prepped and available",
          "All sides available in makeline cabinet",
        ],
      },
      { label: "Adequate PRP to handle expected sales volume", weight: 2, done: false },
    ],
  },

  /* ---------------- Image (20) ---------------- */
  {
    title: "Image",
    points: 20,
    items: [
      {
        label: "Team members in proper uniform",
        weight: 3, done: false,
        tips: [
          "Jet black trousers/jeans. No leggings, joggers or combats",
          "Plain white/black undershirt with no branding or logos",
          "No visible piercings of any kind. Plasters can not be used to cover",
          "No jumpers/hoodies/jackets – Domino’s uniforms only",
        ],
      },
      {
        label: "Grooming standards maintained",
        weight: 1, done: false,
        tips: [
          "Clean shaven or neat beard",
          "No visible piercings of any kind. Plasters can not be used to cover",
        ],
      },
      {
        label: "Store interior clean and in good repair",
        weight: 3, done: false,
        tips: [
          "All toilets must have lined bin with lid",
          "All bins in customer view must have a lid and be clean",
          "No sauce stains on walls",
          "No build-up of cornmeal in corners of floor",
          "Store generally clean and presentable",
        ],
      },
      {
        label: "Customer Area and view",
        weight: 3, done: false,
        tips: [
          "Customer area clean and welcoming",
          "Tables and chairs clean",
          "Floors clean",
          "No cobwebs",
          "No buildup of leaves/cornmeal in corners",
          "Everything in customer view clean and tidy",
          "No staff food/drink in customer view",
        ],
      },
      {
        label: "Outside",
        weight: 2, done: false,
        tips: [
          "No branded rubbish front or rear",
          "Bins not overflowing",
          "No build up of leaves/dirt in corners beside doors",
          "No buildup of leaves/rubbish/weeds outside shop",
          "Signage clean and free from cobwebs/stains",
        ],
      },
      {
        label: "Baking Equipment",
        weight: 3, done: false,
        tips: [
          "All screens and pans clean and free from food or carbon buildup",
          "SC screens not bent or misshapen",
          "Oven hood and filters clean",
          "Oven chambers clean and not discolouring",
          "Oven windows clean",
          "Bubble popper clean",
          "Top of oven not dusty",
        ],
      },
      {
        label: "Delivery bags",
        weight: 2, done: false,
        tips: [
          "Clean – inside and out with no build up of cornmeal",
          "No sticker residue on bags",
          "Patches not worn or logo damaged",
          "No rips or tears",
        ],
      },
      { label: "Signage & Menu current, displayed correctly, clean and in good repair", weight: 1, done: false },
      {
        label: "Walk-in & Makeline clean and working",
        weight: 1, done: false,
        tips: [
          "Walk-in: Fan/floor/ceiling/walls & shelving clean (no mould/debris/rust)",
          "Walk-in: Door seal good and handle clean — no food debris",
          "Walk-in: No dating sticker lying on the floors; floors clean",
          "Makeline: Cupboards/doors/handles/shelves/seals/lids clean & in good condition",
          "Makeline: Catch trays/grills/seals in good condition — no splits/tears/missing rails",
        ],
      },
      { label: "Delivery vehicles represent positive brand image", weight: 1, done: false },
    ],
  },

  /* ---------------- Safety & security (5) ---------------- */
  {
    title: "Safety & security",
    points: 5,
    items: [
      { label: "Drivers regularly making cash drops", weight: 1, done: false },
      { label: "Caller ID working – security call backs being made", weight: 1, done: false },
      { label: "Safe used and secure", weight: 1, done: false },
      { label: "No more than £100 in front till", weight: 1, done: false },
      { label: "Drivers wearing seatbelts and driving safely", weight: 1, done: false },
    ],
  },

  /* ---------------- Product quality (20, all-or-nothing) ---------------- */
  {
    title: "Product quality",
    points: 20,
    allOrNothing: true, // must check all to get 20
    items: [
      { label: "RIM",       weight: 1, done: false },
      { label: "RISE",      weight: 1, done: false },
      { label: "SIZE",      weight: 1, done: false },
      { label: "PORTION",   weight: 1, done: false },
      { label: "PLACEMENT", weight: 1, done: false },
      { label: "BAKE",      weight: 1, done: false },
      { label: "Have you checked the bacon in the middle", weight: 1, done: false },
      { label: "No sauce and cheese on crust", weight: 1, done: false },
    ],
  },
];

export default function WalkthroughPage() {
  const router = useRouter();

  // Details
  const [store, setStore] = React.useState<"Downpatrick" | "Kilkeel" | "Newcastle" | "">("");
  const [name, setName] = React.useState("");

  // Service inputs
  const [adt, setAdt] = React.useState("");
  const [sbr, setSbr] = React.useState("");
  const [extremes, setExtremes] = React.useState("");

  // Sections state (deep copy + photos = [])
  const [sections, setSections] = React.useState<Section[]>(
    SECTIONS_BASE.map((s) => ({
      ...s,
      items: s.items.map((i) => ({ ...i, photos: [] })),
    }))
  );

  // Collapsible
  const [open, setOpen] = React.useState<boolean[]>(sections.map(() => true));
  const toggleSection = (idx: number) =>
    setOpen((prev) => prev.map((o, i) => (i === idx ? !o : o)));
  const setAll = (val: boolean) => setOpen(sections.map(() => val));

  // Compute section totals with per-item weights; Product quality all-or-nothing
  const sectionTotals = React.useMemo(() => {
    return sections.map((s) => {
      if (s.allOrNothing) {
        const allDone = s.items.every((i) => i.done);
        return allDone ? s.points : 0;
      }
      const got = s.items.filter((i) => i.done).reduce((a, b) => a + b.weight, 0);
      return Math.min(got, s.points);
    });
  }, [sections]);

  const section_total = sectionTotals.reduce((a, b) => a + b, 0); // /75

  // Service
  const adtNum = clamp(parseFloat(adt));
  const sbrNum = clamp(parseFloat(sbr));
  const extNum = clamp(parseFloat(extremes));
  const serviceADT = pointsForADT(adtNum);
  const serviceSBR = pointsForSBR(sbrNum);
  const serviceExt = pointsForExtremes(extNum);
  const service_total = serviceADT + serviceSBR + serviceExt; // /25

  const predicted = section_total + service_total; // /100
  const stars = starsForPercent(predicted);

  /** Upload photos for a specific check */
  async function handleUpload(si: number, ii: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!store) {
      alert("Please select a store before uploading photos.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const secSlug = slug(sections[si].title);
    const itemSlug = slug(sections[si].items[ii].label);

    const newUrls: string[] = [];

    for (let n = 0; n < files.length; n++) {
      const f = files[n];
      const ext = f.name.split(".").pop() || "jpg";
      const path = `${store}/${today}/${secSlug}/${itemSlug}_${Date.now()}_${n}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("walkthrough")
        .upload(path, f, { upsert: false });

      if (upErr) {
        alert(`Upload failed: ${upErr.message}`);
        return;
      }

      const { data: pub } = supabase.storage.from("walkthrough").getPublicUrl(path);
      if (pub?.publicUrl) newUrls.push(pub.publicUrl);
    }

    // Update state with new photo URLs
    setSections((prev) => {
      const next = [...prev];
      const sec = { ...next[si] };
      const item = { ...sec.items[ii] };
      item.photos = [...item.photos, ...newUrls];
      sec.items = [...sec.items];
      sec.items[ii] = item;
      next[si] = sec;
      return next;
    });
  }

  /** Remove a photo locally (does not delete from storage) */
  function removePhoto(si: number, ii: number, idx: number) {
    setSections((prev) => {
      const next = [...prev];
      const sec = { ...next[si] };
      const item = { ...sec.items[ii] };
      const copy = [...item.photos];
      copy.splice(idx, 1);
      item.photos = copy;
      sec.items = [...sec.items];
      sec.items[ii] = item;
      next[si] = sec;
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!store) return alert("Please select a store.");
    if (!name.trim()) return alert("Please enter your name.");

    // Submit to API and redirect
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store,
        name,
        adt: adtNum,
        sbr: sbrNum,
        extremes: extNum,
        sections,            // includes photos arrays on each check
        section_total,       // /75
        service_total,       // /25
        predicted,           // /100
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      alert(`Submit failed: ${txt}`);
      return;
    }

    router.push(
      `/success?store=${encodeURIComponent(store)}&name=${encodeURIComponent(
        name
      )}&predicted=${predicted}&stars=${stars}`
    );
  }

  return (
    <main>
      {/* Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "12px 0",
          background: "#fff",
          borderBottom: "3px solid #006491",
        }}
      >
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
          style={{ maxWidth: "90%", height: "auto", display: "block" }}
        />
      </div>

      <section className="container" style={{ display: "grid", gap: 16 }}>
        <h1 style={{ fontSize: 22, marginTop: 8 }}>Daily OER Walkthrough</h1>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          {/* Details */}
          <div className="card" style={{ display: "grid", gap: 8 }}>
            <label style={{ fontWeight: 600 }}>Store</label>
            <select value={store} onChange={(e) => setStore(e.target.value as any)}>
              <option value="">Select a store...</option>
              <option value="Downpatrick">Downpatrick</option>
              <option value="Kilkeel">Kilkeel</option>
              <option value="Newcastle">Newcastle</option>
            </select>

            <label style={{ fontWeight: 600, marginTop: 6 }}>Your Name</label>
            <input
              type="text"
              placeholder="Type your name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Service snapshot */}
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <strong>Service Snapshot</strong>

            <div style={{ display: "grid", gap: 6 }}>
              <label>ADT (minutes)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="e.g. 24.75"
                value={adt}
                onChange={(e) => setAdt(e.target.value)}
              />
              <small style={{ color: "var(--muted)" }}>Points: {serviceADT} / 15</small>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>SBR (%)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="e.g. 82.5"
                value={sbr}
                onChange={(e) => setSbr(e.target.value)}
              />
              <small style={{ color: "var(--muted)" }}>Points: {serviceSBR} / 5</small>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Extremes (per 1000)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="e.g. 12.5"
                value={extremes}
                onChange={(e) => setExtremes(e.target.value)}
              />
              <small style={{ color: "var(--muted)" }}>Points: {serviceExt} / 5</small>
            </div>

            <div className="badge" style={{ marginTop: 4 }}>
              Service total: <b style={{ marginLeft: 6 }}>{service_total} / 25</b>
            </div>
          </div>

          {/* Section controls */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setAll(true)}>Expand all</button>
            <button type="button" onClick={() => setAll(false)}>Collapse all</button>
          </div>

          {/* Sections with vertical checks + photos + expandable guidance */}
          <div style={{ display: "grid", gap: 12 }}>
            {sections.map((sec, si) => {
              const doneItems = sec.items.filter((i) => i.done);
              const earned = sec.allOrNothing
                ? doneItems.length === sec.items.length && sec.items.length > 0
                  ? sec.points
                  : 0
                : doneItems.reduce((a, b) => a + b.weight, 0);

              return (
                <div key={sec.title} className="card" style={{ padding: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: 12,
                      borderBottom: "1px solid var(--softline)",
                      background:
                        (!sec.allOrNothing && earned >= sec.points) ||
                        (sec.allOrNothing && earned === sec.points)
                          ? "rgba(0,128,0,.05)"
                          : "#fff",
                    }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong>{sec.title}</strong>
                      <small style={{ color: "var(--muted)" }}>
                        {doneItems.length}/{sec.items.length} checks · {earned}/{sec.points} pts
                        {sec.allOrNothing ? " (all-or-nothing)" : ""}
                      </small>
                    </div>
                    <button type="button" onClick={() => toggleSection(si)} style={{ fontSize: 13 }}>
                      <span aria-hidden>{open[si] ? "Hide" : "Show"}</span>
                    </button>
                  </div>

                  {open[si] && (
                    <div style={{ padding: 12, display: "grid", gap: 10 }}>
                      {sec.items.map((it, ii) => (
                        <div key={ii} className="card" style={{ padding: 10 }}>
                          {/* checkbox + label + weight */}
                          <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
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
                            <span>
                              {it.label}{" "}
                              <small style={{ color: "var(--muted)" }}>
                                · {it.weight} pt{it.weight !== 1 ? "s" : ""}
                              </small>
                            </span>
                          </label>

                          {/* Photos */}
                          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                            <label style={{ fontSize: 14, fontWeight: 600 }}>
                              Upload photo(s)
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handleUpload(si, ii, e.target.files)}
                            />

                            {/* Thumbnails */}
                            {it.photos.length > 0 && (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fill, minmax(88px,1fr))",
                                  gap: 8,
                                }}
                              >
                                {it.photos.map((url, pi) => (
                                  <div
                                    key={pi}
                                    style={{
                                      position: "relative",
                                      border: "1px solid var(--softline)",
                                      borderRadius: 8,
                                      overflow: "hidden",
                                    }}
                                  >
                                    <img
                                      src={url}
                                      alt="upload preview"
                                      style={{
                                        width: "100%",
                                        height: 88,
                                        objectFit: "cover",
                                        display: "block",
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removePhoto(si, ii, pi)}
                                      style={{
                                        position: "absolute",
                                        top: 4,
                                        right: 4,
                                        fontSize: 12,
                                        background: "rgba(0,0,0,.6)",
                                        color: "#fff",
                                        padding: "2px 6px",
                                        borderRadius: 6,
                                      }}
                                      aria-label="Remove photo"
                                      title="Remove photo"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* expandable guidance */}
                          {it.tips && it.tips.length > 0 && (
                            <details style={{ marginTop: 8 }}>
                              <summary>Guidance / What good looks like</summary>
                              <ul style={{ margin: "8px 0 0 18px", display: "grid", gap: 4 }}>
                                {it.tips.map((t, i) => (
                                  <li key={i} style={{ fontSize: 14, color: "var(--muted)" }}>
                                    {t}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Live totals + star grade */}
          <div className="card" style={{ display: "grid", gap: 8 }}>
            <div><b>Walkthrough total:</b> {section_total}/75</div>
            <div><b>Service total:</b> {service_total}/25</div>
            <div style={{ fontSize: 18 }}>
              <b>Predicted OER:</b> {predicted}/100 &nbsp;·&nbsp;
              {"★".repeat(stars)}
              {"☆".repeat(5 - stars)}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="brand" type="submit">Submit & View Report</button>
            <a href="/"><button type="button">Back to Home</button></a>
          </div>
        </form>
      </section>
    </main>
  );
}
