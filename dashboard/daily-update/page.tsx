"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ---------------- UK date helpers (Europe/London) ---------------- */
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

const parseISODate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const addDays = (iso: string, deltaDays: number) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + deltaDays);
  return toISODateUK(d);
};

const startOfWeekMondayUK = (isoTodayUk: string) => {
  // isoTodayUk is YYYY-MM-DD in UK. We treat it as local date.
  const d = parseISODate(isoTodayUk);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return toISODateUK(d);
};

const tomorrowUK = (isoTodayUk: string) => addDays(isoTodayUk, 1);

/* ---------------- Types ---------------- */
type CostRow = {
  store: string;
  shift_date: string;
  manager_name: string | null;
  sales_gbp: number | null;
  labour_cost_gbp: number | null;
  ideal_food_cost_gbp: number | null;
  actual_food_cost_gbp: number | null;
};

type ServiceRow = {
  store: string;
  shift_date: string;
  manager: string | null;
  labour_pct: number | null; // 0–100 confirmed
  additional_hours: number | null;
  dot_pct: number | null; // 0–100
  extreme_over_40: number | null; // 0–100
  rnl_minutes: number | null; // minutes
};

type OsaRow = {
  store: string;
  shift_date: string;
  overall_points: number | null;
  stars: number | null;
  is_elite: boolean | null;
  team_member_name: string | null;
};

type DailyAreaMsg = {
  date: string;
  message: string | null;
};

type DailyStoreInputs = {
  date: string;
  store: string;
  missed_calls_wtd: number | null;
  gps_tracked_wtd: number | null; // 0–100
  aof_wtd: number | null; // 0–100

  target_load_time_mins: number | null;
  target_rack_time_mins: number | null;
  target_adt_mins: number | null;
  target_extremes_over40_pct: number | null; // 0–100
  notes: string | null;
};

type DailyTask = {
  id: string;
  date: string;
  store: string;
  task: string;
  is_complete: boolean;
  created_at: string | null;
  completed_at: string | null;
};

/* ---------------- Small helpers ---------------- */
const n = (v: any) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

const fmtPct = (v: number | null, dp = 1) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(dp)}%`);
const fmtMoney = (v: number | null, dp = 0) => (v == null || !Number.isFinite(v) ? "—" : `£${v.toFixed(dp)}`);
const fmtMinutes = (v: number | null, dp = 1) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(dp)}m`);
const fmtHours = (v: number) => (Number.isFinite(v) ? `${v.toFixed(1)}h` : "0.0h");

const uniq = (arr: string[]) => Array.from(new Set(arr)).filter(Boolean);

/* ---------------- Threshold pills (keep simple + consistent) ---------------- */
const pill = (tone: "green" | "amber" | "red" | "neutral") => `pill ${tone}`;

const labourPill = (pct: number | null) => {
  if (pct == null) return "pill";
  if (pct <= 25) return pill("green");
  if (pct <= 28) return pill("amber");
  return pill("red");
};

const foodVarPill = (pct: number | null) => {
  // band ±0.25% of sales
  if (pct == null) return "pill";
  if (pct >= -0.25 && pct <= 0.25) return pill("green");
  if (pct >= -0.5 && pct <= 0.5) return pill("amber");
  return pill("red");
};

const dotPill = (pct: number | null) => {
  if (pct == null) return "pill";
  if (pct >= 80) return pill("green");
  if (pct >= 75) return pill("amber");
  return pill("red");
};

const extremesPill = (pct: number | null) => {
  if (pct == null) return "pill";
  if (pct <= 3) return pill("green");
  if (pct <= 5) return pill("amber");
  return pill("red");
};

const rnlPill = (mins: number | null) => {
  if (mins == null) return "pill";
  if (mins <= 10) return pill("green");
  if (mins <= 20) return pill("amber");
  return pill("red");
};

const gpsPill = (pct: number | null) => {
  if (pct == null) return "pill";
  if (pct >= 95) return pill("green");
  if (pct >= 90) return pill("amber");
  return pill("red");
};

const aofPill = (pct: number | null) => {
  if (pct == null) return "pill";
  if (pct >= 62) return pill("green");
  if (pct >= 60) return pill("amber");
  return pill("red");
};

const missedCallsPill = (count: number | null) => {
  // counts are your input; keep conservative thresholds
  if (count == null) return "pill";
  if (count <= 2) return pill("green");
  if (count <= 5) return pill("amber");
  return pill("red");
};

const starsPill = (stars: number | null) => {
  if (stars == null) return "pill";
  if (stars >= 5) return pill("green");
  if (stars >= 4) return pill("amber");
  return pill("red");
};

/* ---------------- Main page ---------------- */
export default function DailyUpdatePage() {
  const router = useRouter();

  const todayUk = useMemo(() => toISODateUK(new Date()), []);
  const ydayUk = useMemo(() => addDays(toISODateUK(new Date()), -1), []);
  const wtdStartUk = useMemo(() => startOfWeekMondayUK(todayUk), [todayUk]);
  const wtdEndExclusiveUk = useMemo(() => tomorrowUK(todayUk), [todayUk]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [stores, setStores] = useState<string[]>([]);
  const [areaMsg, setAreaMsg] = useState<string>("");

  const [todayInputs, setTodayInputs] = useState<Record<string, DailyStoreInputs>>({});
  const [todayTasks, setTodayTasks] = useState<Record<string, DailyTask[]>>({});

  const [wtdCostRows, setWtdCostRows] = useState<CostRow[]>([]);
  const [ydayServiceRows, setYdayServiceRows] = useState<ServiceRow[]>([]);
  const [wtdServiceRows, setWtdServiceRows] = useState<ServiceRow[]>([]);
  const [wtdOsaRows, setWtdOsaRows] = useState<OsaRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);

      try {
        // ---- 1) Area message (today) ----
        const { data: msgData, error: msgErr } = await supabase
          .from("daily_update_area_message")
          .select("date,message")
          .eq("date", todayUk)
          .maybeSingle();

        if (msgErr) throw new Error(`Area message load failed: ${msgErr.message}`);
        setAreaMsg(String((msgData as DailyAreaMsg | null)?.message || ""));

        // ---- 2) Store inputs (today) ----
        const { data: inputData, error: inputErr } = await supabase
          .from("daily_update_store_inputs")
          .select(
            "date,store,missed_calls_wtd,gps_tracked_wtd,aof_wtd,target_load_time_mins,target_rack_time_mins,target_adt_mins,target_extremes_over40_pct,notes"
          )
          .eq("date", todayUk);

        if (inputErr) throw new Error(`Store inputs load failed: ${inputErr.message}`);

        const inputMap: Record<string, DailyStoreInputs> = {};
        (inputData || []).forEach((r: any) => {
          const store = String(r.store || "").trim();
          if (!store) return;
          inputMap[store] = r as DailyStoreInputs;
        });
        setTodayInputs(inputMap);

        // ---- 3) Store tasks (today) ----
        const { data: taskData, error: taskErr } = await supabase
          .from("daily_update_store_tasks")
          .select("id,date,store,task,is_complete,created_at,completed_at")
          .eq("date", todayUk)
          .order("created_at", { ascending: true });

        if (taskErr) throw new Error(`Tasks load failed: ${taskErr.message}`);

        const taskMap: Record<string, DailyTask[]> = {};
        (taskData || []).forEach((t: any) => {
          const store = String(t.store || "").trim();
          if (!store) return;
          if (!taskMap[store]) taskMap[store] = [];
          taskMap[store].push(t as DailyTask);
        });
        setTodayTasks(taskMap);

        // ---- 4) Cost controls WTD ----
        const { data: costData, error: costErr } = await supabase
          .from("cost_control_entries")
          .select("store,shift_date,manager_name,sales_gbp,labour_cost_gbp,ideal_food_cost_gbp,actual_food_cost_gbp")
          .gte("shift_date", wtdStartUk)
          .lt("shift_date", wtdEndExclusiveUk);

        if (costErr) throw new Error(`Cost controls load failed: ${costErr.message}`);
        setWtdCostRows((costData || []) as CostRow[]);

        // ---- 5) Service yesterday ----
        const { data: svcYData, error: svcYErr } = await supabase
          .from("service_shifts")
          .select("store,shift_date,manager,labour_pct,additional_hours,dot_pct,extreme_over_40,rnl_minutes")
          .eq("shift_date", ydayUk);

        if (svcYErr) throw new Error(`Service (yesterday) load failed: ${svcYErr.message}`);
        setYdayServiceRows((svcYData || []) as ServiceRow[]);

        // ---- 6) Service WTD (additional hours header strip) ----
        const { data: svcWData, error: svcWErr } = await supabase
          .from("service_shifts")
          .select("store,shift_date,manager,labour_pct,additional_hours,dot_pct,extreme_over_40,rnl_minutes")
          .gte("shift_date", wtdStartUk)
          .lt("shift_date", wtdEndExclusiveUk);

        if (svcWErr) throw new Error(`Service (WTD) load failed: ${svcWErr.message}`);
        setWtdServiceRows((svcWData || []) as ServiceRow[]);

        // ---- 7) OSA WTD ----
        const { data: osaData, error: osaErr } = await supabase
          .from("osa_internal_results")
          .select("store,shift_date,overall_points,stars,is_elite,team_member_name")
          .gte("shift_date", wtdStartUk)
          .lt("shift_date", wtdEndExclusiveUk);

        if (osaErr) throw new Error(`OSA WTD load failed: ${osaErr.message}`);
        setWtdOsaRows((osaData || []) as OsaRow[]);

        // ---- 8) Store list (dynamic) ----
        const storeCandidates = uniq([
          ...Object.keys(inputMap),
          ...Object.keys(taskMap),
          ...(costData || []).map((r: any) => String(r.store || "").trim()),
          ...(svcYData || []).map((r: any) => String(r.store || "").trim()),
          ...(svcWData || []).map((r: any) => String(r.store || "").trim()),
          ...(osaData || []).map((r: any) => String(r.store || "").trim()),
        ]);

        // stable sort
        storeCandidates.sort((a, b) => a.localeCompare(b));
        setStores(storeCandidates);

        setLoading(false);
      } catch (e: any) {
        setErr(e?.message || "Failed to load Daily Update data");
        setLoading(false);
      }
    };

    load();
  }, [todayUk, ydayUk, wtdStartUk, wtdEndExclusiveUk]);

  /* ---------------- Aggregations ---------------- */

  // Area WTD labour% and food variance% (weighted by sales)
  const areaCost = useMemo(() => {
    const sales = sum(wtdCostRows.map((r) => n(r.sales_gbp)));
    const labour = sum(wtdCostRows.map((r) => n(r.labour_cost_gbp)));
    const ideal = sum(wtdCostRows.map((r) => n(r.ideal_food_cost_gbp)));
    const actual = sum(wtdCostRows.map((r) => n(r.actual_food_cost_gbp)));

    const labourPct = sales > 0 ? (labour / sales) * 100 : null;
    const foodVarPctSales = sales > 0 ? ((actual - ideal) / sales) * 100 : null;

    return { sales, labour, ideal, actual, labourPct, foodVarPctSales };
  }, [wtdCostRows]);

  // Area WTD additional hours (service_shifts)
  const areaAdditionalHours = useMemo(() => {
    return sum(wtdServiceRows.map((r) => n(r.additional_hours)));
  }, [wtdServiceRows]);

  // Area WTD OSA count
  const areaOsaCount = useMemo(() => wtdOsaRows.length, [wtdOsaRows]);

  // Store WTD cost controls (weighted)
  const storeCost = useMemo(() => {
    const bucket: Record<string, { sales: number; labour: number; ideal: number; actual: number }> = {};
    for (const r of wtdCostRows) {
      const s = String(r.store || "").trim();
      if (!s) continue;
      if (!bucket[s]) bucket[s] = { sales: 0, labour: 0, ideal: 0, actual: 0 };
      bucket[s].sales += n(r.sales_gbp);
      bucket[s].labour += n(r.labour_cost_gbp);
      bucket[s].ideal += n(r.ideal_food_cost_gbp);
      bucket[s].actual += n(r.actual_food_cost_gbp);
    }
    const out: Record<string, { labourPct: number | null; foodVarPctSales: number | null; sales: number }> = {};
    for (const [store, v] of Object.entries(bucket)) {
      out[store] = {
        sales: v.sales,
        labourPct: v.sales > 0 ? (v.labour / v.sales) * 100 : null,
        foodVarPctSales: v.sales > 0 ? ((v.actual - v.ideal) / v.sales) * 100 : null,
      };
    }
    return out;
  }, [wtdCostRows]);

  // Yesterday service store overview + manager overview
  const storeServiceYesterday = useMemo(() => {
    const storeBucket: Record<string, { dot: number[]; ext: number[]; rnl: number[]; addHrs: number; managers: Set<string> }> =
      {};

    const mgrBucket: Record<string, { dot: number[]; ext: number[]; rnl: number[]; addHrs: number; stores: Set<string> }> = {};

    for (const r of ydayServiceRows) {
      const store = String(r.store || "").trim();
      if (!store) continue;

      if (!storeBucket[store]) {
        storeBucket[store] = { dot: [], ext: [], rnl: [], addHrs: 0, managers: new Set() };
      }

      if (r.dot_pct != null) storeBucket[store].dot.push(n(r.dot_pct));
      if (r.extreme_over_40 != null) storeBucket[store].ext.push(n(r.extreme_over_40));
      if (r.rnl_minutes != null) storeBucket[store].rnl.push(n(r.rnl_minutes));
      storeBucket[store].addHrs += n(r.additional_hours);

      const manager = String(r.manager || "").trim() || "Unknown";
      storeBucket[store].managers.add(manager);

      if (!mgrBucket[manager]) mgrBucket[manager] = { dot: [], ext: [], rnl: [], addHrs: 0, stores: new Set() };
      if (r.dot_pct != null) mgrBucket[manager].dot.push(n(r.dot_pct));
      if (r.extreme_over_40 != null) mgrBucket[manager].ext.push(n(r.extreme_over_40));
      if (r.rnl_minutes != null) mgrBucket[manager].rnl.push(n(r.rnl_minutes));
      mgrBucket[manager].addHrs += n(r.additional_hours);
      mgrBucket[manager].stores.add(store);
    }

    const storeOut: Record<
      string,
      { avgDot: number | null; avgExt: number | null; avgRnl: number | null; addHrs: number; managers: string[] }
    > = {};
    for (const [store, v] of Object.entries(storeBucket)) {
      storeOut[store] = {
        avgDot: avg(v.dot),
        avgExt: avg(v.ext),
        avgRnl: avg(v.rnl),
        addHrs: v.addHrs,
        managers: Array.from(v.managers),
      };
    }

    const mgrOut: Record<
      string,
      { avgDot: number | null; avgExt: number | null; avgRnl: number | null; addHrs: number; stores: string[] }
    > = {};
    for (const [mgr, v] of Object.entries(mgrBucket)) {
      mgrOut[mgr] = {
        avgDot: avg(v.dot),
        avgExt: avg(v.ext),
        avgRnl: avg(v.rnl),
        addHrs: v.addHrs,
        stores: Array.from(v.stores),
      };
    }

    return { storeOut, mgrOut };
  }, [ydayServiceRows]);

  // OSA per store WTD
  const osaByStore = useMemo(() => {
    const bucket: Record<
      string,
      { count: number; avgStars: number | null; eliteCount: number; latest: OsaRow | null; starsArr: number[] }
    > = {};
    for (const r of wtdOsaRows) {
      const store = String(r.store || "").trim();
      if (!store) continue;
      if (!bucket[store]) bucket[store] = { count: 0, avgStars: null, eliteCount: 0, latest: null, starsArr: [] };
      bucket[store].count += 1;
      if (r.is_elite) bucket[store].eliteCount += 1;
      if (r.stars != null) bucket[store].starsArr.push(n(r.stars));
      // "latest" by shift_date string compare (YYYY-MM-DD)
      if (!bucket[store].latest) bucket[store].latest = r;
      else if (String(r.shift_date || "") > String(bucket[store].latest?.shift_date || "")) bucket[store].latest = r;
    }
    for (const store of Object.keys(bucket)) {
      bucket[store].avgStars = avg(bucket[store].starsArr);
    }
    return bucket;
  }, [wtdOsaRows]);

  /* ---------------- Print / PDF ---------------- */
  const handleExportPdf = () => {
    // Print-to-PDF from browser
    window.print();
  };

  return (
    <main className="wrap">
      <div className="banner no-print">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <div className="shell">
        <div className="topbar no-print">
          <button className="navbtn" type="button" onClick={() => router.back()}>
            ← Back
          </button>
          <div className="topbar-spacer" />
          <button className="navbtn" type="button" onClick={handleExportPdf}>
            🧾 Export PDF
          </button>
          <button className="navbtn solid" type="button" onClick={() => router.push("/")}>
            🏠 Home
          </button>
        </div>

        <header className="header">
          <h1>Daily Update</h1>
          <p className="subtitle">
            Today: <b>{todayUk}</b> • Yesterday: <b>{ydayUk}</b> • WTD (Mon): <b>{wtdStartUk}</b>
          </p>
        </header>

        {loading && <div className="alert">Loading Daily Update…</div>}
        {err && <div className="alert error">Error: {err}</div>}

        {!loading && !err && (
          <>
            {/* Header strip */}
            <section className="strip">
              <div className="stripCard">
                <div className="stripTitle">Area Labour (WTD)</div>
                <div className="stripValue">
                  <span className={labourPill(areaCost.labourPct)}>{fmtPct(areaCost.labourPct, 1)}</span>
                </div>
                <div className="stripSub">Sales {fmtMoney(areaCost.sales, 0)}</div>
              </div>

              <div className="stripCard">
                <div className="stripTitle">Area Food Var (WTD)</div>
                <div className="stripValue">
                  <span className={foodVarPill(areaCost.foodVarPctSales)}>{fmtPct(areaCost.foodVarPctSales, 2)}</span>
                </div>
                <div className="stripSub">Band ±0.25%</div>
              </div>

              <div className="stripCard">
                <div className="stripTitle">Area Add. Hours (WTD)</div>
                <div className="stripValue">
                  <span className="pill neutral">{fmtHours(areaAdditionalHours)}</span>
                </div>
                <div className="stripSub">From service_shifts</div>
              </div>

              <div className="stripCard">
                <div className="stripTitle">Internal OSA (WTD)</div>
                <div className="stripValue">
                  <span className="pill neutral">{areaOsaCount}</span>
                </div>
                <div className="stripSub">Submissions</div>
              </div>
            </section>

            {/* Key message */}
            <section className="section">
              <div className="section-head">
                <h2>Key message</h2>
                <p>Set in Admin → Daily Update Inputs</p>
              </div>
              <div className="messageCard">
                {areaMsg?.trim() ? areaMsg : <span className="muted">No message saved for today.</span>}
              </div>
            </section>

            {/* Store cards */}
            <section className="section">
              <div className="section-head">
                <h2>Store overview</h2>
                <p>Cost controls (WTD) + Service (Yesterday) + Inputs/Tasks (Today)</p>
              </div>

              <div className="storeGrid">
                {stores.map((store) => {
                  const cc = storeCost[store] || { labourPct: null, foodVarPctSales: null, sales: 0 };
                  const svc = storeServiceYesterday.storeOut[store] || {
                    avgDot: null,
                    avgExt: null,
                    avgRnl: null,
                    addHrs: 0,
                    managers: [],
                  };
                  const inp = todayInputs[store];
                  const tasks = (todayTasks[store] || []).slice().sort((a, b) => {
                    if (a.is_complete !== b.is_complete) return a.is_complete ? 1 : -1;
                    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
                  });
                  const outstanding = tasks.filter((t) => !t.is_complete);

                  const osa = osaByStore[store];

                  return (
                    <div key={store} className="storeCard">
                      <div className="storeTop">
                        <div className="storeName">{store}</div>
                        <div className="storeBadges">
                          <span className="pill neutral">WTD</span>
                          <span className="pill neutral">Yday</span>
                          <span className="pill neutral">Today</span>
                        </div>
                      </div>

                      {/* Cost controls */}
                      <div className="block">
                        <div className="blockTitle">💷 Cost controls (WTD)</div>
                        <div className="rows">
                          <div className="row">
                            <span>Labour</span>
                            <span className={labourPill(cc.labourPct)}>{fmtPct(cc.labourPct, 1)}</span>
                          </div>
                          <div className="row">
                            <span>Food variance</span>
                            <span className={foodVarPill(cc.foodVarPctSales)}>{fmtPct(cc.foodVarPctSales, 2)}</span>
                          </div>
                          <div className="row">
                            <span>Sales</span>
                            <span className="pill neutral">{fmtMoney(cc.sales, 0)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Service yesterday */}
                      <div className="block">
                        <div className="blockTitle">📊 Service (Yesterday)</div>
                        <div className="rows">
                          <div className="row">
                            <span>DOT</span>
                            <span className={dotPill(svc.avgDot)}>{fmtPct(svc.avgDot, 1)}</span>
                          </div>
                          <div className="row">
                            <span>Extremes &gt;40</span>
                            <span className={extremesPill(svc.avgExt)}>{fmtPct(svc.avgExt, 2)}</span>
                          </div>
                          <div className="row">
                            <span>R&amp;L</span>
                            <span className={rnlPill(svc.avgRnl)}>{fmtMinutes(svc.avgRnl, 1)}</span>
                          </div>
                          <div className="row">
                            <span>Additional hours</span>
                            <span className="pill neutral">{fmtHours(svc.addHrs)}</span>
                          </div>
                          <div className="row">
                            <span>Manager(s)</span>
                            <span className="pill neutral">
                              {svc.managers.length ? svc.managers.join(", ") : "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* OSA summary (separate block) */}
                      <div className="block">
                        <div className="blockTitle">⭐ Internal OSA (WTD)</div>
                        <div className="rows">
                          <div className="row">
                            <span>Submissions</span>
                            <span className="pill neutral">{osa ? osa.count : 0}</span>
                          </div>
                          <div className="row">
                            <span>Avg stars</span>
                            <span className={starsPill(osa?.avgStars ?? null)}>
                              {osa?.avgStars == null ? "—" : osa.avgStars.toFixed(2)}
                            </span>
                          </div>
                          <div className="row">
                            <span>Elite count</span>
                            <span className="pill neutral">{osa ? osa.eliteCount : 0}</span>
                          </div>
                          <div className="row">
                            <span>Latest</span>
                            <span className="pill neutral">
                              {osa?.latest
                                ? `${osa.latest.shift_date} • ${osa.latest.stars ?? "—"}⭐ • ${osa.latest.overall_points ?? "—"} pts`
                                : "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Today inputs */}
                      <div className="block">
                        <div className="blockTitle">📌 Today inputs</div>
                        <div className="rows">
                          <div className="row">
                            <span>Missed calls (WTD)</span>
                            <span className={missedCallsPill(inp?.missed_calls_wtd ?? null)}>
                              {inp?.missed_calls_wtd ?? "—"}
                            </span>
                          </div>
                          <div className="row">
                            <span>GPS tracked (WTD)</span>
                            <span className={gpsPill(inp?.gps_tracked_wtd ?? null)}>
                              {fmtPct(inp?.gps_tracked_wtd ?? null, 0)}
                            </span>
                          </div>
                          <div className="row">
                            <span>AOF (WTD)</span>
                            <span className={aofPill(inp?.aof_wtd ?? null)}>{fmtPct(inp?.aof_wtd ?? null, 0)}</span>
                          </div>
                          {inp?.notes?.trim() ? (
                            <div className="note">{inp.notes}</div>
                          ) : (
                            <div className="note muted">No notes saved.</div>
                          )}
                        </div>
                      </div>

                      {/* Service losing targets (own block) */}
                      <div className="block">
                        <div className="blockTitle">🎯 Service losing targets (Today)</div>
                        <div className="rows">
                          <div className="row">
                            <span>Load time</span>
                            <span className="pill neutral">{fmtMinutes(inp?.target_load_time_mins ?? null, 1)}</span>
                          </div>
                          <div className="row">
                            <span>Rack time</span>
                            <span className="pill neutral">{fmtMinutes(inp?.target_rack_time_mins ?? null, 1)}</span>
                          </div>
                          <div className="row">
                            <span>ADT</span>
                            <span className="pill neutral">{fmtMinutes(inp?.target_adt_mins ?? null, 1)}</span>
                          </div>
                          <div className="row">
                            <span>Extremes &gt;40</span>
                            <span className="pill neutral">{fmtPct(inp?.target_extremes_over40_pct ?? null, 1)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Tasks */}
                      <div className="block">
                        <div className="blockTitle">✅ Tasks</div>
                        {tasks.length === 0 ? (
                          <div className="note muted">No tasks logged today.</div>
                        ) : (
                          <>
                            <div className="taskSummary">
                              <span className="pill neutral">Outstanding: {outstanding.length}</span>
                              <span className="pill neutral">Total: {tasks.length}</span>
                            </div>
                            <ul className="taskList">
                              {tasks.slice(0, 8).map((t) => (
                                <li key={t.id} className={t.is_complete ? "done" : ""}>
                                  <span className="taskDot">{t.is_complete ? "✓" : "•"}</span>
                                  <span className="taskText">{t.task}</span>
                                </li>
                              ))}
                              {tasks.length > 8 && <li className="more muted">+{tasks.length - 8} more…</li>}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {stores.length === 0 && <div className="alert">No stores found in current datasets.</div>}
              </div>
            </section>

            {/* Print footer */}
            <div className="printFooter only-print">
              © 2026 Mourne-oids | Domino’s Pizza | Racz Group • Generated {new Date().toLocaleString("en-GB")}
            </div>
          </>
        )}
      </div>

      <footer className="footer no-print">
        <p>© 2026 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>

      <style jsx>{`
        .wrap {
          min-height: 100dvh;
          background: radial-gradient(circle at top, rgba(0, 100, 145, 0.08), transparent 45%),
            linear-gradient(180deg, #e3edf4 0%, #f2f5f9 30%, #f2f5f9 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          color: #0f172a;
          padding-bottom: 40px;
        }

        .banner {
          display: flex;
          justify-content: center;
          align-items: center;
          background: #fff;
          border-bottom: 3px solid #006491;
          box-shadow: 0 12px 35px rgba(2, 6, 23, 0.08);
          width: 100%;
        }
        .banner img {
          max-width: min(1160px, 92%);
          height: auto;
          display: block;
        }

        .shell {
          width: min(1100px, 94vw);
          margin-top: 18px;
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: saturate(160%) blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 1.5rem;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.05);
          padding: 18px 22px 26px;
        }

        .topbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .topbar-spacer {
          flex: 1;
        }
        .navbtn {
          border-radius: 14px;
          border: 2px solid #006491;
          background: #fff;
          color: #006491;
          font-weight: 900;
          font-size: 14px;
          padding: 8px 12px;
          cursor: pointer;
          box-shadow: 0 6px 14px rgba(0, 100, 145, 0.12);
        }
        .navbtn.solid {
          background: #006491;
          color: #fff;
        }

        .header {
          text-align: center;
          margin-bottom: 12px;
        }
        .header h1 {
          font-size: clamp(2rem, 3vw, 2.3rem);
          font-weight: 900;
          margin: 0;
        }
        .subtitle {
          margin: 6px 0 0;
          color: #64748b;
          font-weight: 700;
          font-size: 0.95rem;
        }

        .alert {
          margin-top: 12px;
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(15, 23, 42, 0.1);
          color: #334155;
        }
        .alert.error {
          background: rgba(254, 242, 242, 0.9);
          border-color: rgba(239, 68, 68, 0.25);
          color: #7f1d1d;
        }

        .strip {
          margin-top: 10px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .stripCard {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 18px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          padding: 12px 14px;
        }
        .stripTitle {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #475569;
          font-weight: 900;
        }
        .stripValue {
          margin-top: 8px;
          font-size: 18px;
          font-weight: 900;
        }
        .stripSub {
          margin-top: 6px;
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
        }

        .section {
          margin-top: 18px;
        }
        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-bottom: 10px;
        }
        .section-head h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
        }
        .section-head p {
          margin: 0;
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
        }

        .messageCard {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 18px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          padding: 14px 16px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.35;
          white-space: pre-wrap;
        }

        .storeGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .storeCard {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 18px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          padding: 12px 14px;
        }
        .storeTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .storeName {
          font-size: 18px;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .storeBadges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .block {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(15, 23, 42, 0.08);
        }
        .blockTitle {
          font-size: 12px;
          font-weight: 900;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-bottom: 8px;
        }

        .rows {
          display: grid;
          gap: 8px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          color: #334155;
          font-size: 13px;
        }

        .note {
          margin-top: 8px;
          border-radius: 12px;
          border: 1px dashed rgba(0, 100, 145, 0.25);
          background: rgba(0, 100, 145, 0.06);
          padding: 10px 12px;
          font-weight: 800;
          color: #0f172a;
          font-size: 12px;
        }

        .taskSummary {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .taskList {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 6px;
        }
        .taskList li {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          font-weight: 800;
          color: #0f172a;
          font-size: 12px;
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(248, 250, 252, 0.9);
        }
        .taskList li.done {
          opacity: 0.7;
        }
        .taskDot {
          width: 16px;
          display: inline-flex;
          justify-content: center;
          margin-top: 1px;
        }
        .taskText {
          flex: 1;
        }

        /* Pills */
        .pill {
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(241, 245, 249, 0.9);
          color: #334155;
          white-space: nowrap;
        }
        .pill.green {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.25);
          color: #166534;
        }
        .pill.amber {
          background: rgba(245, 158, 11, 0.14);
          border-color: rgba(245, 158, 11, 0.28);
          color: #92400e;
        }
        .pill.red {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.26);
          color: #991b1b;
        }
        .pill.neutral {
          background: rgba(0, 100, 145, 0.1);
          border-color: rgba(0, 100, 145, 0.2);
          color: #004b75;
        }

        .muted {
          color: #94a3b8;
          font-weight: 700;
        }

        .footer {
          text-align: center;
          margin-top: 18px;
          color: #94a3b8;
          font-size: 0.8rem;
        }

        /* Responsive */
        @media (max-width: 980px) {
          .strip {
            grid-template-columns: 1fr 1fr;
          }
          .storeGrid {
            grid-template-columns: 1fr;
          }
        }

        /* Print / PDF */
        .only-print {
          display: none;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          .only-print {
            display: block !important;
          }
          .wrap {
            background: #fff !important;
            padding-bottom: 0;
          }
          .shell {
            width: 100%;
            margin: 0;
            padding: 0;
            background: #fff;
            border: none;
            box-shadow: none;
          }
          .strip,
          .storeGrid {
            gap: 8px;
          }
          .storeCard,
          .stripCard,
          .messageCard {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none;
          }
          .printFooter {
            margin-top: 10px;
            font-size: 10px;
            color: #475569;
            text-align: center;
          }
        }
      `}</style>
    </main>
  );
}
