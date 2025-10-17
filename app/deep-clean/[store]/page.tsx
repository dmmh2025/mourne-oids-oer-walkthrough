"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

/* ---------- Supabase (browser) ---------- */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ---------- Types ---------- */
type Item = { label: string; done: boolean; by: string; photos: string[] };
type Section = { title: string; items: Item[] };
type Row = { id?: number; store: string; items: Section[]; updated_at?: string };

/* ---------- Helpers ---------- */
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

/** Calculate % complete */
function calcPct(sections: Section[] | null | undefined) {
  if (!sections?.length) return 0;
  const flat = sections.flatMap((s) => s.items || []);
  const total = flat.length || 0;
  const done = flat.filter((i) => i?.done).length;
  return total ? Math.round((done / total) * 100) : 0;
}

/** Provide a blank template if store has no saved row yet (headings only).
 *  You can expand this with your actual checklist structure if you like. */
const DEFAULT_TEMPLATE: Section[] = [
  { title: "Front of House", items: [] },
  { title: "Makeline & Prep", items: [] },
  { title: "Oven & Baking", items: [] },
  { title: "Walk-in / Storage", items: [] },
  { title: "Back of House", items: [] },
];

export default function DeepCleanStorePage({
  params,
}: {
  params: { store: string };
}) {
  const router = useRouter();
  const storeParam = params.store; // e.g. "downpatrick"
  // Normalise to your canonical store names
  const storeName =
    storeParam.toLowerCase() === "kilkeel"
      ? "Kilkeel"
      : storeParam.toLowerCase() === "newcastle"
      ? "Newcastle"
      : "Downpatrick";

  const [row, setRow] = React.useState<Row | null>(null);
  const [sections, setSections] = React.useState<Section[]>([]);
  const [open, setOpen] = React.useState<boolean[]>([]);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [note, setNote] = React.useState<string>("");

  /* ---------- Load existing row for this store ---------- */
  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setNote("");
      const { data, error } = await supabase
        .from("deep_clean_submissions")
        .select("*")
        .eq("store", storeName)
        .maybeSingle();

      if (error) {
        setNote(`Load error: ${error.message}`);
        setRow(null);
        setSections(DEFAULT_TEMPLATE);
        setOpen(DEFAULT_TEMPLATE.map(() => true));
      } else if (!data) {
        // brand-new store row
        const fresh: Row = { store: storeName, items: DEFAULT_TEMPLATE };
        setRow(fresh);
        setSections(fresh.items);
        setOpen(fresh.items.map(() => true));
      } else {
        // Coerce photos arrays
        const fixedItems: Section[] = (data.items || []).map((sec: Section) => ({
          ...sec,
          items: (sec.items || []).map((it) => ({
            ...it,
            photos: Array.isArray(it.photos) ? it.photos : [],
            by: typeof it.by === "string" ? it.by : "",
          })),
        }));
        setRow({ ...data, items: fixedItems });
        setSections(fixedItems);
        setOpen(fixedItems.map(() => true));
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeName]);

  /* ---------- Expand/Collapse controls ---------- */
  const setAll = (val: boolean) => setOpen(sections.map(() => val));
  const toggleSection = (idx: number) =>
    setOpen((prev) => prev.map((o, i) => (i === idx ? !o : o)));

  /* ---------- Photo uploads ---------- */
  async function handleUpload(si: number, ii: number, files: FileList | null) {
    if (!files || files.length === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const secSlug = slug(sections[si].title);
    const itemSlug = slug(sections[si].items[ii].label);
    const newUrls: string[] = [];

    for (let n = 0; n < files.length; n++) {
      const f = files[n];
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${storeName}/${today}/${secSlug}/${itemSlug}_${Date.now()}_${n}.${ext}`;

      // Upload to deep-clean bucket
      const { error: upErr } = await supabase.storage
        .from("deep-clean")
        .upload(path, f, { upsert: false });

      if (upErr) {
        alert(`Upload failed: ${upErr.message}`);
        return;
      }

      const { data: pub } = supabase.storage
        .from("deep-clean")
        .getPublicUrl(path);
      if (pub?.publicUrl) newUrls.push(pub.publicUrl);
    }

    // Update local state with new URLs
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

  /* ---------- Save / Submit ---------- */
  async function saveProgress() {
    setSaving(true);
    setNote("");
    const payload: Row = {
      store: storeName,
      items: sections,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("deep_clean_submissions")
      .upsert(payload, { onConflict: "store" });

    setSaving(false);
    if (error) {
      setNote(`Save failed: ${error.message}`);
      alert(`Save failed: ${error.message}`);
    } else {
      alert("Progress saved ✅");
      // Re-fetch to refresh updated_at and any triggers
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

  /* ---------- UI ---------- */
  return (
    <main className="wrap">
      {/* Sticky score bar (like Walkthrough) */}
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

        {note && (
          <div className="card" style={{ borderColor: "#f59e0b" }}>
            {note}
          </div>
        )}

        {loading ? (
          <div className="card">Loading…</div>
        ) : (
          <>
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
                          {/* Checkbox + label */}
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

                          {/* Name for this check */}
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

                          {/* Photo upload */}
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
                      {sec.items.length === 0 && (
                        <div className="check check--alt">
                          <em className="muted">No items in this section yet.</em>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Top Save button (optional) */}
            <div className="controls">
              <button
                type="button"
                className="btn btn--brand"
                onClick={saveProgress}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Progress"}
              </button>
            </div>
          </>
        )}
      </section>

      {/* Sticky bottom submit bar (matches Walkthrough) */}
      <div className="submitbar">
        <div className="submitbar__inner">
          <button
            className="btn btn--brand btn--lg"
            type="button"
            onClick={saveProgress}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Progress"}
          </button>
        </div>
      </div>

      {/* Styles (copied to match Walkthrough) */}
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
          --blue: #e6f0fb;
          --teal: #e6fbf6;
          --gold: #fff6e0;
          --shadow-strong: 0 14px 28px rgba(2,6,23,.1), 0 2px 6px rgba(2,6,23,.06);
          --shadow-card: 0 10px 18px rgba(2,6,23,.08), 0 1px 3px rgba(2,6,23,.06);
        }
        .wrap { background: var(--bg); min-height: 100dvh; color: var(--text); }
        .banner { display:flex; justify-content:center; align-items:center; padding:6px 0 10px; border-bottom:3px solid var(--brand); background:#fff; box-shadow: var(--shadow-card); }
        .banner img { max-width:92%; height:auto; display:block; }
        .container { max-width:880px; margin:0 auto; padding:16px; }
        h1 { font-size:20px; margin:14px 0 12px; text-align:center; font-weight:800; letter-spacing:.2px; }
        .stack { display:grid; gap:16px; }
        .card { background:var(--paper); border:1px solid var(--line); border-radius:14px; padding:14px; box-shadow:var(--shadow-card); }
        .card--section { padding:0; overflow:hidden; border:1px solid #d8dee7; box-shadow:var(--shadow-strong); }
        .grid { display:grid; gap:12px; }
        .controls { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
        .muted { color:var(--muted); }

        /* Section header */
        .section__head { display:grid; grid-template-columns:8px 1fr auto; align-items:center; gap:12px; padding:14px 14px; background:linear-gradient(90deg,#ffffff,#f7fbff); border-bottom:1px solid #dde3ec; }
        .section__badge { width:8px; height:100%; background:linear-gradient(#0ea5e9,#006491); border-radius:0 6px 6px 0; }
        .section__titlewrap { display:grid; gap:2px; }
        .section__title { font-weight:900; letter-spacing:.2px; }
        .section__sub { color:var(--muted); font-size:13px; }
        .section__chips { display:flex; gap:8px; align-items:center; }

        /* Checks */
        .checks { display:grid; }
        .check { padding:12px; border-top:1px solid #edf0f5; background:#ffffff; }
        .check--alt { background:#fafcff; }
        .check__row { display:grid; grid-template-columns:28px 1fr; gap:10px; align-items:start; }
        .bigbox { width:20px; height:20px; transform:scale(1.15); accent-color:var(--brand); margin-top:2px; }
        .check__label { display:flex; align-items:start; gap:8px; flex-wrap:wrap; }
        .check__text { font-weight:700; line-height:1.3; }

        /* Inputs */
        .inlinegrid { display:grid; gap:10px; margin-top:8px; }
        .lbl { display:grid; gap:6px; font-weight:700; }
        .lbl--tight { font-weight:700; margin-bottom:4px; }
        input[type="text"], input[type="number"], select {
          border:2px solid #d7dbe3; border-radius:12px; padding:12px 14px; outline:none; font-size:16px; background:#fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
        }
        input:focus, select:focus { border-color:var(--brand); box-shadow:0 0 0 4px rgba(0,100,145,0.15); }

        /* Upload thumbnails */
        .upload { margin-top:10px; display:grid; gap:8px; }
        .thumbs { display:grid; grid-template-columns:repeat(auto-fill, minmax(90px,1fr)); gap:10px; }
        .thumb { position:relative; border:2px solid #dde3ec; border-radius:12px; overflow:hidden; background:#f8fafc; box-shadow: inset 0 1px 0 rgba(255,255,255,.6); }
        .thumb img { display:block; width:100%; height:90px; object-fit:cover; }
        .thumb__remove { position:absolute; top:6px; right:6px; background:#111827dd; color:#fff; border:none; border-radius:8px; width:26px; height:26px; line-height:25px; text-align:center; font-size:16px; }

        /* Buttons (match Walkthrough) */
        .btn { background:#fff; border:3px solid var(--brand); padding:10px 14px; border-radius:12px; font-weight:800; color:var(--brand); box-shadow:var(--shadow-card); transition: all .15s ease-in-out; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; }
        .btn:hover { background: var(--brand); color:#fff; transform: translateY(-1px); }
        .btn--brand { background:var(--brand); color:#fff; border-color: var(--brand-dk); }
        .btn--brand:hover { background: var(--brand-dk); }
        .btn--ghost { background:#fff; }

        /* Sticky top */
        .sticky { position:sticky; top:0; z-index:60; backdrop-filter:saturate(180%) blur(6px); background:rgba(255,255,255,.92); border-bottom:1px solid var(--line); box-shadow:0 2px 10px rgba(2,6,23,.06); }
        .sticky__inner { max-width:980px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 12px; }
        .sticky__left { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
        .sticky__right { display:flex; gap:8px; }

        /* Chips */
        .chip { display:inline-block; padding:6px 10px; border-radius:999px; border:1px solid var(--line); background:#fff; font-size:13px; font-weight:800; box-shadow:0 1px 0 rgba(255,255,255,.8); }
        .chip--blue { background:#e6f0fb; }
        .chip--teal { background:#e6fbf6; }
        .chip--gold { background:#fff6e0; }

        /* Sticky bottom submit bar */
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
      `}</style>
    </main>
  );
}
