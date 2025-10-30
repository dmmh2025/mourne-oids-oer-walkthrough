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

const ADMIN_PASSWORD =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_TICKER_PASSWORD || ""
    : "";

export default function TickerAdminPage() {
  // gate
  const [enteredPassword, setEnteredPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  // tabs
  const [activeTab, setActiveTab] = useState<"ticker" | "service">("ticker");

  // ticker data
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TickerRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newCategory, setNewCategory] = useState("Announcement");
  const [newActive, setNewActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // service upload data
  const [serviceText, setServiceText] = useState("");
  const [serviceUploading, setServiceUploading] = useState(false);
  const [serviceMsg, setServiceMsg] = useState<string | null>(null);

  // when authed, load ticker
  useEffect(() => {
    const load = async () => {
      if (!isAuthed) return;
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
  }, [isAuthed]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // if no password set in env, allow
    if (!ADMIN_PASSWORD) {
      setIsAuthed(true);
      return;
    }
    if (enteredPassword === ADMIN_PASSWORD) {
      setIsAuthed(true);
      setAuthError("");
    } else {
      setAuthError("Incorrect password");
    }
  };

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
      .select(); // return array

    if (error) {
      setError(error.message);
    } else if (data && data.length > 0) {
      setRows((prev) => [data[0] as TickerRow, ...prev]);
      setNewMessage("");
      setNewActive(true);
    }
    setSaving(false);
  };

  // FIXED: don't use .single()
  const toggleActive = async (row: TickerRow) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("news_ticker")
      .update({ active: !row.active })
      .eq("id", row.id)
      .select(); // returns array

    if (error) {
      setError(error.message);
      return;
    }

    if (data && data.length > 0) {
      const updated = data[0] as TickerRow;
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    }
  };

  // -------------- SERVICE UPLOAD --------------
  const handleServiceUpload = async () => {
    if (!supabase) return;
    if (!serviceText.trim()) {
      setServiceMsg("Nothing to upload.");
      return;
    }

    setServiceUploading(true);
    setServiceMsg(null);

    // each line = 1 row
    const lines = serviceText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // expected CSV order:
    // date,day,store,forecast_sales,actual_sales,labour_pct,additional_hours,opening_manager,closing_manager,instores_scheduled,instores_actual,drivers_scheduled,drivers_actual,dot,extremes,sbr,r_and_l,food_variance
    const toInsert: any[] = [];
    const skipped: string[] = [];

    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 3) {
        skipped.push(line);
        continue;
      }

      const [
        date,
        day,
        store,
        forecast_sales,
        actual_sales,
        labour_pct,
        additional_hours,
        opening_manager,
        closing_manager,
        instores_scheduled,
        instores_actual,
        drivers_scheduled,
        drivers_actual,
        dot,
        extremes,
        sbr,
        r_and_l,
        food_variance,
      ] = parts;

      if (!date || !store) {
        skipped.push(line);
        continue;
      }

      toInsert.push({
        date: date,
        day: day || null,
        store: store || null,
        forecast_sales: forecast_sales ? Number(forecast_sales) : null,
        actual_sales: actual_sales ? Number(actual_sales) : null,
        labour_pct: labour_pct ? Number(labour_pct) : null,
        additional_hours: additional_hours ? Number(additional_hours) : null,
        opening_manager: opening_manager || null,
        closing_manager: closing_manager || null,
        instores_scheduled: instores_scheduled
          ? Number(instores_scheduled)
          : null,
        instores_actual: instores_actual ? Number(instores_actual) : null,
        drivers_scheduled: drivers_scheduled
          ? Number(drivers_scheduled)
          : null,
        drivers_actual: drivers_actual ? Number(drivers_actual) : null,
        dot: dot ? Number(dot) : null,
        extremes: extremes ? Number(extremes) : null,
        sbr: sbr ? Number(sbr) : null,
        r_and_l: r_and_l || null,
        food_variance: food_variance ? Number(food_variance) : null,
      });
    }

    if (toInsert.length === 0) {
      setServiceMsg(
        `No valid rows found. Check your column order. Skipped ${skipped.length} lines.`
      );
      setServiceUploading(false);
      return;
    }

    // ✅ your actual table name
    const { error } = await supabase.from("service_shifts").insert(toInsert);

    if (error) {
      setServiceMsg(`Upload failed: ${error.message}`);
    } else {
      setServiceMsg(
        `Uploaded ${toInsert.length} rows. Skipped ${skipped.length}.`
      );
      setServiceText("");
    }

    setServiceUploading(false);
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

      {!isAuthed ? (
        <>
          <header className="header">
            <h1>Mourne-oids Admin</h1>
            <p className="subtitle">
              This page is restricted to Mourne-oids management.
            </p>
          </header>
          <section className="card">
            <h2>Enter admin password</h2>
            <form onSubmit={handlePasswordSubmit} className="pw-form">
              <input
                type="password"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                placeholder="Enter password"
              />
              <button type="submit">Unlock</button>
            </form>
            {authError && <p className="error">⚠️ {authError}</p>}
            {!ADMIN_PASSWORD && (
              <p className="muted">
                No password set in Vercel env{" "}
                <code>NEXT_PUBLIC_TICKER_PASSWORD</code> — allowing access.
              </p>
            )}
            <a href="/" className="btn btn--ghost">
              ← Back to Hub
            </a>
          </section>
        </>
      ) : (
        <>
          {/* Header */}
          <header className="header">
            <h1>Mourne-oids Admin</h1>
            <p className="subtitle">
              Ticker · Service dashboard uploads · future admin
            </p>
            <div className="actions">
              <a href="/" className="btn btn--ghost">
                ← Back to Hub
              </a>
            </div>
          </header>

          {/* Tabs */}
          <div className="tabs">
            <button
              className={activeTab === "ticker" ? "tab active" : "tab"}
              onClick={() => setActiveTab("ticker")}
            >
              📰 Ticker
            </button>
            <button
              className={activeTab === "service" ? "tab active" : "tab"}
              onClick={() => setActiveTab("service")}
            >
              📊 Service Data Upload
            </button>
          </div>

          {activeTab === "ticker" ? (
            <>
              {/* Add form */}
              <section className="card">
                <h2>Add ticker message</h2>
                <div className="form-row">
                  <label>Message</label>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={2}
                    placeholder="e.g. All stores staffed for 4pm 💪"
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
                      <li
                        key={row.id}
                        className={row.active ? "active" : "inactive"}
                      >
                        <div className="row-top">
                          <span className="category">
                            {row.category || "General"}
                          </span>
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
            </>
          ) : (
            <>
              {/* SERVICE UPLOAD */}
              <section className="card">
                <h2>Upload service dashboard data</h2>
                <p className="muted">
                  Paste CSV-style lines below. One line = one store/day. Expected
                  order:
                </p>
                <pre className="example">
{`date,day,store,forecast_sales,actual_sales,labour_pct,additional_hours,opening_manager,closing_manager,instores_scheduled,instores_actual,drivers_scheduled,drivers_actual,dot,extremes,sbr,r_and_l,food_variance

2025-10-30,Thu,Downpatrick,2200,2315,24.5,0,Stuart,Hannah,5,5,4,4,78,0,76,8:30,0.12
2025-10-30,Thu,Kilkeel,2400,2388,26.1,1,Harshil,,4,4,4,4,82,0,75,7:45,0.05
`}
                </pre>

                <textarea
                  value={serviceText}
                  onChange={(e) => setServiceText(e.target.value)}
                  rows={10}
                  placeholder="Paste your rows here..."
                />

                <button
                  onClick={handleServiceUpload}
                  disabled={serviceUploading}
                  className="upload-btn"
                >
                  {serviceUploading ? "Uploading…" : "Upload rows"}
                </button>

                {serviceMsg && <p className="muted">{serviceMsg}</p>}
                <p className="muted">
                  Inserting into <code>service_shifts</code>.
                </p>
              </section>
            </>
          )}
        </>
      )}

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
        .tabs {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .tab {
          background: #e2e8f0;
          border: none;
          border-radius: 999px;
          padding: 6px 16px;
          font-weight: 600;
          color: #0f172a;
          cursor: pointer;
        }
        .tab.active {
          background: #006491;
          color: #fff;
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
        .pw-form {
          display: flex;
          gap: 10px;
          margin-bottom: 14px;
        }
        .pw-form input {
          flex: 1;
          border: 1px solid #d4dbe3;
          border-radius: 10px;
          padding: 7px 10px;
        }
        .pw-form button {
          background: #006491;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 7px 14px;
          font-weight: 600;
          cursor: pointer;
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
        .btn-cell button,
        .upload-btn {
          width: 100%;
          background: #006491;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 8px 0;
          font-weight: 700;
          cursor: pointer;
        }
        .upload-btn {
          margin-top: 12px;
        }
        .error {
          color: #b91c1c;
          margin-top: 12px;
        }
        .muted {
          color: #94a3b8;
          font-size: 0.8rem;
          margin-top: 6px;
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
        .example {
          background: #0f172a;
          color: #e2e8f0;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 0.7rem;
          overflow-x: auto;
          margin-bottom: 10px;
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
          .pw-form {
            flex-direction: column;
            align-items: stretch;
          }
          .pw-form button {
            width: 100%;
          }
          .tabs {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </main>
  );
}
