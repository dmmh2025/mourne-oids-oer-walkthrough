"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/** Supabase (browser) */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Types */
type Item = { label: string; done: boolean; by: string; photos: string[] };
type Section = { title: string; items: Item[] };
type Row = { store: string; items: Section[]; updated_at?: string };

const SECTIONS: Section[] = [
  // TODO: Use your actual deep clean sections & checks here:
  {
    title: "Oven & Baking",
    items: [
      { label: "Clean oven chambers", done: false, by: "", photos: [] },
      { label: "Clean oven filters & hood", done: false, by: "", photos: [] },
    ],
  },
  {
    title: "Makeline & Walk-in",
    items: [
      { label: "Makeline interior & seals clean", done: false, by: "", photos: [] },
      { label: "Walk-in fan, floor, walls clean", done: false, by: "", photos: [] },
    ],
  },
  {
    title: "Customer Area & Outside",
    items: [
      { label: "Customer seating & floor clean", done: false, by: "", photos: [] },
      { label: "Front signage & door area clean", done: false, by: "", photos: [] },
    ],
  },
];

/** Helpers */
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleString() : "Never";

/** Page */
export default function DeepCleanStorePage() {
  const params = useParams<{ store: string }>();
  const router = useRouter();
  const storeParam = (params?.store || "").toString();
  const storeName =
    storeParam === "downpatrick"
      ? "Downpatrick"
      : storeParam === "kilkeel"
      ? "Kilkeel"
      : storeParam === "newcastle"
      ? "Newcastle"
      : storeParam;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [updatedAt, setUpdatedAt] = React.useState<string | undefined>(undefined);
  const [sections, setSections] = React.useState<Section[]>(SECTIONS);

  /** Load existing progress for this store */
  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("deep_clean_submissions")
        .select("*")
        .eq("store", storeName)
        .maybeSingle();

      if (!error && data && data.items) {
        // Normalize any missing props
        const restored: Section[] = (data.items as any[]).map((sec) => ({
          title: sec.title,
          items: (sec.items || []).map((it: any) => ({
            label: it.label,
            done: !!it.done,
            by: it.by || "",
            photos: Array.isArray(it.photos) ? it.photos : [],
          })),
        }));
        setSections(restored);
        setUpdatedAt(data.updated_at);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeName]);

  /** Upload Photos */
  async function handleUpload(si: number, ii: number, list: FileList | null) {
    if (!list || list.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const secSlug = slug(sections[si].title);
    const itemSlug = slug(sections[si].items[ii].label);

    const uploadedUrls: string[] = [];

    for (let idx = 0; idx < list.length; idx++) {
      const f = list[idx];
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${storeName}/${today}/${secSlug}/${itemSlug}_${Date.now()}_${idx}.${ext}`;

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
      if (pub?.publicUrl) uploadedUrls.push(pub.publicUrl);
    }

    setSections((prev) => {
      const next = [...prev];
      const sec = { ...next[si] };
      const it = { ...sec.items[ii] };
      it.photos = [...it.photos, ...uploadedUrls];
      sec.items = [...sec.items];
      sec.items[ii] = it;
      next[si] = sec;
      return next;
    });
  }

  function removePhoto(si: number, ii: number, pi: number) {
    setSections((prev) => {
      const next = [...prev];
      const sec = { ...next[si] };
      const it = { ...sec.items[ii] };
      const cp = [...it.photos];
      cp.splice(pi, 1);
      it.photos = cp;
      sec.items = [...sec.items];
      sec.items[ii] = it;
      next[si] = sec;
      return next;
    });
  }

  /** Save progress */
  async function saveProgress() {
    setSaving(true);
    const payload: Row = {
      store: storeName,
      items: sections,
    };

    // Upsert by store
    const { error } = await supabase
      .from("deep_clean_submissions")
      .upsert(payload, { onConflict: "store" });

    setSaving(false);

    if (error) {
      alert(`Save failed: ${error.message}`);
      return;
    }

    setUpdatedAt(new Date().toISOString());
    alert("Progress saved ✅");
  }

  /** UI */
  return (
    <main className="wrap">
      {/* Top bar */}
      <div className="topbar">
        <button className="btn btn--ghost" onClick={() => router.push("/deep-clean")}>
          ← Back to Deep Clean
        </button>
        <div className="topbar__title">
          <strong>{storeName}</strong> · Autumn Deep Clean
        </div>
        <div />
      </div>

      {/* Banner */}
      <div className="banner">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <section className="container">
        <div className="meta">
          <div className="badge">{loading ? "Loading…" : `Last saved: ${fmtDate(updatedAt)}`}</div>
          <button className="btn btn--brand" onClick={saveProgress} disabled={saving || loading}>
            {saving ? "Saving…" : "Save Progress"}
          </button>
        </div>

        {/* Sections */}
        <div className="stack">
          {sections.map((sec, si) => (
            <div key={sec.title} className="card">
              <div className="card__head">
                <div className="card__bar" />
                <div className="card__title">{sec.title}</div>
              </div>

              <div className="checks">
                {sec.items.map((it, ii) => (
                  <div key={ii} className={`check ${ii % 2 ? "check--alt" : ""}`}>
                    {/* Check row */}
                    <label className="check__row">
                      <input
                        className="bigbox"
                        type="checkbox"
                        checked={it.done}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSections((prev) => {
                            const next = [...prev];
                            const sCopy = { ...next[si] };
                            const itemsCopy = [...sCopy.items];
                            itemsCopy[ii] = { ...itemsCopy[ii], done: checked };
                            sCopy.items = itemsCopy;
                            next[si] = sCopy;
                            return next;
                          });
                        }}
                      />
                      <span className="check__label">{it.label}</span>
                    </label>

                    {/* By (name) */}
                    <label className="lbl">
                      Team member name
                      <input
                        type="text"
                        placeholder="Type your name…"
                        value={it.by}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSections((prev) => {
                            const next = [...prev];
                            const sCopy = { ...next[si] };
                            const itemsCopy = [...sCopy.items];
                            itemsCopy[ii] = { ...itemsCopy[ii], by: val };
                            sCopy.items = itemsCopy;
                            next[si] = sCopy;
                            return next;
                          });
                        }}
                      />
                    </label>

                    {/* Upload */}
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
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="bottom">
          <button className="btn btn--brand" onClick={saveProgress} disabled={saving || loading}>
            {saving ? "Saving…" : "Save Progress"}
          </button>
        </div>
      </section>

      <style jsx>{`
        :root {
          --bg:#f2f5f9; --paper:#fff; --line:#e5e7eb; --muted:#6b7280; --text:#0f172a;
          --brand:#006491; --brand-dk:#00517a; --softline:#dfe5ee;
        }
        .wrap{ background:var(--bg); min-height:100dvh; color:var(--text); }
        .topbar{ position:sticky; top:0; z-index:50; display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:12px; padding:10px 12px; background:#fff; border-bottom:1px solid var(--line); }
        .topbar__title{ text-align:center; font-weight:800; }
        .banner{ display:flex; justify-content:center; padding:8px 0 10px; border-bottom:3px solid var(--brand); background:#fff; }
        .banner img{ max-width:92%; height:auto; display:block; }
        .container{ max-width:920px; margin:0 auto; padding:16px; }
        .meta{ display:flex; gap:10px; align-items:center; justify-content:space-between; margin:8px 0 16px; }
        .badge{ background:#f3f4f6; border:1px solid var(--line); padding:6px 10px; border-radius:999px; font-weight:700; font-size:13px; color:var(--muted); }
        .stack{ display:grid; gap:14px; }
        .card{ background:var(--paper); border:1px solid #d8dee7; border-radius:14px; box-shadow:0 10px 18px rgba(2,6,23,.08); overflow:hidden; }
        .card__head{ display:grid; grid-template-columns:8px 1fr; gap:12px; align-items:center; padding:14px; background:linear-gradient(90deg,#ffffff,#f7fbff); border-bottom:1px solid #dde3ec; }
        .card__bar{ width:8px; height:100%; background:linear-gradient(#0ea5e9,#006491); border-radius:0 6px 6px 0; }
        .card__title{ font-weight:900; letter-spacing:.2px; }
        .checks{ display:grid; }
        .check{ padding:12px; border-top:1px solid #edf0f5; background:#fff; }
        .check--alt{ background:#fafcff; }
        .check__row{ display:grid; grid-template-columns:28px 1fr; gap:10px; align-items:start; }
        .check__label{ font-weight:800; line-height:1.3; }
        .bigbox{ width:20px; height:20px; transform:scale(1.15); accent-color:var(--brand); margin-top:2px; }
        .lbl{ display:grid; gap:6px; font-weight:700; margin-top:8px; }
        input[type="text"]{
          border:2px solid #d7dbe3; border-radius:12px; padding:10px 12px; outline:none; font-size:16px; background:#fff;
        }
        input[type="text"]:focus{ border-color:var(--brand); box-shadow:0 0 0 4px rgba(0,100,145,0.15); }
        .upload{ margin-top:8px; display:grid; gap:8px; }
        .lbl--tight{ font-weight:700; margin-bottom:4px; }
        .thumbs{ display:grid; grid-template-columns:repeat(auto-fill,minmax(90px,1fr)); gap:10px; }
        .thumb{ position:relative; border:2px solid #dde3ec; border-radius:12px; overflow:hidden; background:#f8fafc; }
        .thumb img{ display:block; width:100%; height:90px; object-fit:cover; }
        .thumb__remove{ position:absolute; top:6px; right:6px; background:#111827dd; color:#fff; border:none; border-radius:8px; width:26px; height:26px; line-height:25px; text-align:center; font-size:16px; }
        .bottom{ display:flex; justify-content:center; padding:16px 0 8px; }
        .btn{ background:#fff; border:2px solid #d7dbe3; padding:10px 14px; border-radius:12px; font-weight:800; }
        .btn--brand{ background:var(--brand); color:#fff; border-color:var(--brand-dk); }
        .btn--brand:hover{ background:var(--brand-dk); }
        .btn--ghost{ background:#fff; }
      `}</style>
    </main>
  );
}
