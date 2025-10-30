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
  return isNaN(m) ? null : m;
}

export default function AdminPage() {
  // Gate
  const [enteredPassword, setEnteredPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  // 🔹 Tabs — added memomailer
  const [activeTab, setActiveTab] = useState<
    "ticker" | "service" | "memomailer"
  >("ticker");

  // --- TICKER STATE ---
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TickerRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newCategory, setNewCategory] = useState("Announcement");
  const [newActive, setNewActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // --- SERVICE STATE (unchanged) ---
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

  // 🔹 NEW: MemoMailer upload state
  const [memoFile, setMemoFile] = useState<File | null>(null);
  const [memoMsg, setMemoMsg] = useState<string | null>(null);
  const [memoSaving, setMemoSaving] = useState(false);

  // Load ticker
  useEffect(() => {
    const load = async () => {
      if (!isAuthed || !supabase) return;
      const { data, error } = await supabase
        .from("news_ticker")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      else setRows((data || []) as TickerRow[]);
      setLoading(false);
    };
    load();
  }, [isAuthed]);

  // Auth
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ADMIN_PASSWORD || enteredPassword === ADMIN_PASSWORD) {
      setIsAuthed(true);
      setAuthError("");
    } else setAuthError("Incorrect password");
  };

  // --- Ticker handlers (unchanged) ---
  const handleAdd = async () => {
    if (!supabase || !newMessage.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("news_ticker")
      .insert([{ message: newMessage.trim(), category: newCategory, active: newActive }])
      .select();
    if (error) setError(error.message);
    else if (data && data.length > 0)
      setRows((prev) => [data[0] as TickerRow, ...prev]);
    setNewMessage("");
    setNewActive(true);
    setSaving(false);
  };

  const toggleActive = async (row: TickerRow) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("news_ticker")
      .update({ active: !row.active })
      .eq("id", row.id)
      .select();
    if (!error && data && data.length > 0)
      setRows((p) => p.map((r) => (r.id === row.id ? data[0] : r)));
  };

  // --- Service helpers (unchanged) ---
  const handleDateChange = (val: string) => {
    setSvcDate(val);
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const days = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        setSvcDayName(days[d.getDay()]);
      }
    }
  };

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
    setServiceMsg(
      error ? `Upload failed: ${error.message}` : "✅ Shift saved to service_shifts."
    );
    if (!error) resetServiceFields();
    setServiceSaving(false);
  };

  // 🔹 MemoMailer upload
  const handleMemoUpload = async () => {
    if (!supabase || !memoFile) {
      setMemoMsg("Please pick a PDF first.");
      return;
    }
    setMemoSaving(true);
    const { error } = await supabase.storage
      .from("memomailer")
      .upload("memomailer-latest.pdf", memoFile, {
        upsert: true,
        contentType: "application/pdf",
      });
    setMemoMsg(
      error ? "❌ Upload failed: " + error.message : "✅ MemoMailer updated successfully!"
    );
    setMemoSaving(false);
  };

  return (
    <main className="wrap">
      <div className="banner">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Banner" />
      </div>

      {!isAuthed ? (
        <>
          {/* unchanged password design */}
          <header className="header">
            <h1>Mourne-oids Admin</h1>
            <p className="subtitle">This page is restricted to Mourne-oids management.</p>
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
                No password set in <code>NEXT_PUBLIC_TICKER_PASSWORD</code> — allowing access.
              </p>
            )}
            <a href="/" className="btn btn--ghost">← Back to Hub</a>
          </section>
        </>
      ) : (
        <>
          <header className="header">
            <h1>Mourne-oids Admin</h1>
            <p className="subtitle">Ticker · Service · MemoMailer</p>
            <div className="actions">
              <a href="/" className="btn btn--ghost">← Back to Hub</a>
            </div>
          </header>

          {/* tabs */}
          <div className="tabs">
            <button className={activeTab === "ticker" ? "tab active" : "tab"} onClick={() => setActiveTab("ticker")}>📰 Ticker</button>
            <button className={activeTab === "service" ? "tab active" : "tab"} onClick={() => setActiveTab("service")}>📊 Service Data Upload</button>
            <button className={activeTab === "memomailer" ? "tab active" : "tab"} onClick={() => setActiveTab("memomailer")}>📬 MemoMailer Upload</button>
          </div>

          {/* keep your original ticker + service sections */}
          {activeTab === "ticker" && (
            <>
              {/* existing ticker management code here */}
            </>
          )}

          {activeTab === "service" && (
            <>
              {/* existing service upload form here */}
            </>
          )}

          {activeTab === "memomailer" && (
            <section className="card">
              <h2>Upload latest MemoMailer PDF</h2>
              <p className="muted">
                This will overwrite <code>memomailer/memomailer-latest.pdf</code> in Supabase.
              </p>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setMemoFile(e.target.files?.[0] || null)}
                style={{ marginTop: "12px" }}
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
    </main>
  );
}
