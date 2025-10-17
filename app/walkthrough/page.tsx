"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/* ---------- Supabase (browser) ---------- */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ---------- Types ---------- */
type CheckItem = {
  label: string;
  weight: number;
  done: boolean;
  tips?: string[];
  photos: string[];
};

type Section = {
  title: string;
  points: number;
  allOrNothing?: boolean;
  items: CheckItem[];
};

/* ---------- Helpers ---------- */
const clamp = (n: number) => (Number.isFinite(n) ? n : 0);
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/* ---------- Stars rule ---------- */
function starsForPercent(p: number) {
  if (p >= 90) return 5;
  if (p >= 80) return 4;
  if (p >= 70) return 3;
  if (p >= 60) return 2;
  if (p >= 50) return 1;
  return 0;
}

/* ---------- Service scoring ---------- */
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

/* ---------- Sections + items (unchanged content/weights) ---------- */
const SECTIONS_BASE: {
  title: string;
  points: number;
  allOrNothing?: boolean;
  items: { label: string; weight: number; done: boolean; tips?: string[] }[];
}[] = [
  // Food Safety (18)
  {
    title: "Food Safety",
    points: 18,
    items: [
      { label: "Temps entered on time and within range", weight: 3, done: false },
      {
        label: "Products within shelf life – including ambient products, dips & drinks",
        weight: 3,
        done: false,
      },
      { label: "Proper handwashing procedures – 20 seconds", weight: 3, done: false },
      {
        label: "Sanitation procedures followed",
        weight: 3,
        done: false,
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

  // Product (12)
  {
    title: "Product",
    points: 12,
    items: [
      {
        label: "Dough properly managed",
        weight: 5,
        done: false,
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
        weight: 2,
        done: false,
        tips: [
          "GPB with garlic spread, sauce and cheese to crust",
          "No dock in dippers",
          "Dough balls not opening",
        ],
      },
      {
        label: "Approved products and procedures (APP)",
        weight: 2,
        done: false,
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
        weight: 1,
        done: false,
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

  // Image (20)
  {
    title: "Image",
    points: 20,
    items: [
      {
        label: "Team members in proper uniform",
        weight: 3,
        done: false,
        tips: [
          "Jet black trousers/jeans. No leggings, joggers or combats",
          "Plain white/black undershirt with no branding or logos",
          "No visible piercings of any kind. Plasters can not be used to cover",
          "No jumpers/hoodies/jackets – Domino’s uniforms only",
        ],
      },
      {
        label: "Grooming standards maintained",
        weight: 1,
        done: false,
        tips: [
          "Clean shaven or neat beard",
          "No visible piercings of any kind. Plasters can not be used to cover",
        ],
      },
      {
        label: "Store interior clean and in good repair",
        weight: 3,
        done: false,
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
        weight: 3,
        done: false,
        tips: [
          "Customer area clean and welcoming",
          "Tables and chairs clean",
          "Floors clean",
          "No cobwebs",
          "No buildup of leaves/cornmeal in corners beside doors",
          "Everything in customer view clean and tidy",
          "No staff food/drink in customer view",
        ],
      },
      {
        label: "Outside",
        weight: 2,
        done: false,
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
        weight: 2,
        done: false,
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
        label: "Walk-in clean and working",
        weight: 1,
        done: false,
        tips: [
          "Fan, floor, ceiling, walls & shelving clean (no mould/debris/rust)",
          "Door seal good and handle clean — no food debris",
          "No dating stickers lying on the floors; floors clean",
        ],
      },
      {
        label: "Makeline clean and working",
        weight: 1,
        done: false,
        tips: [
          "Cupboards, doors, handles, shelves, seals and lids clean & in good condition",
          "Catch trays, grills and seals in good condition — no splits/tears/missing rails",
        ],
      },
      {
        label: "Delivery bags",
        weight: 2,
        done: false,
        tips: [
          "Clean – inside and out with no build up of cornmeal",
          "No sticker residue on bags",
          "Patches not worn or logo damaged",
          "No rips or tears",
        ],
      },
      { label: "Signage & Menu current, displayed correctly, clean and in good repair", weight: 1, done: false },
      { label: "Delivery vehicles represent positive brand image", weight: 1, done: false },
    ],
  },

  // Safety & security (5)
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

  // Product quality (20, all-or-nothing)
  {
    title: "Product quality",
    points: 20,
    allOrNothing: true,
    items: [
      { label: "RIM", weight: 1, done: false },
      { label: "RISE", weight: 1, done: false },
      { label: "SIZE", weight: 1, done: false },
      { label: "PORTION", weight: 1, done: false },
      { label: "PLACEMENT", weight: 1, done: false },
      { label: "BAKE", weight: 1, done: false },
      { label: "Have you checked the bacon in the middle", weight: 1, done: false },
      { label: "No sauce and cheese on crust", weight: 1, done: false },
    ],
  },
];

/* ---------- Page ---------- */
export default function WalkthroughPage() {
  const router = useRouter();

  // Details
  const [store, setStore] = React.useState<"" | "Downpatrick" | "Kilkeel" | "Newcastle">("");
  const [name, setName] = React.useState("");

  // Service
  const [adt, setAdt] = React.useState("");
  const [sbr, setSbr] = React.useState("");
  const [extremes, setExtremes] = React.useState("");

  // Sections state (photos arrays added)
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

  /* ---------- Totals ---------- */
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
  const section_total = sectionTotals.reduce((a, b) => a + b, 0);

  const adtNum = clamp(parseFloat(adt));
  const sbrNum = clamp(parseFloat(sbr));
  const extNum = clamp(parseFloat(extremes));
  const serviceADT = pointsForADT(adtNum);
  const serviceSBR = pointsForSBR(sbrNum);
  const serviceExt = pointsForExtremes(extNum);
  const service_total = serviceADT + serviceSBR + serviceExt;
  const predicted = section_total + service_total;
  const stars = starsForPercent(predicted);

  /* ---------- Uploads ---------- */
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

      if (upErr) return alert(`Upload failed: ${upErr.message}`);

      const { data: pub } = supabase.storage.from("walkthrough").getPublicUrl(path);
      if (pub?.publicUrl) newUrls.push(pub.publicUrl);
    }

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

  /* ---------- Submit ---------- */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!store) return alert("Please select a store.");
    if (!name.trim()) return alert("Please enter your name.");

    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store,
        name,
        adt: adtNum,
        sbr: sbrNum,
        extremes: extNum,
        sections,
        section_total,
        service_total,
        predicted,
      }),
    });

    if (!res.ok) return alert(`Submit failed: ${await res.text()}`);

    router.push(
      `/success?store=${encodeURIComponent(store)}&name=${encodeURIComponent(
        name
      )}&predicted=${predicted}&stars=${stars}`
    );
  }

  /* ---------- UI ---------- */
  return (
    <main className="wrap">
      {/* Sticky score bar */}
      <div className="sticky">
        <div className="sticky__inner">
          <div className="sticky__left">
            <span className="chip chip--blue">Walkthrough {section_total}/75</span>
            <span className="chip chip--teal">Service {service_total}/25</span>
            <span className="chip chip--gold">
              Total {predicted}/100&nbsp;·&nbsp;
              {"★".repeat(stars)}
              {"☆".repeat(5 - stars)}
            </span>
          </div>
          <a href="/" className="btn btn--ghost">Home</a>
        </div>
      </div>

      {/* Banner */}
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <section className="container">
        <h1>Daily OER Walkthrough</h1>

        {/* Legend */}
        <div className="legend card">
          <div className="legend__row">
            <span className="legend__stars">
              90%+ = ⭐⭐⭐⭐⭐ · 80–89.99% = ⭐⭐⭐⭐ · 70–79.99% = ⭐⭐⭐ · 60–69.99% = ⭐⭐ ·
              50–59.99% = ⭐ · &lt;50% = 0 ⭐
            </span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="stack">
          {/* Details */}
          <div className="card card--raised">
            <div className="grid">
              <label className="lbl">
                Store
                <select
                  value={store}
                  onChange={(e) => setStore(e.target.value as any)}
                >
                  <option value="">Select a store...</option>
                  <option value="Downpatrick">Downpatrick</option>
                  <option value="Kilkeel">Kilkeel</option>
                  <option value="Newcastle">Newcastle</option>
                </select>
              </label>

              <label className="lbl">
                Your name
                <input
                  type="text"
                  placeholder="Type your name…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Service */}
          <div className="card card--raised">
            <div className="card__bar">
              <div className="bar__title">Service snapshot</div>
            </div>
            <div className="grid">
              <label className="lbl">
                ADT (minutes)
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 24.75"
                  value={adt}
                  onChange={(e) => setAdt(e.target.value)}
                />
                <small className="muted">Points: {pointsForADT(clamp(parseFloat(adt)))} / 15</small>
              </label>

              <label className="lbl">
                SBR (%)
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 82.5"
                  value={sbr}
                  onChange={(e) => setSbr(e.target.value)}
                />
                <small className="muted">Points: {pointsForSBR(clamp(parseFloat(sbr)))} / 5</small>
              </label>

              <label className="lbl">
                Extremes (per 1000)
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 12.5"
                  value={extremes}
                  onChange={(e) => setExtremes(e.target.value)}
                />
                <small className="muted">Points: {pointsForExtremes(clamp(parseFloat(extremes)))} / 5</small>
              </label>
            </div>
          </div>

          {/* Expand/Collapse controls */}
          <div className="controls">
            <button type="button" className="btn" onClick={() => setAll(true)}>
              Expand all
            </button>
            <button type="button" className="btn" onClick={() => setAll(false)}>
              Collapse all
            </button>
          </div>

          {/* Sections */}
          <div className="stack">
            {sections.map((sec, si) => {
              const doneItems = sec.items.filter((i) => i.done);
              const earned = sec.allOrNothing
                ? doneItems.length === sec.items.length && sec.items.length > 0
                  ? sec.points
                  : 0
                : doneItems.reduce((a, b) => a + b.weight, 0);

              const full = sec.allOrNothing
                ? earned === sec.points
                : earned >= sec.points;

              return (
                <div key={sec.title} className="card card--section">
                  <div className="section__head">
                    <div className="section__badge" />
                    <div className="section__titlewrap">
                      <div className="section__title">{sec.title}</div>
                      <div className="section__sub">
                        {doneItems.length}/{sec.items.length} checks · {earned}/{sec.points} pts
                        {sec.allOrNothing ? " (all-or-nothing)" : ""}
                      </div>
                    </div>
                    <div className="section__chips">
                      <span className={`chip ${full ? "chip--green" : "chip--grey"}`}>
                        {earned}/{sec.points}
                      </span>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => toggleSection(si)}
                      >
                        {open[si] ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  {open[si] && (
                    <div className="checks">
                      {sec.items.map((it, ii) => (
                        <div key={ii} className={`check ${ii % 2 ? "check--alt" : ""}`}>
                          <label className="check__row">
                            <input
                              className="bigbox"
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
                            <span className="check__label">
                              <span className="check__text">{it.label}</span>
                              <span className="pill">{it.weight} pt{it.weight !== 1 ? "s" : ""}</span>
                            </span>
                          </label>

                          {/* Photos */}
                          <div className="upload">
                            <label className="lbl lbl--tight">Upload photo(s)</label>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handleUpload(si, ii, e.target.files)}
                            />
                            {it.photos.length > 0 && (
                              <div className="thumbs">
                                {it.photos.map((url, pi) => (
                                  <div key={pi} className="thumb">
                                    <img src={url} alt="upload" />
                                    <button
                                      type="button"
                                      className="thumb__remove"
                                      onClick={() => removePhoto(si, ii, pi)}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Guidance */}
                          {it.tips && it.tips.length > 0 && (
                            <details className="tips">
                              <summary>Guidance / What good looks like</summary>
                              <ul>
                                {it.tips.map((t, i) => (
                                  <li key={i}>{t}</li>
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

          {/* Actions */}
          <div className="actions">
            <button className="btn btn--brand" type="submit">
              Submit & View Report
            </button>
            <a href="/" className="btn btn--ghost">Back to Home</a>
          </div>
        </form>
      </section>

      {/* Styles */}
      <style jsx>{`
        :root {
          --bg: #f2f5f9;
          --paper: #ffffff;
          --line: #e5e7eb;
          --muted: #6b7280;
          --text: #0f172a;
          --brand: #006491;
          --brand-dk: #00517a;
          --accent: #0ea5e9;
          --green-ink: #15803d;
          --blue: #e6f0fb;
          --teal: #e6fbf6;
          --gold: #fff6e0;
          --green: #eaf8ee;
          --grey: #f3f4f6;
          --shadow-strong: 0 14px 28px rgba(2,6,23,.1), 0 2px 6px rgba(2,6,23,.06);
          --shadow-card: 0 10px 18px rgba(2,6,23,.08), 0 1px 3px rgba(2,6,23,.06);
        }
        .wrap {
          background: var(--bg);
          min-height: 100dvh;
          color: var(--text);
        }
        .banner {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 6px 0 10px;
          border-bottom: 3px solid #006491;
          background: #fff;
          box-shadow: var(--shadow-card);
        }
        .banner img {
          max-width: 92%;
          height: auto;
          display: block;
        }
        .container {
          max-width: 880px;
          margin: 0 auto;
          padding: 16px;
        }
        h1 {
          font-size: 22px;
          margin: 14px 0 12px;
          text-align: center;
          font-weight: 800;
          letter-spacing: .2px;
        }
        .stack { display: grid; gap: 16px; }
        .card {
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 14px;
          box-shadow: var(--shadow-card);
        }
        .card--raised { box-shadow: var(--shadow-strong); }
        .card--section {
          padding: 0;
          overflow: hidden;
          border: 1px solid #d8dee7;
          box-shadow: var(--shadow-strong);
        }
        .card__bar {
          background: linear-gradient(90deg, #eef7ff, #ffffff);
          border-radius: 10px;
          padding: 10px 12px;
          margin-bottom: 10px;
          border: 1px solid var(--line);
        }
        .bar__title { font-weight: 800; }

        .legend { font-size: 14px; }
        .legend__row { display: flex; justify-content: center; }
        .legend__stars { color: var(--muted); }

        .grid { display: grid; gap: 12px; }
        @media (min-width: 640px) {
          .grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
        }
        .lbl {
          display: grid;
          gap: 6px;
          font-weight: 700;
        }
        .lbl--tight { font-weight: 700; margin-bottom: 4px; }
        input[type="text"], input[type="number"], select {
          border: 2px solid #d7dbe3;
          border-radius: 12px;
          padding: 12px 14px;
          outline: none;
          font-size: 16px;
          background: #fff;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
        }
        input:focus, select:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 4px rgba(0,100,145,0.15);
        }
        .muted { color: var(--muted); }

        .controls { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

        /* SECTION HEADER with left accent bar */
        .section__head {
          display: grid;
          grid-template-columns: 8px 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 14px 14px;
          background: linear-gradient(90deg,#ffffff,#f7fbff);
          border-bottom: 1px solid #dde3ec;
        }
        .section__badge {
          width: 8px; height: 100%;
          background: linear-gradient(#0ea5e9,#006491);
          border-radius: 0 6px 6px 0;
        }
        .section__titlewrap { display: grid; gap: 4px; }
        .section__title { font-weight: 900; letter-spacing: .2px; }
        .section__sub { color: var(--muted); font-size: 13px; }
        .section__chips { display: flex; gap: 8px; align-items: center; }

        /* CHECK LIST */
        .checks { display: grid; }
        .check {
          padding: 12px;
          border-top: 1px solid #edf0f5;
          background: #ffffff;
        }
        .check--alt {
          background: #fafcff;
        }
        .check__row {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 10px;
          align-items: start;
        }
        .bigbox {
          width: 20px; height: 20px;
          transform: scale(1.15);
          accent-color: var(--brand);
          margin-top: 2px;
        }
        .check__label {
          display: flex;
          align-items: start;
          gap: 8px;
          flex-wrap: wrap;
        }
        .check__text { font-weight: 700; line-height: 1.3; }
        .pill {
          background: #eef7ff;
          border: 1px solid #cfe4ff;
          color: #0b4a6b;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
        }

        .upload { margin-top: 10px; display: grid; gap: 8px; }
        .thumbs {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
          gap: 10px;
        }
        .thumb {
          position: relative;
          border: 2px solid #dde3ec;
          border-radius: 12px;
          overflow: hidden;
          background: #f8fafc;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.6);
        }
        .thumb img {
          display: block;
          width: 100%;
          height: 90px;
          object-fit: cover;
        }
        .thumb__remove {
          position: absolute;
          top: 6px; right: 6px;
          background: #111827dd;
          color: #fff;
          border: none;
          border-radius: 8px;
          width: 26px; height: 26px;
          line-height: 25px;
          text-align: center;
          font-size: 16px;
        }

        .tips {
          margin-top: 10px;
          border: 1px solid #e7ecf3;
          border-radius: 10px;
          background: #fbfeff;
          padding: 8px 10px;
        }
        .tips summary { cursor: pointer; font-weight: 700; }
        .tips ul { margin: 8px 0 0 18px; display: grid; gap: 4px; color: var(--muted); }

        .actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

        .btn {
          background: #fff;
          border: 2px solid #d7dbe3;
          padding: 10px 14px;
          border-radius: 12px;
          font-weight: 800;
        }
        .btn--brand { background: var(--brand); color: #fff; border-color: var(--brand-dk); }
        .btn--brand:hover { background: var(--brand-dk); }
        .btn--ghost { background: #fff; }

        .chip {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #fff;
          font-size: 13px;
          font-weight: 800;
          box-shadow: 0 1px 0 rgba(255,255,255,.8);
        }
        .chip--blue { background: var(--blue); }
        .chip--teal { background: var(--teal); }
        .chip--gold { background: var(--gold); }
        .chip--green { background: #e9f9f1; color: var(--green-ink); border-color: #bfe9cf; }
        .chip--grey { background: var(--grey); }

        /* Sticky score bar */
        .sticky {
          position: sticky;
          top: 0;
          z-index: 60;
          backdrop-filter: saturate(180%) blur(6px);
          background: rgba(255,255,255,.92);
          border-bottom: 1px solid var(--line);
          box-shadow: 0 2px 10px rgba(2,6,23,.06);
        }
        .sticky__inner {
          max-width: 980px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 12px;
        }
        .sticky__left { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
      `}</style>
    </main>
  );
}
