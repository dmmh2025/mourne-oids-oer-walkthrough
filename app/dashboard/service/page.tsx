"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import HoverStatPanel from "@/components/HoverStatPanel";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STORES = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"];

type ShiftRow = {
  id: string;
  shift_date: string;
  day_name: string | null;
  store: string;
  labour_pct: number | null;
  additional_hours: number | null;
  opening_manager: string | null;
  closing_manager: string | null;
  manager?: string | null;
  dot_pct: number | null;
  extreme_over_40: number | null;
  rnl_minutes: number | null;
};

type DateRange = "yesterday" | "wtd" | "mtd" | "ytd" | "custom";

type ServiceHoverWindow = {
  dot: number | null; // 0..1
  extremes: number | null; // 0..1
  rnl: number | null; // minutes
  additionalHours: number; // sum
  shifts: number; // count
};

const normalisePct = (v: number | null) => {
  if (v == null || !Number.isFinite(v)) return null;
  return v > 1 ? v / 100 : v;
};

const normalizeRackLoad = (v: number | null) => {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  const raw = Number(v);
  const minutes = raw > 60 && raw <= 3600 ? raw / 60 : raw;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 60) return null;
  return minutes;
};

const avg = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

const getManagerName = (r: ShiftRow) => {
  const m = (r.manager || "").trim();
  return m || "Unknown";
};

/* ---------- UK date helpers (Europe/London) ---------- */
const isYYYYMMDD = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

const toISODateUK = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
};

const parseISODate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const startOfThisMonthUK = () => {
  const todayUk = toISODateUK(new Date());
  const [year, month] = todayUk.split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1);
};

const startOfThisYearUK = () => {
  const todayUk = toISODateUK(new Date());
  const [year] = todayUk.split("-").map(Number);
  return new Date(year || 1970, 0, 1);
};

const getTomorrowStartUK = () => {
  const tomorrow = parseISODate(toISODateUK(new Date()));
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
};

const inRange = (dateStr: string, from: Date, toExclusive: Date) => {
  if (!dateStr) return false;
  const probe = String(dateStr).slice(0, 10);
  if (!isYYYYMMDD(probe)) return false;

  const fromIso = toISODateUK(from);
  const toIsoExclusive = toISODateUK(toExclusive);
  return probe >= fromIso && probe < toIsoExclusive;
};

/* ---------- pills ---------- */
const pillClassFromDot = (v: number | null) => {
  if (v == null) return "pill";
  if (v >= 0.8) return "pill green";
  if (v >= 0.75) return "pill amber";
  return "pill red";
};

const pillClassFromExtremes = (v: number | null) => {
  if (v == null) return "pill";
  if (v <= 0.03) return "pill green";
  if (v <= 0.05) return "pill amber";
  return "pill red";
};

const pillClassFromRackLoad = (v: number | null) => {
  if (v == null) return "pill";
  if (v <= 10) return "pill green";
  if (v <= 20) return "pill amber";
  return "pill red";
};

/* ---------- hover stat calc ---------- */
const buildWindow = (rows: ShiftRow[]): ServiceHoverWindow => {
  const dotVals: number[] = [];
  const extVals: number[] = [];
  const rlVals: number[] = [];
  let addHours = 0;

  for (const r of rows) {
    const d = normalisePct(r.dot_pct);
    const e = normalisePct(r.extreme_over_40);
    const rl = normalizeRackLoad(r.rnl_minutes);

    if (d != null) dotVals.push(d);
    if (e != null) extVals.push(e);
    if (rl != null) rlVals.push(rl);

    if (typeof r.additional_hours === "number" && Number.isFinite(r.additional_hours)) {
      addHours += r.additional_hours;
    }
  }

  return {
    dot: avg(dotVals),
    extremes: avg(extVals),
    rnl: avg(rlVals),
    additionalHours: addHours,
    shifts: rows.length,
  };
};

export default function ServiceDashboardPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<"all" | string>("all");
  const [dateRange, setDateRange] = useState<DateRange>("wtd");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      // Pull YTD so hover panels can genuinely show YTD
      const yearStartIso = toISODateUK(startOfThisYearUK());

      const { data, error } = await supabase
        .from("service_shifts")
        .select("*")
        .gte("shift_date", yearStartIso)
        .order("shift_date", { ascending: false });

      if (error) setErrorMsg(error.message);
      else setRows((data || []) as ShiftRow[]);

      setLoading(false);
    };

    load();
  }, []);

  const dateFilteredRows = useMemo(() => {
    const now = new Date();

    if (dateRange === "yesterday") {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      return rows.filter((r) => r.shift_date === yStr);
    }

    if (dateRange === "wtd") {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      return rows.filter((r) => {
        const d = new Date(r.shift_date);
        return d >= monday && d <= now;
      });
    }

    if (dateRange === "mtd") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return rows.filter((r) => {
        const d = new Date(r.shift_date);
        return d >= first && d <= now;
      });
    }

    if (dateRange === "ytd") {
      const first = new Date(now.getFullYear(), 0, 1);
      return rows.filter((r) => {
        const d = new Date(r.shift_date);
        return d >= first && d <= now;
      });
    }

    if (dateRange === "custom") {
      if (!customFrom && !customTo) return rows;
      return rows.filter((r) => {
        const d = new Date(r.shift_date);
        if (customFrom) {
          const f = new Date(customFrom);
          f.setHours(0, 0, 0, 0);
          if (d < f) return false;
        }
        if (customTo) {
          const t = new Date(customTo);
          t.setHours(23, 59, 59, 999);
          if (d > t) return false;
        }
        return true;
      });
    }

    return rows;
  }, [rows, dateRange, customFrom, customTo]);

  const filteredRows = useMemo(() => {
    if (selectedStore === "all") return dateFilteredRows;
    return dateFilteredRows.filter((r) => r.store === selectedStore);
  }, [dateFilteredRows, selectedStore]);

  const areaKpis = useMemo(() => {
    const dotVals: number[] = [];
    const extVals: number[] = [];
    const rackLoadVals: number[] = [];
    let totalAddHours = 0;

    for (const r of filteredRows) {
      const dot = normalisePct(r.dot_pct);
      if (dot != null) dotVals.push(dot);
      const ext = normalisePct(r.extreme_over_40);
      if (ext != null) extVals.push(ext);
      const rl = normalizeRackLoad(r.rnl_minutes);
      if (rl != null) rackLoadVals.push(rl);
      if (typeof r.additional_hours === "number" && Number.isFinite(r.additional_hours)) {
        totalAddHours += r.additional_hours;
      }
    }

    return {
      avgDOT: avg(dotVals),
      avgExtremes: avg(extVals),
      avgRackLoad: avg(rackLoadVals),
      totalAddHours,
    };
  }, [filteredRows]);

  const storeData = useMemo(() => {
    const out = STORES.map((storeName) => {
      const rowsForStore = dateFilteredRows.filter((r) => r.store === storeName);
      const dot: number[] = [];
      const rackLoad: number[] = [];
      const ext: number[] = [];
      let totalAddHours = 0;

      for (const r of rowsForStore) {
        const d = normalisePct(r.dot_pct);
        const e = normalisePct(r.extreme_over_40);
        const rl = normalizeRackLoad(r.rnl_minutes);

        if (d != null) dot.push(d);
        if (rl != null) rackLoad.push(rl);
        if (e != null) ext.push(e);

        if (typeof r.additional_hours === "number" && Number.isFinite(r.additional_hours)) {
          totalAddHours += r.additional_hours;
        }
      }

      return {
        store: storeName,
        avgDOT: avg(dot),
        avgRackLoad: avg(rackLoad),
        avgExtremes: avg(ext),
        totalAddHours,
      };
    });

    out.sort((a, b) => {
      const aDot = a.avgDOT ?? -1;
      const bDot = b.avgDOT ?? -1;
      if (bDot !== aDot) return bDot - aDot;
      const aExt = a.avgExtremes ?? 999;
      const bExt = b.avgExtremes ?? 999;
      if (aExt !== bExt) return aExt - bExt;
      const aRL = a.avgRackLoad ?? 999999;
      const bRL = b.avgRackLoad ?? 999999;
      return aRL - bRL;
    });

    return out;
  }, [dateFilteredRows]);

  const managerData = useMemo(() => {
    const bucket: Record<
      string,
      {
        dot: number[];
        labour: number[];
        rackLoad: number[];
        ext: number[];
        totalAddHours: number;
        shifts: number;
      }
    > = {};

    for (const r of filteredRows) {
      const name = getManagerName(r);
      if (!bucket[name]) {
        bucket[name] = { dot: [], labour: [], rackLoad: [], ext: [], totalAddHours: 0, shifts: 0 };
      }

      bucket[name].shifts += 1;
      const d = normalisePct(r.dot_pct);
      const l = normalisePct(r.labour_pct);
      const e = normalisePct(r.extreme_over_40);
      const rl = normalizeRackLoad(r.rnl_minutes);

      if (d != null) bucket[name].dot.push(d);
      if (l != null) bucket[name].labour.push(l);
      if (rl != null) bucket[name].rackLoad.push(rl);
      if (e != null) bucket[name].ext.push(e);

      if (typeof r.additional_hours === "number" && Number.isFinite(r.additional_hours)) {
        bucket[name].totalAddHours += r.additional_hours;
      }
    }

    const arr = Object.entries(bucket).map(([name, v]) => ({
      name,
      shiftsWorked: v.shifts,
      avgDOT: avg(v.dot),
      avgLabour: avg(v.labour),
      avgRackLoad: avg(v.rackLoad),
      avgExtremes: avg(v.ext),
      totalAddHours: v.totalAddHours,
    }));

    arr.sort((a, b) => {
      const aDot = a.avgDOT ?? -1;
      const bDot = b.avgDOT ?? -1;
      if (bDot !== aDot) return bDot - aDot;
      const aExt = a.avgExtremes ?? 999;
      const bExt = b.avgExtremes ?? 999;
      if (aExt !== bExt) return aExt - bExt;
      const aRL = a.avgRackLoad ?? 999999;
      const bRL = b.avgRackLoad ?? 999999;
      if (aRL !== bRL) return aRL - bRL;
      return a.name.localeCompare(b.name);
    });

    return arr;
  }, [filteredRows]);

  /* ---------- Hover MTD/YTD maps (based on ALL rows, not the current filter) ---------- */
  const storeHover = useMemo(() => {
    const out: Record<string, { mtd: ServiceHoverWindow; ytd: ServiceHoverWindow }> = {};
    const tomorrow = getTomorrowStartUK();
    const monthStart = startOfThisMonthUK();
    const yearStart = startOfThisYearUK();

    for (const store of STORES) {
      const storeRows = rows.filter((r) => r.store === store);

      const mtdRows = storeRows.filter((r) => inRange(String(r.shift_date || ""), monthStart, tomorrow));
      const ytdRows = storeRows.filter((r) => inRange(String(r.shift_date || ""), yearStart, tomorrow));

      out[store] = { mtd: buildWindow(mtdRows), ytd: buildWindow(ytdRows) };
    }

    return out;
  }, [rows]);

  const managerHover = useMemo(() => {
    const out: Record<string, { mtd: ServiceHoverWindow; ytd: ServiceHoverWindow }> = {};
    const tomorrow = getTomorrowStartUK();
    const monthStart = startOfThisMonthUK();
    const yearStart = startOfThisYearUK();

    const names = Array.from(new Set(rows.map((r) => getManagerName(r))));

    for (const name of names) {
      const mgrRows = rows.filter((r) => getManagerName(r) === name);

      const mtdRows = mgrRows.filter((r) => inRange(String(r.shift_date || ""), monthStart, tomorrow));
      const ytdRows = mgrRows.filter((r) => inRange(String(r.shift_date || ""), yearStart, tomorrow));

      out[name] = { mtd: buildWindow(mtdRows), ytd: buildWindow(ytdRows) };
    }

    return out;
  }, [rows]);

  const periodLabel =
    dateRange === "yesterday"
      ? "Yesterday"
      : dateRange === "wtd"
      ? "Week to date"
      : dateRange === "mtd"
      ? "Month to date"
      : dateRange === "ytd"
      ? "Year to date"
      : "Custom";

  const formatPct = (v: number | null, dp = 1) =>
    v == null || !Number.isFinite(v) ? "—" : (v * 100).toFixed(dp) + "%";
  const formatHours = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "0.0");
  const formatMinutes = (v: number | null, dp = 1) =>
    v == null || !Number.isFinite(v) ? "—" : v.toFixed(dp) + "m";

  return (
    <main className="wrap">
      <div className="banner">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <div className="shell">
        <div className="topbar">
          <button className="navbtn" type="button" onClick={() => router.back()}>
            ← Back
          </button>
          <div className="topbar-spacer" />
          <button className="navbtn solid" type="button" onClick={() => router.push("/")}>
            🏠 Home
          </button>
        </div>

        <header className="header">
          <h1>Mourne-oids Service Dashboard</h1>
          <p className="subtitle">
            Area, store and manager performance — ranked by <b>higher DOT%</b> then{" "}
            <b>lower Extremes &gt;40</b> and <b>lower Rack &amp; Load</b>.
          </p>
        </header>

        <div className="filter-card">
          <div className="filter-row">
            <span className="filter-label">Store</span>
            <div className="quick-row">
              <button onClick={() => setSelectedStore("all")} className={`quick ${selectedStore === "all" ? "active" : ""}`}>
                All stores
              </button>
              {STORES.map((s) => (
                <button key={s} onClick={() => setSelectedStore(s)} className={`quick ${selectedStore === s ? "active" : ""}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <span className="filter-label">Period</span>
            <div className="quick-row">
              <button onClick={() => setDateRange("yesterday")} className={`quick ${dateRange === "yesterday" ? "active" : ""}`}>Yesterday</button>
              <button onClick={() => setDateRange("wtd")} className={`quick ${dateRange === "wtd" ? "active" : ""}`}>WTD</button>
              <button onClick={() => setDateRange("mtd")} className={`quick ${dateRange === "mtd" ? "active" : ""}`}>MTD</button>
              <button onClick={() => setDateRange("ytd")} className={`quick ${dateRange === "ytd" ? "active" : ""}`}>YTD</button>
              <button onClick={() => setDateRange("custom")} className={`quick ${dateRange === "custom" ? "active" : ""}`}>Custom</button>
            </div>
          </div>

          {dateRange === "custom" && (
            <div className="custom-grid">
              <label>
                <span>From</span>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </label>
              <label>
                <span>To</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </label>
            </div>
          )}
        </div>

        {loading && <div className="alert">Loading Mourne-oids data…</div>}
        {errorMsg && <div className="alert error">Error: {errorMsg}</div>}

        {!loading && !errorMsg && (
          <>
            <section className="section">
              <div className="section-head"><h2>Area overview</h2><p>{periodLabel}</p></div>
              <div className="podium-grid four">
                <div className="podium-card">
                  <div className="podium-top"><span className="rank-badge">Area</span></div>
                  <div className="podium-name">Avg DOT %</div>
                  <div className="podium-metrics">
                    <p><span>Performance</span><span className={pillClassFromDot(areaKpis.avgDOT)}>{formatPct(areaKpis.avgDOT,1)}</span></p>
                  </div>
                </div>

                <div className="podium-card">
                  <div className="podium-top"><span className="rank-badge">Area</span></div>
                  <div className="podium-name">Avg Rack &amp; Load</div>
                  <div className="podium-metrics">
                    <p><span>Minutes</span><span className={pillClassFromRackLoad(areaKpis.avgRackLoad)}>{formatMinutes(areaKpis.avgRackLoad,2)}</span></p>
                  </div>
                </div>

                <div className="podium-card">
                  <div className="podium-top"><span className="rank-badge">Area</span></div>
                  <div className="podium-name">Avg Extremes &gt;40 %</div>
                  <div className="podium-metrics">
                    <p><span>Performance</span><span className={pillClassFromExtremes(areaKpis.avgExtremes)}>{formatPct(areaKpis.avgExtremes,2)}</span></p>
                  </div>
                </div>

                <div className="podium-card">
                  <div className="podium-top"><span className="rank-badge">Area</span></div>
                  <div className="podium-name">Additional hours used</div>
                  <div className="podium-metrics">
                    <p><span>Total</span><span className="pill neutral">{formatHours(areaKpis.totalAddHours)}h</span></p>
                  </div>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="section-head"><h2>Store overview</h2><p>{periodLabel} • ranked by DOT then Extremes &gt;40</p></div>
              <div className="podium-grid">
                {storeData.map((st, idx) => (
                  <div key={st.store} className={`podium-card rank-${idx + 1}`}>
                    <div className="podium-top"><span className="rank-badge">Rank #{idx + 1}</span></div>

                    {/* STORE NAME + HOVER */}
                    <div className="podium-name" title={st.store}>
                      <div className="nameCell">
                        <span className="nameTrigger">{st.store}</span>
                        <div className="hoverWrap">
                          <HoverStatPanel
                            label={st.store}
                            mtd={storeHover[st.store]?.mtd ?? { dot: null, extremes: null, rnl: null, additionalHours: 0, shifts: 0 }}
                            ytd={storeHover[st.store]?.ytd ?? { dot: null, extremes: null, rnl: null, additionalHours: 0, shifts: 0 }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="podium-metrics">
                      <p><span>Avg DOT %</span><span className={pillClassFromDot(st.avgDOT)}>{formatPct(st.avgDOT, 1)}</span></p>
                      <p><span>Avg Rack &amp; Load</span><span className={pillClassFromRackLoad(st.avgRackLoad)}>{formatMinutes(st.avgRackLoad, 2)}</span></p>
                      <p><span>Avg Extremes &gt;40 %</span><span className={pillClassFromExtremes(st.avgExtremes)}>{formatPct(st.avgExtremes, 2)}</span></p>
                      <p><span>Additional hours</span><span className="pill neutral">{formatHours(st.totalAddHours)}h</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="section">
              <div className="section-head"><h2>Manager overview</h2><p>{periodLabel} • ranked by DOT then Extremes &gt;40</p></div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Manager</th>
                      <th>Avg DOT %</th>
                      <th>Avg Labour %</th>
                      <th>Avg Rack &amp; Load</th>
                      <th>Avg Extremes &gt;40 %</th>
                      <th>Shifts worked</th>
                      <th>Additional hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerData.map((mgr, idx) => (
                      <tr key={`${mgr.name}-${idx}`}>
                        <td>{idx + 1}</td>

                        {/* MANAGER NAME + HOVER */}
                        <td>
                          <div className="nameCell">
                            <span className="nameTrigger">{mgr.name}</span>
                            <div className="hoverWrap">
                              <HoverStatPanel
                                label={mgr.name}
                                mtd={managerHover[mgr.name]?.mtd ?? { dot: null, extremes: null, rnl: null, additionalHours: 0, shifts: 0 }}
                                ytd={managerHover[mgr.name]?.ytd ?? { dot: null, extremes: null, rnl: null, additionalHours: 0, shifts: 0 }}
                              />
                            </div>
                          </div>
                        </td>

                        <td><span className={pillClassFromDot(mgr.avgDOT)}>{formatPct(mgr.avgDOT, 1)}</span></td>
                        <td>{formatPct(mgr.avgLabour, 1)}</td>
                        <td><span className={pillClassFromRackLoad(mgr.avgRackLoad)}>{formatMinutes(mgr.avgRackLoad, 2)}</span></td>
                        <td><span className={pillClassFromExtremes(mgr.avgExtremes)}>{formatPct(mgr.avgExtremes, 2)}</span></td>
                        <td>{mgr.shiftsWorked}</td>
                        <td>{formatHours(mgr.totalAddHours)}h</td>
                      </tr>
                    ))}

                    {managerData.length === 0 && (
                      <tr><td className="empty" colSpan={8}>No manager data for this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      <footer className="footer"><p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p></footer>

      <style jsx>{`
        .wrap { min-height: 100dvh; background: radial-gradient(circle at top, rgba(0,100,145,0.08), transparent 45%), linear-gradient(180deg,#e3edf4 0%,#f2f5f9 30%,#f2f5f9 100%); display: flex; flex-direction: column; align-items: center; color: #0f172a; padding-bottom: 40px; }
        .banner { display: flex; justify-content: center; align-items: center; background: #fff; border-bottom: 3px solid #006491; box-shadow: 0 12px 35px rgba(2, 6, 23, 0.08); width: 100%; }
        .banner img { max-width: min(1160px, 92%); height: auto; display: block; }
        .shell { width: min(1100px, 94vw); margin-top: 18px; background: rgba(255, 255, 255, 0.65); backdrop-filter: saturate(160%) blur(6px); border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 1.5rem; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.05); padding: 18px 22px 26px; }

        .topbar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .topbar-spacer { flex: 1; }
        .navbtn { border-radius: 14px; border: 2px solid #006491; background: #fff; color: #006491; font-weight: 900; font-size: 14px; padding: 8px 12px; cursor: pointer; box-shadow: 0 6px 14px rgba(0,100,145,0.12); }
        .navbtn.solid { background: #006491; color: #fff; }

        .header { text-align: center; margin-bottom: 12px; }
        .header h1 { font-size: clamp(2rem, 3vw, 2.3rem); font-weight: 900; margin: 0; }
        .subtitle { margin: 6px 0 0; color: #64748b; font-weight: 700; font-size: 0.95rem; }

        .filter-card { margin-top: 14px; display: grid; gap: 12px; padding: 14px; border-radius: 16px; background: rgba(255,255,255,0.92); border: 1px solid rgba(0,100,145,0.14); box-shadow: 0 12px 28px rgba(2,6,23,0.05); }
        .filter-row { display: grid; gap: 8px; }
        .filter-label { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #475569; font-weight: 700; }
        .quick-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .quick { border: 1px solid rgba(15,23,42,0.08); background: #fff; border-radius: 999px; padding: 8px 12px; font-weight: 900; font-size: 13px; cursor: pointer; color: #0f172a; }
        .quick.active { background: rgba(0,100,145,0.1); border-color: rgba(0,100,145,0.25); color: #004b75; }

        .custom-grid { display: flex; gap: 12px; flex-wrap: wrap; }
        .custom-grid label { display: grid; gap: 6px; font-size: 12px; font-weight: 700; color: #334155; }
        .custom-grid input { border-radius: 12px; border: 1px solid rgba(15,23,42,0.14); padding: 8px 10px; font-weight: 700; background: #fff; }

        .alert { margin-top: 12px; border-radius: 14px; padding: 12px 14px; font-weight: 800; background: rgba(255, 255, 255, 0.85); border: 1px solid rgba(15, 23, 42, 0.1); color: #334155; }
        .alert.error { background: rgba(254,242,242,0.9); border-color: rgba(239,68,68,0.25); color: #7f1d1d; }

        .section { margin-top: 18px; }
        .section-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; margin-bottom: 10px; }
        .section-head h2 { margin: 0; font-size: 15px; font-weight: 900; }
        .section-head p { margin: 0; font-size: 12px; color: #64748b; font-weight: 700; }

        .podium-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .podium-grid.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .podium-card { background: rgba(255,255,255,0.92); border-radius: 18px; border: 1px solid rgba(0,100,145,0.14); box-shadow: 0 12px 28px rgba(2,6,23,0.05); padding: 12px 14px; }
        .podium-card.rank-1 { border-color: rgba(34,197,94,0.35); }
        .podium-card.rank-2 { border-color: rgba(245,158,11,0.35); }
        .podium-card.rank-3 { border-color: rgba(249,115,22,0.35); }
        .podium-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .rank-badge { display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 999px; background: rgba(0,100,145,0.1); border: 1px solid rgba(0,100,145,0.18); color: #004b75; font-weight: 800; font-size: 12px; }
        .podium-name { font-size: 18px; font-weight: 900; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .podium-metrics { display: grid; gap: 6px; }
        .podium-metrics p { margin: 0; display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; color: #334155; }

        /* Table */
        .table-wrap {
          overflow-x: auto;
          overflow-y: visible;
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,0.08);
          background: rgba(255,255,255,0.9);
          box-shadow: 0 12px 28px rgba(2,6,23,0.05);
        }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { padding: 12px; text-align: left; font-size: 13px; }
        .table th { background: rgba(0,100,145,0.08); font-weight: 900; }
        .table tr + tr td { border-top: 1px solid rgba(15,23,42,0.06); }
        .table td:nth-child(n+3) { text-align: right; font-variant-numeric: tabular-nums; }
        .table td.empty { text-align: left !important; color: #475569; font-weight: 700; }

        /* Pills */
        .pill { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(15,23,42,.12); background: rgba(241,245,249,.9); color: #334155; white-space: nowrap; }
        .pill.green { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.25); color: #166534; }
        .pill.amber { background: rgba(245,158,11,0.14); border-color: rgba(245,158,11,0.28); color: #92400e; }
        .pill.red { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.26); color: #991b1b; }
        .pill.neutral { background: rgba(0,100,145,0.1); border-color: rgba(0,100,145,0.2); color: #004b75; }

        /* Hover behaviour */
        .nameCell { position: relative; display: inline-block; }
        .nameTrigger { font-weight: 900; cursor: pointer; }
        .hoverWrap {
          position: absolute;
          left: 0;
          top: calc(100% + 8px);
          display: none;
          z-index: 9999;
          max-width: min(420px, 86vw);
        }
        .nameCell:hover .hoverWrap { display: block; }

        .footer { text-align: center; margin-top: 18px; color: #94a3b8; font-size: 0.8rem; }

        @media (max-width: 980px) {
          .section-head { flex-direction: column; align-items: flex-start; }
          .podium-grid, .podium-grid.four { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 700px) {
          .shell { width: min(1100px, 96vw); padding: 14px; }
          .podium-grid, .podium-grid.four { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
