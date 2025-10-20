"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

/** Supabase browser client */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Change this only if your bucket name is different
const BUCKET = "pizza-of-the-week";
// Optional: if you place files in a subfolder, e.g. "current/", set PREFIX = "current"
const PREFIX = ""; // keep "" when files are in root of the bucket

type FileObj = {
  name: string;
  updated_at?: string;
};

export default function PizzaOfTheWeekPage() {
  const [imgs, setImgs] = React.useState<{ url: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      // List the bucket contents at the given prefix ("" for root)
      const { data, error } = await supabase.storage.from(BUCKET).list(PREFIX, {
        limit: 100, // up to 100 files
      });

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      const files = (data || []) as FileObj[];

      // Accept png/jpg/jpeg in any case
      const imageFiles = files.filter((f) => {
        const n = f.name.toLowerCase();
        return n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg");
      });

      // sort by updated_at desc if present, otherwise by name desc
      imageFiles.sort((a, b) => {
        const au = a.updated_at ? Date.parse(a.updated_at) : 0;
        const bu = b.updated_at ? Date.parse(b.updated_at) : 0;
        if (au !== bu) return bu - au;
        return b.name.localeCompare(a.name);
      });

      // Build public URLs
      const items = imageFiles.map((f) => {
        const path = PREFIX ? `${PREFIX}/${f.name}` : f.name;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return { name: f.name, url: pub?.publicUrl || "" };
      });

      setImgs(items);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="wrap">
      {/* Sticky top bar with Home btn for consistency */}
      <div className="sticky">
        <div className="sticky__inner">
          <div />
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
        <h1>Pizza of the Week</h1>

        {loading && (
          <div className="card" style={{ textAlign: "center" }}>Loading…</div>
        )}

        {!loading && err && (
          <div className="card" style={{ color: "#b91c1c" }}>
            Error: {err}
          </div>
        )}

        {!loading && !err && imgs.length === 0 && (
          <div className="card" style={{ textAlign: "center" }}>
            Nothing uploaded yet. Add PNG/JPG files to the “{BUCKET}” bucket{PREFIX ? ` under “${PREFIX}”` : ""}.
          </div>
        )}

        {!loading && !err && imgs.length > 0 && (
          <div className="grid">
            {imgs.map((img) => (
              <figure key={img.name} className="card thumb">
                <img src={img.url} alt={img.name} />
                <figcaption className="cap">{img.name}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        :root {
          --bg: #f2f5f9;
          --paper: #ffffff;
          --line: #e5e7eb;
          --muted: #6b7280;
          --text: #0f172a;
          --brand: #006491;
          --brand-dk: #00517a;
          --shadow-card: 0 10px 18px rgba(2,6,23,.08), 0 1px 3px rgba(2,6,23,.06);
        }

        .wrap { background: var(--bg); min-height: 100dvh; color: var(--text); }
        .sticky {
          position: sticky; top: 0; z-index: 60;
          backdrop-filter: saturate(180%) blur(6px);
          background: rgba(255,255,255,.92);
          border-bottom: 1px solid var(--line);
          box-shadow: 0 2px 10px rgba(2,6,23,.06);
        }
        .sticky__inner {
          max-width: 980px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; padding: 8px 12px;
        }
        .btn {
          display: inline-block;
          text-align: center;
          padding: 10px 14px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 16px;
          text-decoration: none;
          color: #fff;
          background: var(--brand);
          border: 2px solid var(--brand-dk);
          box-shadow: var(--shadow-card);
        }
        .btn--ghost { background:#fff; color: var(--text); }

        .banner {
          display:flex; justify-content:center; align-items:center;
          padding:6px 0 10px; border-bottom:3px solid var(--brand);
          background:#fff; box-shadow: var(--shadow-card);
        }
        .banner img { max-width:92%; height:auto; display:block; }

        .container { max-width:880px; margin:0 auto; padding:16px; }
        h1 { font-size:22px; margin:14px 0 16px; text-align:center; font-weight:800; }

        .card {
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 14px;
          box-shadow: var(--shadow-card);
        }

        .grid {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        }
        .thumb {
          padding: 10px;
          display: grid;
          gap: 8px;
        }
        .thumb img {
          width: 100%; height: 200px; object-fit: cover;
          border-radius: 12px; border: 1px solid var(--line);
        }
        .cap {
          font-size: 12px; color: var(--muted); text-align: center;
          word-break: break-word;
        }
      `}</style>
    </main>
  );
}
