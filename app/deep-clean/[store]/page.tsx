"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Item = { label: string; done: boolean; by: string; photos: string[] };
type Section = { title: string; items: Item[] };
type Row = { id?: number; store: string; items: Section[]; updated_at?: string };

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function timeSince(d: Date) {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
function isTinyFallback(struct: Section[]): boolean {
  // Your bad fallback was 5 sections, each with 2 items.
  if (!Array.isArray(struct)) return true;
  if (struct.length !== 5) return false;
  return struct.every(sec => Array.isArray(sec.items) && sec.items.length === 2);
}

function calcPct(sections: Section[] | null | undefined) {
  if (!sections?.length) return 0;
  const flat = sections.flatMap((s) => s.items || []);
  const total = flat.length || 0;
  const done = flat.filter((i) => i?.done).length;
  return total ? Math.round((done / total) * 100) : 0;
}

/** CURRENT canonical template for ALL stores */
const DEFAULT_TEMPLATE: Section[] = [
  {
    title: "Front of House",
    items: [
      { label: "Customer area deep-cleaned", done: false, by: "", photos: [] },
      { label: "Menu boards & signage spotless", done: false, by: "", photos: [] },
    ],
  },
  {
    title: "Makeline & Prep",
    items: [
      { label: "Makeline lids/seals cleaned", done: false, by: "", photos: [] },
      { label: "Prep surfaces sanitised", done: false, by: "", photos: [] },
    ],
  },
  {
    title: "Oven & Baking",
    items: [
      { label: "Oven hood/filters cleaned", done: false, by: "", photos: [] },
      { label: "Screens/pans free of carbon", done: false, by: "", photos: [] },
    ],
  },
  {
    title: "Walk-in / Storage",
    items: [
      { label: "Walk-in walls/floor/shelves cleaned", done: false, by: "", photos: [] },
      { label: "Door seals/handles cleaned", done: false, by: "", photos: [] },
    ],
  },
  {
    title: "Back of House",
    items: [
      { label: "Sinks/mop area cleaned", done: false, by: "", photos: [] },
      { label: "Bins sanitised and clean", done: false, by: "", photos: [] },
    ],
  },
];

/** Reconcile DB data to match the latest template while preserving progress */
function reconcileWithTemplate(existing: any, template: Section[]): Section[] {
  // Build lookup maps from existing data: section title -> (item label -> item state)
  const secMap = new Map<string, Map<string, Item>>();
  const safeArr = Array.isArray(existing) ? existing : [];
  for (const sec of safeArr) {
    const title = String(sec?.title ?? "");
    if (!title) continue;
    const itemMap = new Map<string, Item>();
    const items = Array.isArray(sec?.items) ? sec.items : [];
    for (const it of items) {
      const label = String(it?.label ?? "");
      if (!label) continue;
      itemMap.set(label, {
        label,
        done: Boolean(it?.done),
        by: typeof it?.by === "string" ? it.by : "",
        photos: Array.isArray(it?.photos) ? it.photos : [],
      });
    }
    secMap.set(title, itemMap);
  }

  // Create reconciled sections from the template shape
  const reconciled: Section[] = template.map((tSec) => {
    const fromSec = secMap.get(tSec.title);
    const items = tSec.items.map((tItem) => {
      const found = fromSec?.get(tItem.label);
      return {
        label: tItem.label,
        done: found?.done ?? false,
        by: found?.by ?? "",
        photos: Array.isArray(found?.photos) ? found!.photos : [],
      };
    });
    return { title: tSec.title, items };
  });

  return reconciled;
}

export default function DeepCleanStorePage({
  params,
}: {
  params: { store: string };
}) {
  const storeParam = params.store?.toLowerCase?.() || "";
  const storeName =
    storeParam === "kilkeel"
      ? "Kilkeel"
      : storeParam === "newcastle"
      ? "Newcastle"
      : "Downpatrick";

  const [row, setRow] = React.useState<Row | null>(null);
  const [sections, setSections] = React.useState<Section[]>([]);
  const [open, setOpen] = React.useState<boolean[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("deep_clean_submissions")
        .select("*")
        .eq("store", storeName)
        .maybeSingle();

      if (error || !data) {
        // No row yet → start with canonical template
        const fresh: Row = { store: storeName, items: DEFAULT_TEMPLATE };
        setRow(fresh);
        setSections(fresh.items);
        setOpen(fresh.items.map(() => true));
      } else {
        // Row exists → merge onto current template so all stores match
        const reconciled = reconcileWithTemplate(data.items, DEFAULT_TEMPLATE);
        setRow({ ...data, items: reconciled });
        setSections(reconciled);
        setOpen(reconciled.map(() => true));
      }
      setLoading(false);
    })();
  }, [storeName]);

  const setAll = (val: boolean) => setOpen(sections.map(() => val));
  const toggleSection = (idx: number) =>
    setOpen((prev) => prev.map((o, i) => (i === idx ? !o : o)));

  async function handleUpload(si: number, ii: number, files: FileList | null) {
    if (!files?.length) return;

    const today = new Date().toISOString().slice(0, 10);
    const secSlug = slug(sections[si].title);
    const itemSlug = slug(sections[si].items[ii].label);
    const newUrls: string[] = [];

    for (let n = 0; n < files.length; n++) {
      const f = files[n];
      const ext = f.name.split(".").pop() || "jpg";
      const path = `${storeName}/${today}/${secSlug}/${itemSlug}_${Date.now()}_${n}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("deep-clean")
        .upload(path, f, { upsert: false });

      if (upErr) {
        alert(`Upload failed: ${upErr.message}`);
        return;
      }

      const { data: pub } = supabase.storage.from("deep-clean").getPublicUrl(path);
      if (pub?.publicUrl) newUrls.push(pub.publicUrl);
    }

    setSections((prev) => {
      const next = [...prev];
      const sec = { ...next[si] };
      const item = { ...sec.items[ii] };
      item.photos = [...(item.photos || []), ...newUrls];
      sec.items = [...sec.items];
      sec.items[ii] = item;
      next[si] = sec;
      return next;
    });
  }

  function removePhoto(si: number, ii: number, pi: number) {
    setSections((prev) => {
      const next = [...prev];
      const sec = { ...next[si] };
      const item = { ...sec.items[ii] };
      const copy = [...(item.photos || [])];
      copy.splice(pi, 1);
      item.photos = copy;
      sec.items = [...sec.items];
      sec.items[ii] = item;
      next[si] = sec;
      return next;
    });
  }

  async function saveProgress() {
    setSaving(true);
    const payload: Row = {
      store: storeName,
      items: sections,
      updated_at: new Date().toISOString(),
    };

    // NOTE: Ensure the DB has a UNIQUE constraint on "store" for this table
    // so onConflict: 'store' works as intended.
    const { error } = await supabase
      .from("deep_clean_submissions")
      .upsert(payload, { onConflict: "store" });

    setSaving(false);
    if (error) {
      alert(`Save failed: ${error.message}`);
    } else {
      alert("Progress saved ✅");
      const { data } = await supabase
        .from("deep_clean_submissions")
        .select("*")
        .eq("store", storeName)
        .maybeSingle();
      if (data) setRow(data as Row);
    }
  }

  const pct = calcPct(sections);
  const updatedAt = row?.updated_at ? new Date(row.updated_at) : null;

  return (
    <main className="wrap">
      {/* Sticky top bar */}
      <div className="sticky">
        <div className="sticky__inner">
          <div className="sticky__left">
            <span className="chip chip--blue">{storeName} Deep Clean</span>
            <span className="chip chip--teal">{pct}% complete</span>
            {updatedAt && (
              <span className="chip chip--gold">
                Updated {timeSince(updatedAt)} ago
              </span>
            )}
          </div>
          <div className="sticky__right">
            <a href="/deep-clean" className="btn btn--ghost">⬅ Back</a>
            <a href="/" className="btn btn--ghost">Home</a>
          </div>
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
        <h1>{storeName} · Autumn Deep Clean</h1>

        {loading ? (
          <div className="card">Loading…</div>
        ) : (
          <>
            <div className="controls">
              <button type="button" className="btn" onClick={() => setAll(true)}>
                Expand all
              </button>
              <button type="button" className="btn" onClick={() => setAll(false)}>
                Collapse all
              </button>
            </div>

            <div className="stack">
              {sections.map((sec, si) => (
                <div key={si} className="card card--section">
                  <div className="section__head">
                    <div className="section__badge" />
                    <div className="section__titlewrap">
                      <div className="section__title">{sec.title}</div>
                      <div className="section__sub">
                        {sec.items.filter((i) => i.done).length}/{sec.items.length} checks
                      </div>
                    </div>
                    <div className="section__chips">
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
                              checked={!!it.done}
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
                            </span>
                          </label>

                          <div className="inlinegrid">
                            <label className="lbl">
                              Your name (for this check)
                              <input
                                type="text"
                                placeholder="Type your name…"
                                value={it.by || ""}
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
                            </label>
                          </div>

                          <div className="upload">
                            <label className="lbl lbl--tight">Upload photo(s)</label>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handleUpload(si, ii, e.target.files)}
                            />
                            {(it.photos || []).length > 0 && (
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
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="controls">
              <button
                type="button"
                className="btn btn--brand"
                onClick={saveProgress}
                disabled={saving}
                title="Saves your current progress"
              >
                {saving ? "Saving…" : "Save Progress"}
              </button>
            </div>
          </>
        )}
      </section>

      {/* Sticky bottom Save bar */}
      <div className="submitbar">
        <div className="submitbar__inner">
          <button
            className="btn btn--brand btn--lg"
            type="button"
            onClick={saveProgress}
            disabled={saving}
            title="Saves your current progress"
          >
            {saving ? "Saving…" : "Save Progress"}
          </button>
        </div>
      </div>

      <style jsx>{`
        :root {
          --bg: #f2f5f9;
          --paper: #ffffff;
          --line: #e5e7eb;
          --muted: #6b7280;
          --text: #0f172a;
          --brand: #006491;
          --brand-dk: #00517a;
          --blue: #e6f0fb;
          --teal: #e6fbf6;
          --gold: #fff6e0;
          --shadow-card: 0 10px 18px rgba(2,6,23,.08), 0 1px 3px rgba(2,6,23,.06);
        }
        .wrap { background: var(--bg); min-height: 100dvh; color: var(--text); }
        .banner { display:flex; justify-content:center; align-items:center; padding:6px 0 10px; border-bottom:3px solid var(--brand); background:#fff; box-shadow: var(--shadow-card); }
        .banner img { max-width:92%; height:auto; display:block; }
        .container { max-width:880px; margin:0 auto; padding:16px; }
        h1 { font-size:20px; margin:14px 0 12px; text-align:center; font-weight:800; }
        .stack { display:grid; gap:16px; }
        .card { background:var(--paper); border:1px solid var(--line); border-radius:14px; padding:14px; box-shadow:var(--shadow-card); }
        .card--section { padding:0; overflow:hidden; border:1px solid #d8dee7; }
        .controls { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
        .muted { color:var(--muted); }

        .section__head { display:grid; grid-template-columns:8px 1fr auto; align-items:center; gap:12px; padding:14px; background:linear-gradient(90deg,#ffffff,#f7fbff); border-bottom:1px solid #dde3ec; }
        .section__badge { width:8px; height:100%; background:linear-gradient(#0ea5e9,#006491); border-radius:0 6px 6px 0; }
        .section__titlewrap { display:grid; gap:2px; }
        .section__title { font-weight:900; }
        .section__sub { color:var(--muted); font-size:13px; }

        .checks { display:grid; }
        .check { padding:12px; border-top:1px solid #edf0f5; background:#ffffff; }
        .check--alt { background:#fafcff; }
        .check__row { display:grid; grid-template-columns:28px 1fr; gap:10px; }
        .bigbox { width:20px; height:20px; accent-color:var(--brand); }
        .check__text { font-weight:700; }

        input[type="text"] {
          border:2px solid #d7dbe3; border-radius:12px; padding:10px 14px; font-size:16px; background:#fff;
        }
        input:focus { border-color:var(--brand); }

        .upload { margin-top:10px; display:grid; gap:8px; }
        .thumbs { display:grid; grid-template-columns:repeat(auto-fill, minmax(90px,1fr)); gap:10px; }
        .thumb { position:relative; border:2px solid #dde3ec; border-radius:12px; overflow:hidden; background:#f8fafc; }
        .thumb img { width:100%; height:90px; object-fit:cover; }
        .thumb__remove { position:absolute; top:6px; right:6px; background:#111827dd; color:#fff; border:none; border-radius:8px; width:26px; height:26px; font-size:16px; }

        /* Buttons (match Walkthrough style) */
        .btn {
          background:#fff;
          border:3px solid var(--brand);
          padding:10px 14px;
          border-radius:12px;
          font-weight:800;
          color:var(--brand);
          box-shadow:var(--shadow-card);
          transition:all .15s ease-in-out;
          text-decoration:none;
          display:inline-flex;
          align-items:center;
          justify-content:center;
        }
        .btn:hover { background:var(--brand); color:#fff; transform:translateY(-1px); }
        .btn--brand {
          background:#fff;
          color:#000; /* black text per your request */
          border-color:var(--brand);
        }
        .btn--brand:hover { background:var(--brand); color:#fff; }
        .btn--ghost { background:#fff; color:var(--brand); }
        .btn--lg { padding:14px 18px; font-size:17px; border-radius:14px; }

        /* Chips */
        .chip { display:inline-block; padding:6px 10px; border-radius:999px; border:1px solid var(--line); background:#fff; font-size:13px; font-weight:800; box-shadow:0 1px 0 rgba(255,255,255,.8); }
        .chip--blue { background:#e6f0fb; }
        .chip--teal { background:#e6fbf6; }
        .chip--gold { background:#fff6e0; }

        /* Sticky top */
        .sticky { position:sticky; top:0; z-index:60; background:rgba(255,255,255,.95); border-bottom:1px solid var(--line); box-shadow:0 2px 10px rgba(2,6,23,.06); }
        .sticky__inner { max-width:980px; margin:0 auto; display:flex; justify-content:space-between; align-items:center; padding:8px 12px; }
        .sticky__left { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
        .sticky__right { display:flex; gap:8px; }

        /* Sticky bottom Save bar */
        .submitbar {
          position: sticky;
          bottom: 0;
          z-index: 70;
          background: rgba(255,255,255,.98);
          border-top: 1px solid var(--line);
          box-shadow: 0 -4px 10px rgba(2,6,23,.06);
          padding: 10px 0;
        }
        .submitbar__inner {
          max-width: 880px;
          margin: 0 auto;
          padding: 0 12px;
          display: flex;
          justify-content: center;
        }
        .lbl { display:grid; gap:6px; font-weight:700; }
        .lbl--tight { font-weight:700; margin-bottom:4px; }
      `}</style>
    </main>
  );
}
