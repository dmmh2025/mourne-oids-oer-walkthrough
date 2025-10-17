"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type FileObj = {
  name: string;
  updated_at?: string;
  created_at?: string;
  metadata?: any;
};

export default function MemoMailerPage() {
  const [url, setUrl] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        // List files in the memomailer bucket (root)
        const { data: files, error: listErr } = await supabase
          .storage
          .from("memomailer")
          .list("", { limit: 1000 });

        if (listErr) throw listErr;
        const list = (files || []) as FileObj[];

        // Prefer latest.pdf if present
        const hasLatest = list.some(f => f.name === "latest.pdf");
        if (hasLatest) {
          const latest = supabase.storage.from("memomailer").getPublicUrl("latest.pdf");
          setUrl(latest.data.publicUrl);
          setFileName("latest.pdf");
          setLoading(false);
          return;
        }

        // Fallback to newest by updated_at/created_at
        if (list.length > 0) {
          const sorted = [...list].sort((a, b) => {
            const da = new Date(a.updated_at || a.created_at || 0).getTime();
            const db = new Date(b.updated_at || b.created_at || 0).getTime();
            return db - da;
          });
          const newest = sorted[0];
          const full = supabase.storage.from("memomailer").getPublicUrl(newest.name);
          setUrl(full.data.publicUrl);
          setFileName(newest.name);
        } else {
          setUrl(null);
        }
      } catch {
        setUrl(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="wrap">
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <section className="container">
        <div className="row">
          <a href="/" className="btn btn--ghost">⬅ Back</a>
          <h1>Weekly Memomailer</h1>
          <div />
        </div>

        {loading ? (
          <div className="card">Loading…</div>
        ) : url ? (
          <div className="card">
            <div className="toolbar">
              <div className="title">📄 {fileName}</div>
              <div className="actions">
                <a href={url} target="_blank" rel="noopener noreferrer" className="btn">
                  Open in new tab
                </a>
                <a href={url} download className="btn btn--brand">
                  Download PDF
                </a>
              </div>
            </div>
            <div className="viewer">
              <iframe title="Memomailer" src={url} />
            </div>
          </div>
        ) : (
          <div className="card empty">
            <strong>No memomailer uploaded yet.</strong>
            <p>
              Upload a PDF to the public bucket <code>memomailer</code> as{" "}
              <code>latest.pdf</code> (or any file name—this page uses the newest).
            </p>
          </div>
        )}
      </section>

      <style jsx>{`
        :root {
          --brand: #006491;
          --brand-dk: #004c70;
          --bg: #f4f7fa;
          --paper: #ffffff;
          --text: #1b1b1b;
          --line: #e5e7eb;
          --shadow: 0 12px 25px rgba(0,0,0,.08);
        }
        .wrap { background: var(--bg); min-height: 100dvh; color: var(--text); }
        .banner {
          display:flex; justify-content:center; align-items:center;
          padding:8px 0 10px; background:#fff; border-bottom:4px solid var(--brand);
          box-shadow: 0 4px 10px rgba(0,0,0,.04);
        }
        .banner img { max-width:92%; height:auto; display:block; }
        .container { max-width: 1100px; margin: 0 auto; padding: 20px 12px; display: grid; gap: 14px; }
        .row { display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; }
        h1 { margin:0; text-align:center; font-size:22px; font-weight:900; }
        .card {
          background: var(--paper); border:1px solid var(--line); border-radius:14px; padding: 12px;
          box-shadow: var(--shadow);
        }
        .empty { text-align:center; }
        .toolbar {
          display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 6px 10px;
          border-bottom:1px solid var(--line);
        }
        .title { font-weight:800; }
        .actions { display:flex; gap:8px; flex-wrap:wrap; }
        .viewer { height: 75vh; }
        .viewer iframe { width:100%; height:100%; border:0; background:#fff; }

        .btn {
          display:inline-flex; align-items:center; justify-content:center;
          font-size:14px; font-weight:800; text-decoration:none;
          padding:10px 14px; border-radius:12px; background:#fff;
          border:3px solid var(--brand); color: var(--brand); box-shadow: var(--shadow);
          transition: all .15s ease-in-out;
        }
        .btn:hover { background: var(--brand); color:#fff; transform: translateY(-1px); }
        .btn--brand { background: var(--brand); color:#fff; border-color: var(--brand-dk); }
        .btn--brand:hover { background: var(--brand-dk); }
        .btn--ghost { border-color: var(--brand); color: var(--brand); background:#fff; }
      `}</style>
    </main>
  );
}
