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

  // ✅ add "osa" tab
  const [activeTab, setActiveTab] = useState<
    "ticker" | "service" | "memomailer" | "pizza" | "osa"
  >("ticker");

  // ticker state
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TickerRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newCategory, setNewCategory] = useState("Announcement");
  const [newActive, setNewActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // =========================
  // SERVICE FORM STATE (NEW)
  // =========================
  const [svcWeek, setSvcWeek] = useState<string>("");
  const [svcDate, setSvcDate] = useState<string>("");
  const [svcDayName, setSvcDayName] = useState<string>("");
  const [svcStore, setSvcStore] = useState<string>("Downpatrick");

  const [labourPct, setLabourPct] = useState<string>("");
  const [additionalHours, setAdditionalHours] = useState<string>("");

  const [manager, setManager] = useState<string>("");

  const [dotPct, setDotPct] = useState<string>("");
  const [rnlText, setRnlText] = useState<string>("");

  const [extremeOver40, setExtremeOver40] = useState<string>("");
  const [foodPct, setFoodPct] = useState<string>("");

  const [serviceMsg, setServiceMsg] = useState<string | null>(null);
  const [serviceSaving, setServiceSaving] = useState(false);

  // =========================
  // INTERNAL OSA FORM STATE (NEW)
  // =========================
  const [osaDate, setOsaDate] = useState<string>("");
  const [osaStore, setOsaStore] = useState<string>("Downpatrick");
  const [osaTeamMember, setOsaTeamMember] = useState<string>("");
  const [osaStartingPoints, setOsaStartingPoints] = useState<string>("100");
  const [osaPointsLost, setOsaPointsLost] = useState<string>("0");
  const [osaStars, setOsaStars] = useState<string>("5");
  const [osaElite, setOsaElite] = useState<boolean>(false);

  const [osaMsg, setOsaMsg] = useState<string | null>(null);
  const [osaSaving, setOsaSaving] = useState<boolean>(false);

  // ✅ MEMOMAILER: state
  const [memoFile, setMemoFile] = useState<File | null>(null);
  const [memoMsg, setMemoMsg] = useState<string | null>(null);
  const [memoSaving, setMemoSaving] = useState(false);

  // ✅ PIZZA OF THE WEEK: state
  const [potwFiles, setPotwFiles] = useState<FileList | null>(null);
  const [potwMsg, setPotwMsg] = useState<string | null>(null);
  const [potwSaving, setPotwSaving] = useState(false);
  const [potwLoading, setPotwLoading] = useState(false);
  const [potwImages, setPotwImages] = useState<
    { name: string; id?: string }[]
  >([]);

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

  // load pizza-of-the-week images WHEN that tab is opened
  useEffect(() => {
    const loadPizza = async () => {
      if (!isAuthed) return;
      if (activeTab !== "pizza") return;
      if (!supabase) return;
      setPotwLoading(true);
      const { data, error } = await supabase.storage
        .from("pizza-of-the-week")
        .list("", {
          limit: 50,
        });
      if (error) {
        setPotwMsg("❌ Could not load images: " + error.message);
        setPotwImages([]);
      } else {
        setPotwImages((data || []).map((d) => ({ name: d.name })));
        setPotwMsg(null);
      }
      setPotwLoading(false);
    };
    loadPizza();
  }, [activeTab, isAuthed]);

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

  // SERVICE: clear metric fields (NEW)
  const resetServiceFields = () => {
    setSvcWeek("");
    setSvcDate("");
    setSvcDayName("");
    setSvcStore("Downpatrick");
    setLabourPct("");
    setAdditionalHours("");
    setManager("");
    setDotPct("");
    setRnlText("");
    setExtremeOver40("");
    setFoodPct("");
  };

  // SERVICE: submit (NEW FIELDS)
  const handleServiceSubmit = async () => {
    if (!supabase) return;
    setServiceMsg(null);

    if (!svcWeek || !svcDate || !svcStore) {
      setServiceMsg("Please enter Week, Date, and Store.");
      return;
    }
    if (!manager.trim()) {
      setServiceMsg("Please enter Manager.");
      return;
    }

    const weekNum = Number(svcWeek);
    if (!Number.isFinite(weekNum) || weekNum <= 0) {
      setServiceMsg("Week must be a valid number.");
      return;
    }

    setServiceSaving(true);

    const rnlMinutes = timeTextToMinutes(rnlText);

    const payload = {
      week: weekNum,
      shift_date: svcDate,
      day_name: svcDayName || null,
      store: svcStore,

      labour_pct: labourPct ? Number(labourPct) : null,
      additional_hours: additionalHours ? Number(additionalHours) : null,

      manager: manager.trim() || null,

      dot_pct: dotPct ? Number(dotPct) : null,
      rnl_minutes: rnlMinutes,

      // You confirmed "12 means 12%" so we store as 12 (dashboard can treat as percent)
      extreme_over_40: extremeOver40 ? Number(extremeOver40) : null,
      food_pct: foodPct ? Number(foodPct) : null,

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

  // INTERNAL OSA: reset
  const resetOsaFields = () => {
    setOsaDate("");
    setOsaStore("Downpatrick");
    setOsaTeamMember("");
    setOsaStartingPoints("100");
    setOsaPointsLost("0");
    setOsaStars("5");
    setOsaElite(false);
  };

  // INTERNAL OSA: submit (NEW)
  const handleOsaSubmit = async () => {
    if (!supabase) return;
    setOsaMsg(null);

    if (!osaDate || !osaStore || !osaTeamMember.trim()) {
      setOsaMsg("Please enter Date, Store, and Team member name.");
      return;
    }

    const starting = Number(osaStartingPoints);
    const lost = Number(osaPointsLost);

    if (!Number.isFinite(starting) || starting < 0) {
      setOsaMsg("Starting points must be a valid number (0+).");
      return;
    }
    if (!Number.isFinite(lost) || lost < 0) {
      setOsaMsg("Points lost must be a valid number (0+).");
      return;
    }

    const overall = Math.max(0, starting - lost);

    const stars = Number(osaStars);
    if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
      setOsaMsg("Stars must be 1–5. Use the Elite toggle for Elite.");
      return;
    }

    setOsaSaving(true);

    const payload = {
      shift_date: osaDate,
      team_member_name: osaTeamMember.trim(),
      store: osaStore,
      starting_points: starting,
      points_lost: lost,
      overall_points: overall,
      stars,
      is_elite: osaElite,
    };

    const { error } = await supabase.from("osa_internal_results").insert([payload]);

    if (error) {
      setOsaMsg("❌ Upload failed: " + error.message);
      setOsaSaving(false);
      return;
    }

    setOsaMsg("✅ Internal OSA result saved.");
    resetOsaFields();
    setOsaSaving(false);
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

  // ✅ PIZZA OF THE WEEK: upload images
  const handlePotwUpload = async () => {
    if (!supabase) return;
    if (!potwFiles || potwFiles.length === 0) {
      setPotwMsg("Please choose at least one image.");
      return;
    }
    setPotwSaving(true);
    let hadError = false;

    for (const file of Array.from(potwFiles)) {
      const fileName = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("pizza-of-the-week")
        .upload(fileName, file, {
          cacheControl: "0",
          upsert: false,
        });
      if (error) {
        hadError = true;
        setPotwMsg("❌ Upload failed: " + error.message);
        break;
      }
    }

    if (!hadError) {
      setPotwMsg("✅ Pizza of the Week images updated.");
      // refresh list
      const { data } = await supabase.storage
        .from("pizza-of-the-week")
        .list("", { limit: 50 });
      setPotwImages((data || []).map((d) => ({ name: d.name })));
      setPotwFiles(null);
    }

    setPotwSaving(false);
  };

  // ✅ PIZZA OF THE WEEK: delete image
  const handlePotwDelete = async (name: string) => {
    if (!supabase) return;
    const { error } = await supabase.storage
      .from("pizza-of-the-week")
      .remove([name]);
    if (error) {
      setPotwMsg("❌ Delete failed: " + error.message);
    } else {
      setPotwMsg("✅ Image deleted.");
      setPotwImages((prev) => prev.filter((img) => img.name !== name));
    }
  };

  const computedOsaOverall =
    Math.max(
      0,
      Number(osaStartingPoints || 0) - Number(osaPointsLost || 0)
    ) || 0;

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
            <button
              className={activeTab === "memomailer" ? "tab active" : "tab"}
              onClick={() => setActiveTab("memomailer")}
            >
              📬 MemoMailer Upload
            </button>
            <button
              className={activeTab === "pizza" ? "tab active" : "tab"}
              onClick={() => setActiveTab("pizza")}
            >
              🍕 Pizza of the Week
            </button>
            {/* ✅ NEW OSA TAB */}
            <button
              className={activeTab === "osa" ? "tab active" : "tab"}
              onClick={() => setActiveTab("osa")}
            >
              ⭐ Internal OSA
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
              {/* SERVICE FORM (UPDATED ONLY) */}
              <section className="card">
                <h2>Upload service shift</h2>
                <p className="muted">
                  Writes into <code>service_shifts</code> using the new service
                  fields.
                </p>

                <div className="form-2col">
                  <div>
                    <label>Week</label>
                    <input
                      type="number"
                      value={svcWeek}
                      onChange={(e) => setSvcWeek(e.target.value)}
                      placeholder="5"
                    />
                  </div>

                  <div>
                    <label>Date</label>
                    <input
                      type="date"
                      value={svcDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Day</label>
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
                    <label>Manager</label>
                    <input
                      type="text"
                      value={manager}
                      onChange={(e) => setManager(e.target.value)}
                      placeholder="Stuart"
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
                    <label>R &amp; L (mm:ss)</label>
                    <input
                      type="text"
                      value={rnlText}
                      onChange={(e) => setRnlText(e.target.value)}
                      placeholder="05:19"
                    />
                  </div>

                  <div>
                    <label>Extreme &gt;40 mins (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={extremeOver40}
                      onChange={(e) => setExtremeOver40(e.target.value)}
                      placeholder="12"
                    />
                  </div>

                  <div>
                    <label>Food %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={foodPct}
                      onChange={(e) => setFoodPct(e.target.value)}
                      placeholder="25"
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
          ) : activeTab === "memomailer" ? (
            // ✅ MEMOMAILER SECTION (unchanged)
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
          ) : activeTab === "osa" ? (
            // ⭐ INTERNAL OSA SECTION (NEW)
            <section className="card">
              <h2>Submit Internal OSA result</h2>
              <p className="muted">
                Writes into <code>osa_internal_results</code>. Overall points are
                calculated as <b>starting points − points lost</b>. Use Elite
                toggle for Elite.
              </p>

              <div className="form-2col">
                <div>
                  <label>Date</label>
                  <input
                    type="date"
                    value={osaDate}
                    onChange={(e) => setOsaDate(e.target.value)}
                  />
                </div>

                <div>
                  <label>Store</label>
                  <select
                    value={osaStore}
                    onChange={(e) => setOsaStore(e.target.value)}
                  >
                    <option>Downpatrick</option>
                    <option>Kilkeel</option>
                    <option>Newcastle</option>
                    <option>Ballynahinch</option>
                  </select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label>Team member name</label>
                  <input
                    type="text"
                    value={osaTeamMember}
                    onChange={(e) => setOsaTeamMember(e.target.value)}
                    placeholder="e.g. Megan Jennings"
                  />
                </div>

                <div>
                  <label>Starting points</label>
                  <input
                    type="number"
                    value={osaStartingPoints}
                    onChange={(e) => setOsaStartingPoints(e.target.value)}
                    placeholder="100"
                  />
                </div>

                <div>
                  <label>Points lost</label>
                  <input
                    type="number"
                    value={osaPointsLost}
                    onChange={(e) => setOsaPointsLost(e.target.value)}
                    placeholder="20"
                  />
                </div>

                <div>
                  <label>Overall points (auto)</label>
                  <input type="number" value={computedOsaOverall} readOnly />
                </div>

                <div>
                  <label>Stars (1–5)</label>
                  <select
                    value={osaStars}
                    onChange={(e) => setOsaStars(e.target.value)}
                  >
                    <option value="1">1 star</option>
                    <option value="2">2 stars</option>
                    <option value="3">3 stars</option>
                    <option value="4">4 stars</option>
                    <option value="5">5 stars</option>
                  </select>
                </div>

                <div className="toggle-row">
                  <label>Elite</label>
                  <input
                    type="checkbox"
                    checked={osaElite}
                    onChange={(e) => setOsaElite(e.target.checked)}
                  />
                </div>
              </div>

              <button
                onClick={handleOsaSubmit}
                disabled={osaSaving}
                className="upload-btn"
              >
                {osaSaving ? "Saving…" : "Save internal OSA"}
              </button>

              {osaMsg && (
                <p className="muted" style={{ marginTop: 8 }}>
                  {osaMsg}
                </p>
              )}
            </section>
          ) : (
            // 🍕 PIZZA OF THE WEEK SECTION
            <section className="card">
              <h2>Pizza of the Week images</h2>
              <p className="muted">
                Upload 1–2 images to the <code>pizza-of-the-week</code> storage
                bucket. These will be shown on the public PotW page.
              </p>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setPotwFiles(e.target.files)}
                style={{ marginTop: 12 }}
              />
              <button
                onClick={handlePotwUpload}
                disabled={potwSaving}
                className="upload-btn"
              >
                {potwSaving ? "Uploading…" : "Upload image(s)"}
              </button>
              {potwMsg && (
                <p className="muted" style={{ marginTop: 8 }}>
                  {potwMsg}
                </p>
              )}

              <h3 style={{ marginTop: 18, marginBottom: 8 }}>
                Current images
              </h3>
              {potwLoading ? (
                <p className="muted">Loading images…</p>
              ) : potwImages.length === 0 ? (
                <p className="muted">No images in bucket.</p>
              ) : (
                <ul className="ticker-list">
                  {potwImages.map((img) => (
                    <li key={img.name}>
                      <div className="row-top">
                        <span className="category">{img.name}</span>
                        <button onClick={() => handlePotwDelete(img.name)}>
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
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
          flex-wrap: wrap;
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
