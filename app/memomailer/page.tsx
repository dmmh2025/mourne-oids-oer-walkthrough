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

type PickedFile = {
  path: string;
  file: FileObj | null; // may be null if we didn't look up metadata (e.g., root/latest.pdf early path)
  publicUrl: string;
  cacheKey: string; // used to bust caches and re-render iframe
  fileName: string;
};

/** Add a cache-busting query param using an ISO timestamp (updated_at preferred). */
function withCacheBuster(url: string, ver: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(ver)}`;
}

/** List all files (breadth-first) in memomailer bucket. */
async function listAll(prefix = ""): Promise<{ path: string; file: FileObj }[]> {
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
      // Supabase returns folders without an id; files have an id.
      const isFolder = !("id" in entry) || !entry.id;
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

/** Given a path like "foo/bar.pdf", fetch that folder listing and return the file metadata if present. */
async function getFileMeta(path: string): Promise<FileObj | null> {
  const lastSlash = path.lastIndexOf("/");
  const folder = lastSlash === -1 ? "" : path.slice(0, lastSlash);
  const name = lastSlash === -1 ? path : path.slice(lastSlash + 1);

  const { data, error } = await supabase.storage.from("memomailer").list(folder, {
    limit: 1000,
  });
  if (error || !data) return null;

  const match = data.find((e: any) => e?.name === name && e?.id);
  return (match as FileObj) || null;
}

/** Build a PickedFile with cache-busted URL and stable cacheKey for React re-render. */
function buildPickedFile(path: string, meta: FileObj | null): PickedFile {
  const base = supabase.storage.from("memomailer").getPublicUrl(path).data.publicUrl;
  const ver =
    meta?.updated_at ||
    meta?.created_at ||
    // fallback to now to ensure a fresh view if no metadata
    new Date().toISOString();

  const busted = withCacheBuster(base, ver);
  return {
    path,
    file: meta,
    publicUrl: busted,
    cacheKey: `${path}::${ver}`, // if ver changes, iframe key changes => re-render
    fileName: path,
  };
}

export default function MemoMailerPage() {
  const [picked, setPicked] = React.useState<PickedFile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState<string>("");

  const resolveLatest = React.useCallback(async () => {
    setLoading(true);
    setNote("");

    try {
      // Try the simple convention first: root/latest.pdf
      const conventionalPath = "latest.pdf";
      const latestBase = supabase.storage.from("memomailer").getPublicUrl(conventionalPath);

      if (latestBase?.data?.publicUrl) {
        // Look up metadata for updated_at so we can cache-bust properly
        const meta = await getFileMeta(conventionalPath);

        if (meta) {
          setPicked(buildPickedFile(conventionalPath, meta));
          setLoading(false);
          return;
        }
        // If for some reason we couldn't read metadata, still show it with a "now" cache-bust.
        setPicked(buildPickedFile(conventionalPath, null));
        setLoading(false);
        return;
      }

      // Fallback: recursively find the newest PDF anywhere in the bucket
      const all = await listAll("");
      const pdfs = all.filter((f) => f.path.toLowerCase().endsWith(".pdf"));

      if (pdfs.length) {
        const newest = [...pdfs].sort((a, b) => {
          const da =
            new Date(a.file.updated_at || a.file.created_at || 0).getTime() || 0;
          const db =
            new Date(b.file.updated_at || b.file.created_at || 0).getTime() || 0;
          return db - da;
        })[0];

        setPicked(buildPickedFile(newest.path, newest.file));
      } else {
        setPicked(null);
        setNote(
          "No PDF found. Upload a file to the 'memomailer' bucket (root or any folder)."
        );
      }
    } catch {
      setPicked(null);
      setNote("Could not list the bucket. Check bucket name and public access.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    resolveLatest();
  }, [resolveLatest]);

  const handleRefresh = async () => {
    // Re-fetch metadata for the currently selected path to pick up a fresh updated_at
    if (!picked) {
      await resolveLatest();
      return;
    }
    setLoading(true);
    try {
      const meta = await getFileMeta(picked.path);
      setPicked(buildPickedFile(picked.path, meta));
    } finally {
      setLoading(false);
    }
  };

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
        ) : picked ? (
          <div className="card">
            <div className="toolbar">
              <div className="title">📄 {picked.fileName}</div>
              <div className="actions">
                <button onClick={handleRefresh} className="btn" title="Recheck in Supabase">
                  Refresh
                </button>
                <a
                  href={picked.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                >
                  Open in new tab
                </a>
                <a href={picked.publicUrl} download className="btn btn--brand">
                  Download PDF
                </a>
              </div>
            </div>
            <div className="viewer">
              {/* key ensures React fully remounts iframe when updated_at changes */}
              <iframe key={picked.cacheKey} title="Memomailer" src={picked.publicUrl} />
            </div>
            <p className="hint">
              Tip: upload a file named <code>latest.pdf</code> to update this page
              without changing links. The viewer auto cache-busts using the file’s{" "}
              <code>updated_at</code>.
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
