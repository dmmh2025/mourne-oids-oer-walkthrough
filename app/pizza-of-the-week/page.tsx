"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

/** Browser Supabase client */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Obj = { name: string; created_at?: string | null };

export default function PizzaOfTheWeekPage() {
  const [urls, setUrls] = React.useState<string[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from("pizza-of-the-week")
        .list("", { limit: 100 });

      if (error) {
        console.error(error);
        setUrls([]);
        setLoading(false);
        return;
      }

      const sorted = (data as Obj[]).slice().sort((a, b) => {
        // Newest first – prefer created_at, fall back to name
        const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (ad !== bd) return bd - ad;
        return (b.name || "").localeCompare(a.name || "");
      });

      const top2 = sorted.slice(0, 2);
      const urls2 = top2
        .map((o) => supabase.storage.from("pizza-of-the-week").getPublicUrl(o.name).data?.publicUrl)
        .filter(Boolean) as string[];

      setUrls(urls2);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="wrap">
      {/* Sticky header with Home button */}
      <div className="sticky">
        <div className="sticky__inner">
          <div className="sticky__left">
            <span className="chip chip--blue">Pizza of the Week</span>
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
        <h1>Pizza of the Week</h1>

        <div className="card card--raised">
          {loading && <div className="muted">Loading…</div>}

          {!loading && (!urls || urls.length === 0) && (
            <div className="muted">No pizza uploaded yet. (Upload images to the “pizza-of-the-week” bucket.)</div>
          )}

          {!loading && urls && urls.length > 0 && (
            <div className="gridImgs">
              {urls.map((u, i) => (
                <div key={i} className="shot">
                  <img src={u} alt={`Pizza of the Week ${i + 1}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <style jsx>{`
        :root {
          --bg:#f2f5f9; --paper:#fff; --line:#e5e7eb; --muted:#6b7280; --text:#0f172a;
          --brand:#006491; --brand-dk:#00517a; --blue:#e6f0fb;
          --shadow-strong:0 14px 28px rgba(2,6,23,.1),0 2px 6px rgba(2,6,23,.06);
          --shadow-card:0 10px 18px rgba(2,6,23,.08),0 1px 3px rgba(2,6,23,.06);
        }
        .wrap{background:var(--bg);min-height:100dvh;color:var(--text);}
        .banner{display:flex;justify-content:center;align-items:center;padding:6px 0 10px;border-bottom:3px solid var(--brand);background:#fff;box-shadow:var(--shadow-card);}
        .banner img{max-width:92%;height:auto;display:block;}
        .container{max-width:880px;margin:0 auto;padding:16px;}
        h1{font-size:22px;margin:14px 0 12px;text-align:center;font-weight:800;letter-spacing:.2px;}
        .card{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px;box-shadow:var(--shadow-card);}
        .card--raised{box-shadow:var(--shadow-strong);}
        .muted{color:var(--muted);}
        .gridImgs{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));}
        .shot{border:2px solid #d7dbe3;border-radius:14px;overflow:hidden;background:#f8fafc;}
        .shot img{display:block;width:100%;height:auto;object-fit:cover;}
        .chip{display:inline-block;padding:6px 10px;border-radius:999px;border:1px solid var(--line);background:#fff;font-size:13px;font-weight:800;}
        .chip--blue{background:var(--blue);}
        .btn{background:#fff;border:2px solid #d7dbe3;padding:10px 14px;border-radius:12px;font-weight:800;}
        .btn--ghost{background:#fff;}
        .sticky{position:sticky;top:0;z-index:60;backdrop-filter:saturate(180%) blur(6px);background:rgba(255,255,255,.92);border-bottom:1px solid var(--line);box-shadow:0 2px 10px rgba(2,6,23,.06);}
        .sticky__inner{max-width:980px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;}
        .sticky__left{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
      `}</style>
    </main>
  );
}
