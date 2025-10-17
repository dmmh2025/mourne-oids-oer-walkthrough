"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type FileObj = {
  name: string;
  id?: string;
  updated_at?: string;
  created_at?: string;
  metadata?: any;
};

async function listAll(prefix = ""): Promise<{ path: string; file: FileObj }[]> {
  // Breadth-first traversal of folders in the bucket
  const queue: string[] = [prefix];
  const out: { path: string; file: FileObj }[] = [];

  while (queue.length) {
    const p = queue.shift()!;
    const { data, error } = await supabase.storage.from("memomailer").list(p, {
      limit: 1000,
      sortBy: { column: "updated_at", order: "desc" },
    });
    if (error || !data) continue;

    for (const entry of data) {
      // Folders have no '.' and are marked as type 'folder' internally
      const isFolder = !entry.name.includes(".") && (entry as any).id === undefined;
      if (isFolder) {
        queue.push(p ? `${p}/${entry.name}` : entry.name);
      } else {
        const path = p ? `${p}/${entry.name}` : entry.name;
        out.push({ path, file: entry });
      }
    }
  }
  return out;
}

export default function MemoMailerPage() {
  const [url, setUrl] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState<string>("");

  React.useEffect(() => {
    (async () => {
      try {
        // 1) Try root/latest.pdf for the simple workflow
        const latest = supabase.storage.from("memomailer").getPublicUrl("latest.pdf");
        if (latest?.data?.publicUrl) {
          // We can’t HEAD the file here easily; just try to use it first.
          setUrl(latest.data.publicUrl);
          setFileName("latest.pdf");
          setLoading(false);
          return;
        }

        // 2) Otherwise, recursively list everything and pick newest PDF
        const all = await listAll("");
        // Filter PDFs only (optional—remove this if you want any newest file)
        const pdfs = all.filter((f) => f.path.toLowerCase().endsWith(".pdf"));

        if (pdfs.length) {
          const newest = [...pdfs].sort((a, b) => {
            const da =
              new Date(a.file.updated_at || a.file.created_at || 0).getTime() || 0;
            const db =
              new Date(b.file.updated_at || b.file.created_at || 0).getTime() || 0;
            return db - da;
          })[0];

          const full = supabase.storage.from("memomailer").getPublicUrl(newest.path);
          setUrl(full.data.publicUrl);
          setFileName(newest.path);
        } else {
          setUrl(null);
          setNote(
            "No PDF found. Upload a file to the 'memomailer' bucket (root or any folder)."
          );
        }
      } catch (e) {
        setUrl(null);
        setNote("Could not list the bucket. Check bucket name and public access.");
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
            <p className="hint">
              Tip: upload a file named <code>latest.pdf</code> to update this page
              without changing links.
            </p>
          </div>
        ) : (
          <div className="card empty">
            <strong>No memomailer to show.</strong>
            <p>{note}</p>
            <ol>
              <li>Bucket name must be <code>memomailer</code>.</li>
              <li>Set bucket to <b>public</b> (or use signed URLs).</li>
              <li>Upload your PDF (root or any folder). Optional: call it <code>latest.pdf</code>.</li>
            </ol>
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
        .hint { color:#6b7280; margin-top:10px; font-size:13px; }

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
