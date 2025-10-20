"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET = "pizza-of-the-week";

type Pic = { name: string; url: string };

export default function PizzaOfTheWeekPage() {
  const [pics, setPics] = React.useState<Pic[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      // List files at the root of the bucket
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list("", {
          limit: 50,
          offset: 0,
          sortBy: { column: "name", order: "asc" },
        });

      if (error) {
        setErr(error.message);
        setPics([]);
        setLoading(false);
        return;
      }

      const files = (data ?? []).filter((f) =>
        /\.(png|jpg|jpeg|webp)$/i.test(f.name)
      );

      // Build public URLs
      const urls: Pic[] = files.map((f) => {
        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET).getPublicUrl(f.name);
        return { name: f.name, url: publicUrl };
      });

      setPics(urls);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="wrap">
      {/* Banner */}
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <section className="container">
        <div className="topbar">
          <a href="/" className="btn btn--ghost">Home</a>
        </div>

        <h1>Pizza of the Week</h1>

        <div className="card">
          {loading ? (
            <div className="empty">Loading…</div>
          ) : err ? (
            <div className="empty">
              Couldn’t read bucket: <strong>{BUCKET}</strong>
              <br />
              <small className="muted">{err}</small>
            </div>
          ) : pics.length === 0 ? (
            <div className="empty">
              Nothing uploaded yet. Add PNG/JPG files to the “{BUCKET}” bucket.
            </div>
          ) : (
            <div className="gallery">
              {pics.map((p) => (
                <figure key={p.name} className="shot">
                  <img src={p.url} alt={p.name} />
                  <figcaption>{p.name}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Styles (reuse Hub look) */}
      <style jsx>{`
        :root {
          --bg: #f2f5f9;
          --paper: #ffffff;
          --text: #0f172a;
          --muted: #475569;
          --brand: #006491;
          --brand-dark: #004b75;
          --line: #e5e7eb;
          --shadow-card: 0 10px 18px rgba(2, 6, 23, 0.08),
            0 1px 3px rgba(2, 6, 23, 0.06);
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
          background: #fff;
          border-bottom: 3px solid var(--brand);
          box-shadow: var(--shadow-card);
          width: 100%;
        }
        .banner img { max-width: 92%; height: auto; display: block; }

        .container { max-width: 880px; margin: 0 auto; padding: 16px; }

        .topbar { display:flex; justify-content:flex-end; margin: 8px 0 10px; }

        h1 {
          text-align: center;
          font-size: 24px;
          font-weight: 900;
          margin: 6px 0 14px;
        }

        .card {
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 16px;
          box-shadow: var(--shadow-card);
        }

        .empty {
          text-align: center;
          color: var(--muted);
          padding: 40px 16px;
          font-size: 16px;
        }
        .muted { color: var(--muted); }

        .gallery {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        }
        .shot {
          border: 1px solid var(--line);
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
          box-shadow: var(--shadow-card);
        }
        .shot img {
          width: 100%;
          height: 260px;
          object-fit: cover;
          display: block;
        }
        .shot figcaption {
          padding: 8px 10px;
          font-size: 13px;
          color: var(--muted);
          border-top: 1px solid var(--line);
        }

        /* Buttons to match Hub/Walkthrough */
        .btn {
          display: inline-block;
          text-align: center;
          padding: 10px 14px;
          border-radius: 14px;
          font-weight: 800;
          font-size: 15px;
          text-decoration: none;
          border: 2px solid var(--brand-dark);
          box-shadow: var(--shadow-card);
          transition: background 0.2s, transform 0.1s;
        }
        .btn--ghost {
          background: #fff;
          color: var(--text);
        }
        .btn--ghost:hover { transform: translateY(-1px); }
      `}</style>
    </main>
  );
}
