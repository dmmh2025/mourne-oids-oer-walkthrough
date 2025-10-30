
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

// turn "05:19" into minutes
function timeTextToMinutes(val: string): number | null {
  if (!val) return null;
  if (!val.includes(":")) {
    const num = Number(val);
    return isNaN(num) ? null : num;
  }
  const [mm, ss] = val.split(":");
  const m = Number(mm);
  const s = Number(ss);
  if (isNaN(m)) return null;
  if (isNaN(s)) return m;
  // you store minutes, so s is ignored
  return m;
}

export default function AdminPage() {
  // gate
  const [enteredPassword, setEnteredPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  // 🚨 original had only "ticker" | "service"
  // we add "memomailer" but keep the default as "ticker"
  const [activeTab, setActiveTab] = useState<
    "ticker" | "service" | "memomailer"
  >("ticker");

  // ticker state
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TickerRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newCategory, setNewCategory] = useState("Announcement");
  const [newActive, setNewActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // service form state — EXACT column names
  const [svcDate, setSvcDate] = useState<string>("");
  const [svcDayName, setSvcDayName] = useState<string>("");
  const [svcStore, setSvcStore] = useState<string>("Downpatrick");
  const [forecastSales, setForecastSales] = useState<string>("");
  const [actualSales, setActualSales] = useState<string>("");
  const [labourPct, setLabourPct] = useState<string>("");
  const [additionalHours, setAdditionalHours] = useState<string>("");
  const [openingManager, setOpeningManager] = useState<string>("");
  const [closingManager, setClosingManager] = useState<string>("");
  const [instoresScheduled, setInstoresScheduled] = useState<string>("");
  const [actualInstores, setActualInstores] = useState<string>("");
  const [driversScheduled, setDriversScheduled] = useState<string>("");
  const [actualDrivers, setActualDrivers] = useState<string>("");
  const [dotPct, setDotPct] = useState<string>("");
  const [extremesPct, setExtremesPct] = useState<string>("");
  const [sbrPct, setSbrPct] = useState<string>("");
  const [rnlText, setRnlText] = useState<string>("");
  const [foodVariance, setFoodVariance] = useState<string>("");

  const [serviceMsg, setServiceMsg] = useState<string | null>(null);
  const [serviceSaving, setServiceSaving] = useState(false);

  // ✅ NEW: memomailer state (only this)
  const [memoFile, setMemoFile] = useState<File | null>(null);
  const [memoMsg, setMemoMsg] = useState<string | null>(null);
  const [memoSaving, setMemoSaving] = useState(false);

  // load ticker rows when authed
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

  // TICKER: add
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
      .select(); // ← no .single()

    if (error) {
      setError(error.message);
    } else if (data && data.length > 0) {
      setRows((prev) => [data[0] as TickerRow, ...prev]);
      setNewMessage("");
      setNewActive(true);
    }
    setSaving(false);
  };

  // TICKER: toggle
  const toggleActive = async (row: TickerRow) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("news_ticker")
      .update({ active: !row.active })
      .eq("id", row.id)
      .select(); // ← IMPORTANT: no .single()

    if (error) {
      setError(error.message);
      return;
    }

    if (data && data.length > 0) {
      const updated = data[0] as TickerRow;
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    }
  };

  // SERVICE: when date changes, fill day_name
  const handleDateChange = (val: string) => {
    setSvcDate(val);
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const longNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        setSvcDayName(longNames[d.getDay()]);
      }
    }
  };

  // SERVICE: clear metric fields
  const resetServiceFields = () => {
    setForecastSales("");
    setActualSales("");
    setLabourPct("");
    setAdditionalHours("");
    setOpeningManager("");
    setClosingManager("");
    setInstoresScheduled("");
    setActualInstores("");
    setDriversScheduled("");
    setActualDrivers("");
    setDotPct("");
    setExtremesPct("");
    setSbrPct("");
    setRnlText("");
    setFoodVariance("");
  };

  // SERVICE: submit — uses YOUR real column names
  const handleServiceSubmit = async () => {
    if (!supabase) return;
    setServiceMsg(null);

    if (!svcDate || !svcStore) {
      setServiceMsg("Please pick a date and store.");
      return;
    }

    setServiceSaving(true);

    const rnlMinutes = timeTextToMinutes(rnlText);

    const payload = {
      shift_date: svcDate,
      day_name: svcDayName || null,
      store: svcStore,
      forecast_sales: forecastSales ? Number(forecastSales) : null,
      actual_sales: actualSales ? Number(actualSales) : null,
      labour_pct: labourPct ? Number(labourPct) : null,
      additional_hours: additionalHours ? Number(additionalHours) : null,
      opening_manager: openingManager || null,
      closing_manager: closingManager || null,
      instores_scheduled: instoresScheduled ? Number(instoresScheduled) : null,
      actual_instores: actualInstores ? Number(actualInstores) : null,
      drivers_scheduled: driversScheduled ? Number(driversScheduled) : null,
      actual_drivers: actualDrivers ? Number(actualDrivers) : null,
      dot_pct: dotPct ? Number(dotPct) : null,
      extremes_pct: extremesPct ? Number(extremesPct) : null,
      sbr_pct: sbrPct ? Number(sbrPct) : null,
      rnl_minutes: rnlMinutes,
      food_variance_pct: foodVariance ? Number(foodVariance) : null,
      source_file: null,
    };

    const { error } = await supabase.from("service_shifts").insert([payload]);

    if (error) {
      setServiceMsg(`Upload failed: ${error.message}`);
      setServiceSaving(false);
      return;
    }

    setServiceMsg("✅ Shift saved to service_shifts.");
    resetServiceFields();
    setServiceSaving(false);
  };

  // ✅ MEMOMAILER: upload to storage
  const handleMemoUpload = async () => {
    if (!supabase) return;
    if (!memoFile) {
      setMemoMsg("Please choose a PDF first.");
      return;
    }
    setMemoSaving(true);
    const { error } = await supabase.storage
      .from("memomailer")
      .upload("memomailer-latest.pdf", memoFile, {
        upsert: true,
        cacheControl: "0",
        contentType: "application/pdf",
      });

    if (error) {
      setMemoMsg("❌ Upload failed: " + error.message);
    } else {
      setMemoMsg("✅ MemoMailer updated.");
    }
    setMemoSaving(false);
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
            {/* ✅ NEW TAB */}
            <button
              className={activeTab === "memomailer" ? "tab active" : "tab"}
              onClick={() => setActiveTab("memomailer")}
            >
              📬 MemoMailer Upload
            </button>
          </div>

          {activeTab === "ticker" ? (
            <>
              {/* Add ticker */}
              <section className="card">
                <h2>Add ticker message</h2>
                <div className="form-row">
                  <label>Message</label>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={2}
                    placeholder="e.g. Congratulations Kilkeel on 4⭐ OER!"
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
          ) : activeTab === "service" ? (
            <>
              {/* SERVICE FORM */}
              <section className="card">
                <h2>Upload service shift</h2>
                <p className="muted">
                  Writes directly into <code>service_shifts</code> using your
                  column names.
                </p>

                <div className="form-2col">
                  <div>
                    <label>Date</label>
                    <input
                      type="date"
                      value={svcDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Day name</label>
                    <input
                      type="text"
                      value={svcDayName}
                      onChange={(e) => setSvcDayName(e.target.value)}
                      placeholder="Wednesday"
                    />
                  </div>
                  <div>
                    <label>Store</label>
                    <select
                      value={svcStore}
                      onChange={(e) => setSvcStore(e.target.value)}
                    >
                      <option>Downpatrick</option>
                      <option>Kilkeel</option>
                      <option>Newcastle</option>
                      <option>Ballynahinch</option>
                    </select>
                  </div>
                  <div>
                    <label>Forecast sales (£)</label>
                    <input
                      type="number"
                      value={forecastSales}
                      onChange={(e) => setForecastSales(e.target.value)}
                      placeholder="2200"
                    />
                  </div>
                  <div>
                    <label>Actual sales (£)</label>
                    <input
                      type="number"
                      value={actualSales}
                      onChange={(e) => setActualSales(e.target.value)}
                      placeholder="2315"
                    />
                  </div>
                  <div>
                    <label>Labour %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={labourPct}
                      onChange={(e) => setLabourPct(e.target.value)}
                      placeholder="24.5"
                    />
                  </div>
                  <div>
                    <label>Additional hours</label>
                    <input
                      type="number"
                      step="0.1"
                      value={additionalHours}
                      onChange={(e) => setAdditionalHours(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label>Opening manager</label>
                    <input
                      type="text"
                      value={openingManager}
                      onChange={(e) => setOpeningManager(e.target.value)}
                      placeholder="Stuart"
                    />
                  </div>
                  <div>
                    <label>Closing manager</label>
                    <input
                      type="text"
                      value={closingManager}
                      onChange={(e) => setClosingManager(e.target.value)}
                      placeholder="Hannah"
                    />
                  </div>
                  <div>
                    <label>Instores – scheduled</label>
                    <input
                      type="number"
                      value={instoresScheduled}
                      onChange={(e) => setInstoresScheduled(e.target.value)}
                      placeholder="5"
                    />
                  </div>
                  <div>
                    <label>Instores – actual</label>
                    <input
                      type="number"
                      value={actualInstores}
                      onChange={(e) => setActualInstores(e.target.value)}
                      placeholder="5"
                    />
                  </div>
                  <div>
                    <label>Drivers – scheduled</label>
                    <input
                      type="number"
                      value={driversScheduled}
                      onChange={(e) => setDriversScheduled(e.target.value)}
                      placeholder="4"
                    />
                  </div>
                  <div>
                    <label>Drivers – actual</label>
                    <input
                      type="number"
                      value={actualDrivers}
                      onChange={(e) => setActualDrivers(e.target.value)}
                      placeholder="4"
                    />
                  </div>
                  <div>
                    <label>DOT %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={dotPct}
                      onChange={(e) => setDotPct(e.target.value)}
                      placeholder="78"
                    />
                  </div>
                  <div>
                    <label>Extremes %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={extremesPct}
                      onChange={(e) => setExtremesPct(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label>SBR %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={sbrPct}
                      onChange={(e) => setSbrPct(e.target.value)}
                      placeholder="76"
                    />
                  </div>
                  <div>
                    <label>R & L (mm:ss)</label>
                    <input
                      type="text"
                      value={rnlText}
                      onChange={(e) => setRnlText(e.target.value)}
                      placeholder="05:19"
                    />
                  </div>
                  <div>
                    <label>Food variance %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={foodVariance}
                      onChange={(e) => setFoodVariance(e.target.value)}
                      placeholder="0.12"
                    />
                  </div>
                </div>

                <button
                  onClick={handleServiceSubmit}
                  disabled={serviceSaving}
                  className="upload-btn"
                >
                  {serviceSaving ? "Saving…" : "Save shift"}
                </button>

                {serviceMsg && (
                  <p className="muted" style={{ marginTop: 8 }}>
                    {serviceMsg}
                  </p>
                )}
              </section>
            </>
          ) : (
            // ✅ NEW MEMOMAILER SECTION
            <section className="card">
              <h2>Upload MemoMailer PDF</h2>
              <p className="muted">
                This will overwrite <code>memomailer-latest.pdf</code> in the
                <code> memomailer </code> bucket.
              </p>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setMemoFile(e.target.files?.[0] || null)}
                style={{ marginTop: 12 }}
              />
              <button
                onClick={handleMemoUpload}
                disabled={memoSaving}
                className="upload-btn"
              >
                {memoSaving ? "Uploading…" : "Upload PDF"}
              </button>
              {memoMsg && (
                <p className="muted" style={{ marginTop: 8 }}>
                  {memoMsg}
                </p>
              )}
            </section>
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
        select,
        input[type="text"],
        input[type="number"],
        input[type="date"] {
          width: 100%;
          border-radius: 10px;
          border: 1px solid #d4dbe3;
          padding: 6px 8px;
          font-size: 0.85rem;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.6fr 0.5fr;
          gap: 12px;
          align-items: end;
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
          margin-top: 14px;
        }
        .muted {
          color: #94a3b8;
          font-size: 0.8rem;
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
        .form-2col {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .footer {
          margin-top: 24px;
          color: #94a3b8;
          font-size: 0.8rem;
        }
        @media (max-width: 720px) {
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
