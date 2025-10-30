"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

type TickerRow = {
  id: string;
  message: string;
  category: string | null;
  active: boolean;
  created_at: string;
};

export default function TickerAdminPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TickerRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newCategory, setNewCategory] = useState("Announcement");
  const [newActive, setNewActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // load existing ticker rows
  useEffect(() => {
    const load = async () => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from("news_ticker")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setRows((data || []) as TickerRow[]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleAdd = async () => {
    if (!supabase) return;
    if (!newMessage.trim()) return;

    setSaving(true);
    const { data, error } = await supabase
    .from("news_ticker")
    .insert([
      {
        message: newMessage.trim(),
        category: newCategory,
        active: newActive,
      },
    ])
    .select()
    .single();

    if (error) {
      setError(error.message);
    } else if (data) {
      // put new row at top
      setRows((prev) => [data as TickerRow, ...prev]);
      setNewMessage("");
      setNewActive(true);
    }
    setSaving(false);
  };

  const toggleActive = async (row: TickerRow) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("news_ticker")
      .update({ active: !row.active })
      .eq("id", row.id)
      .select()
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    if (data) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? (data as TickerRow) : r))
      );
    }
  };

  return (
    <main className="wrap">
      {/* Banner */}
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      {/* Header */}
      <header className="header">
        <h1>Mourne-oids News Ticker</h1>
        <p className="subtitle">
          Post area updates, service pushes, celebrations and urgent notes.
        </p>
        <div className="actions">
          <a href="/" className="btn btn--ghost">
            ← Back to Hub
          </a>
        </div>
      </header>

      {/* Add form */}
      <section className="card">
        <h2>Add ticker message</h2>
        <div className="form-row">
          <label>Message</label>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            rows={2}
            placeholder="e.g. Congratulations Kilkeel on your 4⭐ OER!"
          />
        </div>

        <div className="form-grid">
          <div>
            <label>Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            >
              <option value="Announcement">Announcement</option>
              <option value="Service Push">Service Push</option>
              <option value="Ops">Ops</option>
              <option value="Celebration">Celebration</option>
              <option value="Warning">Warning</option>
            </select>
          </div>
          <div className="toggle-row">
            <label>Active</label>
            <input
              type="checkbox"
              checked={newActive}
              onChange={(e) => setNewActive(e.target.checked)}
            />
          </div>
          <div className="btn-cell">
            <button
              onClick={handleAdd}
              disabled={saving || !newMessage.trim()}
            >
              {saving ? "Saving…" : "Add message"}
            </button>
          </div>
        </div>

        {error && <p className="error">⚠️ {error}</p>}
      </section>

      {/* List */}
      <section className="card">
        <h2>Current messages</h2>
        {loading ? (
          <p>Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">No messages yet.</p>
        ) : (
          <ul className="ticker-list">
            {rows.map((row) => (
              <li key={row.id} className={row.active ? "active" : "inactive"}>
                <div className="row-top">
                  <span className="category">{row.category || "General"}</span>
                  <button onClick={() => toggleActive(row)}>
                    {row.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
                <p className="msg">{row.message}</p>
                <p className="ts">
                  {new Date(row.created_at).toLocaleString("en-GB")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="footer">
        <p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>

      <style jsx>{`
        .wrap {
          background: #f2f5f9;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-bottom: 40px;
        }
        .banner {
          width: 100%;
          background: #fff;
          border-bottom: 3px solid #006491;
          display: flex;
          justify-content: center;
          box-shadow: 0 10px 18px rgba(2, 6, 23, 0.08);
        }
        .banner img {
          max-width: 92%;
        }
        .header {
          text-align: center;
          margin: 24px 16px 8px;
        }
        .header h1 {
          font-size: 26px;
          font-weight: 900;
        }
        .subtitle {
          color: #475569;
        }
        .actions {
          margin-top: 8px;
        }
        .btn.btn--ghost {
          display: inline-block;
          background: #fff;
          border: 2px solid #006491;
          color: #006491;
          padding: 4px 14px;
          border-radius: 12px;
          font-weight: 600;
          text-decoration: none;
        }
        .card {
          background: #fff;
          width: min(900px, 94vw);
          margin-top: 18px;
          border-radius: 14px;
          box-shadow: 0 10px 18px rgba(2, 6, 23, 0.04);
          padding: 16px 18px 20px;
        }
        .card h2 {
          font-size: 18px;
          margin-bottom: 12px;
        }
        .form-row {
          margin-bottom: 14px;
        }
        label {
          display: block;
          font-weight: 600;
          margin-bottom: 4px;
        }
        textarea {
          width: 100%;
          border-radius: 10px;
          border: 1px solid #d4dbe3;
          padding: 8px;
          font-size: 0.9rem;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.6fr 0.5fr;
          gap: 12px;
          align-items: end;
        }
        select {
          width: 100%;
          border-radius: 10px;
          border: 1px solid #d4dbe3;
          padding: 6px 8px;
        }
        .toggle-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .btn-cell button {
          width: 100%;
          background: #006491;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 8px 0;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-cell button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .error {
          color: #b91c1c;
          margin-top: 12px;
        }
        .ticker-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 10px;
        }
        .ticker-list li {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 12px;
          background: #f8fafc;
        }
        .ticker-list li.active {
          border-color: #006491;
        }
        .row-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .row-top button {
          background: transparent;
          border: 1px solid #006491;
          color: #006491;
          border-radius: 999px;
          padding: 3px 10px;
          font-size: 0.7rem;
          cursor: pointer;
        }
        .category {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          color: #006491;
        }
        .msg {
          margin: 6px 0 4px;
          font-weight: 600;
        }
        .ts {
          font-size: 0.65rem;
          color: #94a3b8;
        }
        .footer {
          margin-top: 24px;
          color: #94a3b8;
          font-size: 0.8rem;
        }
        @media (max-width: 720px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
