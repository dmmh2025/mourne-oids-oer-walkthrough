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
  return m;
}

export default function AdminPage() {
  // gate
  const [enteredPassword, setEnteredPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  // 🔹 Tabs — now includes pizza
  const [activeTab, setActiveTab] = useState<
    "ticker" | "service" | "memomailer" | "pizza"
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

  // ✅ MEMOMAILER
  const [memoFile, setMemoFile] = useState<File | null>(null);
  const [memoMsg, setMemoMsg] = useState<string | null>(null);
  const [memoSaving, setMemoSaving] = useState(false);

  // ✅ NEW: PIZZA OF THE WEEK
  const [pizzaFiles, setPizzaFiles] = useState<FileList | null>(null);
  const [pizzaMsg, setPizzaMsg] = useState<string | null>(null);
  const [pizzaSaving, setPizzaSaving] = useState(false);
  const [pizzaImages, setPizzaImages] = useState<string[]>([]);

  // load ticker
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

  // load pizza images
  useEffect(() => {
    const loadImages = async () => {
      if (!isAuthed || !supabase) return;
      const { data, error } = await supabase.storage
        .from("pizza-of-the-week")
        .list("", { sortBy: { column: "created_at", order: "desc" } });
      if (!error && data) {
        const urls = data.map(
          (f) =>
            supabase.storage
              .from("pizza-of-the-week")
              .getPublicUrl(f.name).data.publicUrl
        );
        setPizzaImages(urls);
      }
    };
    loadImages();
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

  // ✅ Ticker Add
  const handleAdd = async () => {
    if (!supabase || !newMessage.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("news_ticker")
      .insert([{ message: newMessage.trim(), category: newCategory, active: newActive }])
      .select();
    if (error) setError(error.message);
    else if (data?.length) setRows((prev) => [data[0] as TickerRow, ...prev]);
    setSaving(false);
    setNewMessage("");
    setNewActive(true);
  };

  // ✅ Toggle
  const toggleActive = async (row: TickerRow) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("news_ticker")
      .update({ active: !row.active })
      .eq("id", row.id)
      .select();
    if (!error && data?.length)
      setRows((p) => p.map((r) => (r.id === row.id ? data[0] as TickerRow : r)));
  };

  // ✅ Pizza upload & delete
  const handlePizzaUpload = async () => {
    if (!supabase || !pizzaFiles?.length)
      return setPizzaMsg("Please choose one or more images.");
    setPizzaSaving(true);
    const uploads = Array.from(pizzaFiles).map((file) =>
      supabase.storage.from("pizza-of-the-week").upload(file.name, file, { upsert: true })
    );
    const results = await Promise.all(uploads);
    const failed = results.find((r) => r.error);
    setPizzaMsg(failed ? "❌ One or more uploads failed." : "✅ Images uploaded!");
    setPizzaSaving(false);
  };

  const handleDeletePizza = async (fileName: string) => {
    if (!supabase) return;
    const { error } = await supabase.storage
      .from("pizza-of-the-week")
      .remove([fileName]);
    if (error) setPizzaMsg("❌ Delete failed: " + error.message);
    else {
      setPizzaMsg("🗑️ Image deleted.");
      setPizzaImages((prev) => prev.filter((url) => !url.includes(fileName)));
    }
  };

  // ✅ Service upload (same as your original)
  const handleServiceSubmit = async () => {
    if (!supabase) return;
    setServiceMsg(null);
    if (!svcDate || !svcStore) return setServiceMsg("Please pick a date and store.");
    setServiceSaving(true);
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
      rnl_minutes: timeTextToMinutes(rnlText),
      food_variance_pct: foodVariance ? Number(foodVariance) : null,
      source_file: null,
    };
    const { error } = await supabase.from("service_shifts").insert([payload]);
    setServiceMsg(error ? `Upload failed: ${error.message}` : "✅ Shift saved.");
    if (!error) {
      setForecastSales("");
      setActualSales("");
      setLabourPct("");
    }
    setServiceSaving(false);
  };

  // ✅ MemoMailer
  const handleMemoUpload = async () => {
    if (!supabase || !memoFile) return setMemoMsg("Please choose a PDF first.");
    setMemoSaving(true);
    const { error } = await supabase.storage
      .from("memomailer")
      .upload("memomailer-latest.pdf", memoFile, {
        upsert: true,
        cacheControl: "0",
        contentType: "application/pdf",
      });
    setMemoMsg(error ? "❌ Upload failed: " + error.message : "✅ MemoMailer updated.");
    setMemoSaving(false);
  };

  return (
    <main className="wrap">
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
            <p className="subtitle">This page is restricted to Mourne-oids management.</p>
          </header>
          <section className="card">
            <h2>Enter admin password</h2>
            <form onSubmit={handlePasswordSubmit} className="pw-form">
              <input type="password" value={enteredPassword} onChange={(e)=>setEnteredPassword(e.target.value)} placeholder="Enter password"/>
              <button type="submit">Unlock</button>
            </form>
            {authError && <p className="error">⚠️ {authError}</p>}
            <a href="/" className="btn btn--ghost">← Back to Hub</a>
          </section>
        </>
      ) : (
        <>
          <header className="header">
            <h1>Mourne-oids Admin</h1>
            <p className="subtitle">Ticker · Service · MemoMailer · Pizza</p>
            <div className="actions">
              <a href="/" className="btn btn--ghost">← Back to Hub</a>
            </div>
          </header>

          {/* Tabs */}
          <div className="tabs">
            <button className={activeTab==="ticker"?"tab active":"tab"} onClick={()=>setActiveTab("ticker")}>📰 Ticker</button>
            <button className={activeTab==="service"?"tab active":"tab"} onClick={()=>setActiveTab("service")}>📊 Service Data Upload</button>
            <button className={activeTab==="memomailer"?"tab active":"tab"} onClick={()=>setActiveTab("memomailer")}>📬 MemoMailer Upload</button>
            <button className={activeTab==="pizza"?"tab active":"tab"} onClick={()=>setActiveTab("pizza")}>🍕 Pizza of the Week Upload</button>
          </div>

          {/* --- Pizza of the Week --- */}
          {activeTab === "pizza" && (
            <section className="card">
              <h2>Pizza of the Week</h2>
              <p className="muted">Upload or remove the current Pizza of the Week images displayed on the Hub.</p>
              <input type="file" accept="image/*" multiple onChange={(e)=>setPizzaFiles(e.target.files)} style={{marginTop:12}} />
              <button onClick={handlePizzaUpload} disabled={pizzaSaving} className="upload-btn">
                {pizzaSaving?"Uploading…":"Upload Images"}
              </button>
              {pizzaMsg && <p className="muted" style={{marginTop:8}}>{pizzaMsg}</p>}
              <div style={{display:"flex",flexWrap:"wrap",gap:"10px",marginTop:"14px"}}>
                {pizzaImages.map((url)=>{
                  const name=url.split("/").pop()||"";
                  return (
                    <div key={url} style={{position:"relative",border:"1px solid #e2e8f0",borderRadius:"10px",overflow:"hidden",width:"150px",height:"150px",background:"#f8fafc"}}>
                      <img src={url} alt="Pizza" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      <button onClick={()=>handleDeletePizza(name)} style={{position:"absolute",top:"5px",right:"5px",background:"#b91c1c",color:"#fff",border:"none",borderRadius:"8px",fontSize:"0.7rem",padding:"2px 6px",cursor:"pointer"}}>Delete</button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* --- Ticker / Service / MemoMailer unchanged --- */}
          {/* (Keep your existing ticker, service, and memomailer sections here exactly as before) */}
        </>
      )}

      <footer className="footer">
        <p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>
    </main>
  );
}
