"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type MetricStatus = "good" | "ok" | "bad" | "na";
type AreaMessageRow = { date: string; message: string | null };
type StoreInputRow = {
  date: string;
  store: string;
  missed_calls_wtd: number | null;
  gps_tracked_wtd: number | null;
  aof_wtd: number | null;
  target_load_time_mins: number | null;
  target_rack_time_mins: number | null;
  target_adt_mins: number | null;
  target_extremes_over40_pct: number | null;
  notes: string | null;
};
type TaskRow = { id: string; date: string; store: string; task: string; is_complete: boolean; created_at: string; completed_at: string | null };
type ServiceShiftRow = {
  shift_date: string;
  store: string;
  dot_pct: number | null;
  labour_pct: number | null;
  extreme_over_40: number | null;
  rnl_minutes: number | null;
  additional_hours: number | null;
  manager?: string | null;
};
type CostControlRow = {
  shift_date: string;
  store: string;
  sales_gbp: number | null;
  labour_cost_gbp: number | null;
  ideal_food_cost_gbp: number | null;
  actual_food_cost_gbp: number | null;
};
type OsaInternalRow = { shift_date: string; store: string | null; team_member_name?: string | null; points_lost?: number | null };

type Targets = { dotMin01: number; labourMax01: number; rnlMaxMins: number; extremesMax01: number; foodVarAbsMax01: number };

const INPUT_TARGETS = { missedCallsMax01: 0.06, aofMin01: 0.62, gpsMin01: 0.95 };
const AREA_TARGETS = { labourMax01: 0.26, foodVarAbsMax01: 0.003, addHoursOkMax: 1 };
const DEFAULT_TARGETS: Record<string, Targets> = {
  Downpatrick: { dotMin01: 0.82, labourMax01: 0.25, rnlMaxMins: 9, extremesMax01: 0.03, foodVarAbsMax01: 0.003 },
  Kilkeel: { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 8, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
  Newcastle: { dotMin01: 0.78, labourMax01: 0.25, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
  Ballynahinch: { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
};

const toISODateUK = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
};
const parseIsoDate = (isoDate: string) => { const [y, m, d] = isoDate.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const getPreviousBusinessDayUk = () => { const d = parseIsoDate(toISODateUK(new Date())); d.setDate(d.getDate() - 1); return toISODateUK(d); };
const getWeekStartUK = (isoDate: string) => { const d = parseIsoDate(isoDate); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return toISODateUK(d); };
const minusDaysUK = (isoDate: string, days: number) => { const d = parseIsoDate(isoDate); d.setDate(d.getDate() - days); return toISODateUK(d); };
const rangeDatesUK = (endIso: string, days: number) => [...Array(days)].map((_, i) => minusDaysUK(endIso, days - 1 - i));

const normalisePct01 = (v: number | null) => (v == null || !Number.isFinite(v) ? null : v > 1 ? v / 100 : v);
const to01From100 = (v: number | null) => (v == null || !Number.isFinite(v) ? null : v / 100);
const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const fmtPct2 = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(2)}%`);
const fmtNum2 = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : Number(v).toFixed(2));
const fmtMins2 = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${Number(v).toFixed(2)}m`);
const fmtDelta = (v: number | null, unit = "pp") => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}${unit}`);
const within = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const statusHigherBetter = (value: number | null, targetMin: number, tol = 0.002): MetricStatus => (value == null || !Number.isFinite(value) ? "na" : value >= targetMin + tol ? "good" : within(value, targetMin, tol) ? "ok" : "bad");
const statusLowerBetter = (value: number | null, targetMax: number, tol = 0.002): MetricStatus => (value == null || !Number.isFinite(value) ? "na" : value <= targetMax - tol ? "good" : within(value, targetMax, tol) ? "ok" : "bad");
const statusAbsLowerBetter = (value: number | null, targetAbsMax: number, tol = 0.002): MetricStatus => (value == null || !Number.isFinite(value) ? "na" : Math.abs(value) <= targetAbsMax - tol ? "good" : within(Math.abs(value), targetAbsMax, tol) ? "ok" : "bad");
const getTargetsForStore = (store: string, inputs: StoreInputRow | null): Targets => {
  const base = DEFAULT_TARGETS[store] || { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 };
  const extFromInputs01 = inputs?.target_extremes_over40_pct != null ? to01From100(inputs.target_extremes_over40_pct) : null;
  return { ...base, extremesMax01: extFromInputs01 ?? base.extremesMax01 };
};
const pillClassFromStatus = (s: MetricStatus) => (s === "good" ? "pill green" : s === "ok" ? "pill amber" : s === "bad" ? "pill red" : "pill");

const sparklinePath = (points: (number | null)[], w = 130, h = 30) => {
  const vals = points.map((v) => (v == null || !Number.isFinite(v) ? null : v)).filter((v): v is number => v != null);
  if (!vals.length) return "";
  const min = Math.min(...vals); const max = Math.max(...vals); const span = max - min || 1;
  return points.map((v, i) => {
    if (v == null || !Number.isFinite(v)) return null;
    const x = (i / Math.max(1, points.length - 1)) * w;
    const y = h - ((v - min) / span) * h;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).filter(Boolean).join(" ");
};

export default function DailyUpdateClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [sdlwDate, setSdlwDate] = useState("");
  const [areaMessage, setAreaMessage] = useState("");
  const [storeInputs, setStoreInputs] = useState<StoreInputRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [serviceRows, setServiceRows] = useState<ServiceShiftRow[]>([]);
  const [serviceWtdRows, setServiceWtdRows] = useState<ServiceShiftRow[]>([]);
  const [costRows, setCostRows] = useState<CostControlRow[]>([]);
  const [costWtdRows, setCostWtdRows] = useState<CostControlRow[]>([]);
  const [osaWtdRows, setOsaWtdRows] = useState<OsaInternalRow[]>([]);
  const [osaTrendRows, setOsaTrendRows] = useState<OsaInternalRow[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => { (async () => {
    try {
      setLoading(true); setError(null);
      const day = getPreviousBusinessDayUk(); const wk = getWeekStartUK(day); const sdlw = minusDaysUK(day, 7); const trendStart = minusDaysUK(day, 6);
      setTargetDate(day); setWeekStart(wk); setSdlwDate(sdlw);
      const [areaMsg, inputs, taskRows, svcCmp, svcWtd, costDay, costWtd, osaWtd, osaTrend] = await Promise.all([
        supabase.from("daily_update_area_message").select("date,message").eq("date", day).maybeSingle(),
        supabase.from("daily_update_store_inputs").select("*").eq("date", day),
        supabase.from("daily_update_store_tasks").select("*").eq("date", day).order("created_at", { ascending: true }),
        supabase.from("service_shifts").select("shift_date,store,dot_pct,labour_pct,extreme_over_40,rnl_minutes,additional_hours").in("shift_date", [day, sdlw]),
        supabase.from("service_shifts").select("shift_date,store,dot_pct,labour_pct,rnl_minutes,manager").gte("shift_date", wk).lte("shift_date", day),
        supabase.from("cost_control_entries").select("*").eq("shift_date", day),
        supabase.from("cost_control_entries").select("*").gte("shift_date", wk).lte("shift_date", day),
        supabase.from("osa_internal_results").select("shift_date,store,team_member_name,points_lost").gte("shift_date", wk).lte("shift_date", day),
        supabase.from("osa_internal_results").select("shift_date,store,points_lost").gte("shift_date", trendStart).lte("shift_date", day),
      ]);
      const firstErr = [areaMsg.error, inputs.error, taskRows.error, svcCmp.error, svcWtd.error, costDay.error, costWtd.error, osaWtd.error, osaTrend.error].find(Boolean);
      if (firstErr) throw new Error(firstErr.message);
      setAreaMessage(((areaMsg.data as AreaMessageRow | null)?.message ?? "").trim());
      setStoreInputs((inputs.data || []) as StoreInputRow[]);
      setTasks((taskRows.data || []) as TaskRow[]);
      setServiceRows((svcCmp.data || []) as ServiceShiftRow[]);
      setServiceWtdRows((svcWtd.data || []) as ServiceShiftRow[]);
      setCostRows((costDay.data || []) as CostControlRow[]);
      setCostWtdRows((costWtd.data || []) as CostControlRow[]);
      setOsaWtdRows((osaWtd.data || []) as OsaInternalRow[]);
      setOsaTrendRows((osaTrend.data || []) as OsaInternalRow[]);
      const seen = new Set<string>();
      [...(inputs.data || []), ...(svcCmp.data || []), ...(costDay.data || [])].forEach((r: any) => r?.store && seen.add(r.store));
      setStores([...seen].sort());
    } catch (e: any) { setError(e?.message || "Failed to load"); }
    finally { setLoading(false); }
  })(); }, []);

  const inputsByStore = useMemo(() => new Map(storeInputs.map((r) => [r.store, r])), [storeInputs]);
  const tasksByStore = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    tasks.forEach((t) => m.set(t.store, [...(m.get(t.store) || []), t]));
    return m;
  }, [tasks]);

  const serviceByStoreDay = useMemo(() => {
    const m = new Map<string, { y: ServiceShiftRow[]; s: ServiceShiftRow[] }>();
    stores.forEach((s) => m.set(s, { y: [], s: [] }));
    serviceRows.forEach((r) => {
      if (!m.has(r.store)) m.set(r.store, { y: [], s: [] });
      if (r.shift_date === targetDate) m.get(r.store)!.y.push(r);
      if (r.shift_date === sdlwDate) m.get(r.store)!.s.push(r);
    });
    return m;
  }, [serviceRows, stores, targetDate, sdlwDate]);

  const osaByStoreWtd = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    osaWtdRows.forEach((r) => {
      const store = (r.store || "").trim();
      if (!store) return;
      const p = Number(r.points_lost);
      if (!m.has(store)) m.set(store, { total: 0, count: 0 });
      if (Number.isFinite(p)) { const cur = m.get(store)!; cur.total += p; cur.count += 1; }
    });
    return m;
  }, [osaWtdRows]);

  const topManager = useMemo(() => {
    const bucket: Record<string, { dot: number[]; labour: number[]; rnl: number[] }> = {};
    serviceWtdRows.forEach((r) => {
      const m = (r.manager || "Unknown").trim() || "Unknown";
      if (!bucket[m]) bucket[m] = { dot: [], labour: [], rnl: [] };
      const d = normalisePct01(r.dot_pct); const l = normalisePct01(r.labour_pct);
      if (d != null) bucket[m].dot.push(d); if (l != null) bucket[m].labour.push(l); if (r.rnl_minutes != null) bucket[m].rnl.push(r.rnl_minutes);
    });
    return Object.entries(bucket).map(([name, v]) => ({ name, dot: avg(v.dot), labour: avg(v.labour), rnl: avg(v.rnl) }))
      .sort((a, b) => (b.dot ?? -1) - (a.dot ?? -1) || (a.labour ?? 9) - (b.labour ?? 9) || (a.rnl ?? 99) - (b.rnl ?? 99))[0] || null;
  }, [serviceWtdRows]);

  const bestOsa = useMemo(() => {
    const bucket: Record<string, { total: number; count: number }> = {};
    osaWtdRows.forEach((r) => {
      const name = (r.team_member_name || "Unknown").trim() || "Unknown";
      const points = Number(r.points_lost);
      if (!Number.isFinite(points)) return;
      if (!bucket[name]) bucket[name] = { total: 0, count: 0 };
      bucket[name].total += points; bucket[name].count += 1;
    });
    return Object.entries(bucket).map(([name, v]) => ({ name, avgPointsLost: v.total / v.count })).sort((a, b) => a.avgPointsLost - b.avgPointsLost)[0] || null;
  }, [osaWtdRows]);

  const topStoreFood = useMemo(() => {
    const bucket: Record<string, { sales: number; ideal: number; actual: number }> = {};
    costWtdRows.forEach((r) => {
      if (!bucket[r.store]) bucket[r.store] = { sales: 0, ideal: 0, actual: 0 };
      bucket[r.store].sales += Number(r.sales_gbp || 0); bucket[r.store].ideal += Number(r.ideal_food_cost_gbp || 0); bucket[r.store].actual += Number(r.actual_food_cost_gbp || 0);
    });
    return Object.entries(bucket).map(([store, v]) => ({ store, foodVarPct: v.sales > 0 ? (v.actual - v.ideal) / v.sales : null }))
      .sort((a, b) => Math.abs(a.foodVarPct ?? 99) - Math.abs(b.foodVarPct ?? 99))[0] || null;
  }, [costWtdRows]);

  const trendDates = useMemo(() => (targetDate ? rangeDatesUK(targetDate, 7) : []), [targetDate]);
  const microTrends = useMemo(() => {
    const labour: (number | null)[] = []; const food: (number | null)[] = []; const osa: (number | null)[] = [];
    trendDates.forEach((d) => {
      const dayCost = costWtdRows.filter((r) => r.shift_date === d || costRows.some((c) => c.shift_date === d));
      const sales = sum(dayCost.map((r) => Number(r.sales_gbp || 0)));
      const labourCost = sum(dayCost.map((r) => Number(r.labour_cost_gbp || 0)));
      const ideal = sum(dayCost.map((r) => Number(r.ideal_food_cost_gbp || 0)));
      const actual = sum(dayCost.map((r) => Number(r.actual_food_cost_gbp || 0)));
      labour.push(sales > 0 ? labourCost / sales : null); food.push(sales > 0 ? (actual - ideal) / sales : null);
      const dayOsa = osaTrendRows.filter((r) => r.shift_date === d).map((r) => Number(r.points_lost)).filter(Number.isFinite);
      osa.push(dayOsa.length ? avg(dayOsa as number[]) : null);
    });
    return { labour, food, osa };
  }, [trendDates, costWtdRows, costRows, osaTrendRows]);

  const cards = useMemo(() => stores.map((store) => {
    const inputs = inputsByStore.get(store) || null;
    const targets = getTargetsForStore(store, inputs);
    const cost = costRows.filter((r) => r.store === store);
    const y = serviceByStoreDay.get(store)?.y || []; const s = serviceByStoreDay.get(store)?.s || [];
    const sales = sum(cost.map((r) => Number(r.sales_gbp || 0))); const labourCost = sum(cost.map((r) => Number(r.labour_cost_gbp || 0)));
    const ideal = sum(cost.map((r) => Number(r.ideal_food_cost_gbp || 0))); const actual = sum(cost.map((r) => Number(r.actual_food_cost_gbp || 0)));
    const dot = avg(y.map((r) => normalisePct01(r.dot_pct)).filter((v): v is number => v != null));
    const dotS = avg(s.map((r) => normalisePct01(r.dot_pct)).filter((v): v is number => v != null));
    const rnl = avg(y.map((r) => r.rnl_minutes).filter((v): v is number => v != null));
    const rnlS = avg(s.map((r) => r.rnl_minutes).filter((v): v is number => v != null));
    const ext = avg(y.map((r) => normalisePct01(r.extreme_over_40)).filter((v): v is number => v != null));
    const extS = avg(s.map((r) => normalisePct01(r.extreme_over_40)).filter((v): v is number => v != null));
    const addHours = sum(y.map((r) => Number(r.additional_hours || 0)));
    const labourPct = sales > 0 ? labourCost / sales : null; const foodPct = sales > 0 ? (actual - ideal) / sales : null;
    const osaStats = osaByStoreWtd.get(store); const osaAvg = osaStats && osaStats.count > 0 ? osaStats.total / osaStats.count : null;
    const daily = { missed: to01From100(inputs?.missed_calls_wtd ?? null), gps: to01From100(inputs?.gps_tracked_wtd ?? null), aof: to01From100(inputs?.aof_wtd ?? null) };
    const dotDelta = dot != null && dotS != null ? dot - dotS : null;
    const issues = [
      { hit: dot != null && (dot < targets.dotMin01 || (dotDelta != null && dotDelta <= -0.03)), label: "DOT", value: fmtPct2(dot), comp: dotDelta != null && dotDelta <= -0.03 ? `vs SDLW ${fmtPct2(dotS)}` : `Target ≥ ${(targets.dotMin01 * 100).toFixed(0)}%`, status: "bad" as MetricStatus },
      { hit: ext != null && ext > targets.extremesMax01, label: "Extremes >40", value: fmtPct2(ext), comp: `Target ≤ ${(targets.extremesMax01 * 100).toFixed(0)}%`, status: "bad" as MetricStatus },
      { hit: rnl != null && rnl > targets.rnlMaxMins, label: "R&L", value: fmtMins2(rnl), comp: `Target ≤ ${targets.rnlMaxMins.toFixed(0)}m`, status: "bad" as MetricStatus },
      { hit: foodPct != null && Math.abs(foodPct) > targets.foodVarAbsMax01, label: "Food variance", value: fmtPct2(foodPct), comp: `Target abs ≤ ${(targets.foodVarAbsMax01 * 100).toFixed(2)}%`, status: "bad" as MetricStatus },
      { hit: labourPct != null && labourPct > targets.labourMax01, label: "Labour", value: fmtPct2(labourPct), comp: `Target ≤ ${(targets.labourMax01 * 100).toFixed(0)}%`, status: "bad" as MetricStatus },
      { hit: daily.missed != null && daily.missed > 0.06, label: "Missed calls", value: fmtPct2(daily.missed), comp: "Target ≤ 6%", status: "bad" as MetricStatus },
      { hit: daily.gps != null && daily.gps < 0.95, label: "GPS", value: fmtPct2(daily.gps), comp: "Target ≥ 95%", status: "bad" as MetricStatus },
      { hit: daily.aof != null && daily.aof < 0.62, label: "AOF", value: fmtPct2(daily.aof), comp: "Target ≥ 62%", status: "bad" as MetricStatus },
      { hit: addHours > 1, label: "Additional hours", value: fmtNum2(addHours), comp: "Target ≤ 1", status: "bad" as MetricStatus },
    ];
    return { store, targets, inputs, tasks: tasksByStore.get(store) || [], osaAvg, dot, labourPct, rnl, ext, addHours, foodPct, dotS, rnlS, extS, daily, keySignal: issues.find((i) => i.hit) || null };
  }).sort((a, b) => (b.dot ?? -1) - (a.dot ?? -1) || (a.labourPct ?? 9) - (b.labourPct ?? 9)).map((c, i) => ({ ...c, rank: i + 1 })), [stores, inputsByStore, costRows, serviceByStoreDay, osaByStoreWtd, tasksByStore]);

  if (loading) return <main className="wrap"><p>Loading…</p></main>;
  if (error) return <main className="wrap"><p>Failed to load: {error}</p></main>;

  const areaLabour = statusLowerBetter(avg(cards.map((c) => c.labourPct).filter((v): v is number => v != null)), AREA_TARGETS.labourMax01);
  const areaFood = statusAbsLowerBetter(avg(cards.map((c) => c.foodPct).filter((v): v is number => v != null)), AREA_TARGETS.foodVarAbsMax01);

  return <div className="wrap">
    <div className="banner"><img src="/mourneoids_forms_header.png" alt="Mourne-oids" /></div>
    <div className="shell">
      <div className="topbar"><button className="navbtn" onClick={() => router.push("/dashboard")}>← Dashboard</button><button className="navbtn" onClick={() => router.push("/dashboard/daily-update/export")}>Export PDF</button><span className="topbar-spacer"/><button className="navbtn solid" onClick={() => setShowDetails((v) => !v)}>{showDetails ? "Hide details" : "Show details"}</button></div>
      <header className="header"><h1>Daily Update</h1><p className="subtitle">{targetDate} · WTD from {weekStart}</p></header>

      <section className="section"><div className="section-head"><h2>Area Overview</h2></div><div className="areaOverview"> 
        <span className="kpi-chip">Labour <span className={pillClassFromStatus(areaLabour)}>{fmtPct2(avg(cards.map((c) => c.labourPct).filter((v): v is number => v != null)))}</span></span>
        <span className="kpi-chip">Food variance <span className={pillClassFromStatus(areaFood)}>{fmtPct2(avg(cards.map((c) => c.foodPct).filter((v): v is number => v != null)))}</span></span>
        <span className="kpi-chip">Additional hours <span className="pill">{fmtNum2(sum(cards.map((c) => c.addHours)))}</span></span>
      </div></section>

      <section className="section"><div className="section-head"><h2>Area Message</h2></div><div className="areaMessage">{areaMessage || "No area message for today."}</div></section>

      <section className="section"><div className="section-head"><h2>Highlights</h2></div><div className="highlights-grid">
        <article className="highlight-card"><div className="highlightTitle">Top Manager (WTD)</div><div className="highlightName">{topManager?.name || "No data"}</div><div className="highlightBody">DOT {fmtPct2(topManager?.dot ?? null)} · Labour {fmtPct2(topManager?.labour ?? null)} · R&L {fmtMins2(topManager?.rnl ?? null)}</div></article>
        <article className="highlight-card"><div className="highlightTitle">Best OSA (WTD)</div><div className="highlightName">{bestOsa?.name || "No data"}</div><div className="highlightBody">Avg points lost {bestOsa?.avgPointsLost == null ? "—" : bestOsa.avgPointsLost.toFixed(1)}</div></article>
        <article className="highlight-card"><div className="highlightTitle">Top Store Food (WTD)</div><div className="highlightName">{topStoreFood?.store || "No data"}</div><div className="highlightBody">Food variance {fmtPct2(topStoreFood?.foodVarPct ?? null)}</div></article>
      </div></section>

      <section className="section"><div className="section-head"><h2>Key Signals</h2></div>{cards.map((c) => <div className="signalRow" key={c.store}><strong>{c.store}</strong>{c.keySignal ? <><span className="pill red">{c.keySignal.label}: {c.keySignal.value}</span><span className="muted">{c.keySignal.comp}</span></> : <span className="pill green">All good</span>}</div>)}</section>

      <section className="section"><div className="section-head"><h2>Mini Trends (7 days)</h2></div><div className="highlights-grid">
        {[["Labour %", microTrends.labour, fmtPct2(microTrends.labour[microTrends.labour.length - 1] ?? null)], ["Food variance %", microTrends.food, fmtPct2(microTrends.food[microTrends.food.length - 1] ?? null)], ["OSA avg points lost", microTrends.osa, microTrends.osa[microTrends.osa.length - 1] == null ? "—" : (microTrends.osa[microTrends.osa.length - 1] as number).toFixed(1)]].map(([label, series, latest]) => <article className="highlight-card" key={String(label)}><div className="trendTop"><span>{String(label)}</span><span className="pill">{String(latest)}</span></div><svg width="130" height="30" viewBox="0 0 130 30"><path d={sparklinePath(series as (number | null)[])} stroke="#006491" fill="none" strokeWidth="2"/></svg></article>)}
      </div></section>

      <section className="section"><div className="section-head"><h2>Stores (ranked by DOT)</h2></div><div className="storesGrid">{cards.map((c) => {
        const dotSdlw = c.dot != null && c.dotS != null ? c.dot - c.dotS : null; const rnlSdlw = c.rnl != null && c.rnlS != null ? c.rnl - c.rnlS : null; const extSdlw = c.ext != null && c.extS != null ? c.ext - c.extS : null;
        return <article key={c.store} className="storeCard"><div className="storeTitleRow"><div className="storeName">{c.store} <span className="pill">#{c.rank}</span></div><span className="pill">OSA WTD {c.osaAvg == null ? "—" : c.osaAvg.toFixed(1)}</span></div>
          <div className="metricsList">
            <div className="metricRow"><div><div className="rowLabel">DOT</div><div className="rowHint">vs SDLW {fmtPct2(c.dotS)} {fmtDelta(dotSdlw == null ? null : dotSdlw * 100)}</div></div><span className={pillClassFromStatus(statusHigherBetter(c.dot, c.targets.dotMin01))}>{fmtPct2(c.dot)}</span></div>
            <div className="metricRow"><div><div className="rowLabel">R&L</div><div className="rowHint">vs SDLW {fmtMins2(c.rnlS)} {fmtDelta(rnlSdlw, "m")}</div></div><span className={pillClassFromStatus(statusLowerBetter(c.rnl, c.targets.rnlMaxMins, 0.1))}>{fmtMins2(c.rnl)}</span></div>
            <div className="metricRow"><div><div className="rowLabel">Extremes &gt;40</div><div className="rowHint">vs SDLW {fmtPct2(c.extS)} {fmtDelta(extSdlw == null ? null : extSdlw * 100)}</div></div><span className={pillClassFromStatus(statusLowerBetter(c.ext, c.targets.extremesMax01))}>{fmtPct2(c.ext)}</span></div>
            <div className="metricRow"><div className="rowLabel">Labour</div><span className={pillClassFromStatus(statusLowerBetter(c.labourPct, c.targets.labourMax01))}>{fmtPct2(c.labourPct)}</span></div>
            <div className="metricRow"><div className="rowLabel">Food variance</div><span className={pillClassFromStatus(statusAbsLowerBetter(c.foodPct, c.targets.foodVarAbsMax01))}>{fmtPct2(c.foodPct)}</span></div>
          </div>
          {showDetails ? <div className="detailsGrid"><div className="panel"><h4>Service losing targets</h4><div className="kvGrid"><span className="pill">Load {fmtNum2(c.inputs?.target_load_time_mins ?? null)}</span><span className="pill">Rack {fmtNum2(c.inputs?.target_rack_time_mins ?? null)}</span><span className="pill">ADT {fmtNum2(c.inputs?.target_adt_mins ?? null)}</span><span className="pill">Ext {c.inputs?.target_extremes_over40_pct == null ? "—" : `${c.inputs.target_extremes_over40_pct.toFixed(2)}%`}</span></div></div><div className="panel"><h4>Notes</h4><p>{c.inputs?.notes?.trim() || "—"}</p></div><div className="panel"><h4>Tasks</h4><ul>{c.tasks.length ? c.tasks.map((t) => <li key={t.id}>{t.task}</li>) : <li>No tasks</li>}</ul></div></div> : null}
        </article>;
      })}</div></section>
    </div>

    <style jsx>{`
      .wrap{min-height:100dvh;background:radial-gradient(circle at top,rgba(0,100,145,.08),transparent 45%),linear-gradient(180deg,#e3edf4 0%,#f2f5f9 30%,#f2f5f9 100%);display:flex;flex-direction:column;align-items:center;color:#0f172a;padding-bottom:40px}
      .banner{display:flex;justify-content:center;align-items:center;background:#fff;border-bottom:3px solid #006491;box-shadow:0 12px 35px rgba(2,6,23,.08);width:100%}.banner img{max-width:min(1160px,92%);height:auto;display:block}
      .shell{width:min(1100px,94vw);margin-top:18px;background:rgba(255,255,255,.65);backdrop-filter:saturate(160%) blur(6px);border:1px solid rgba(255,255,255,.22);border-radius:1.5rem;box-shadow:0 16px 40px rgba(0,0,0,.05);padding:18px 22px 26px}
      .topbar{display:flex;gap:10px;flex-wrap:wrap}.topbar-spacer{flex:1}.navbtn{border-radius:14px;border:2px solid #006491;background:#fff;color:#006491;font-weight:900;padding:8px 12px}.navbtn.solid{background:#006491;color:#fff}
      .header{text-align:center}.subtitle{color:#64748b;font-weight:700}
      .section{margin-top:16px;background:rgba(255,255,255,.92);border-radius:18px;border:1px solid rgba(0,100,145,.14);box-shadow:0 12px 28px rgba(2,6,23,.05);padding:14px}
      .section-head h2{margin:0;font-size:16px;font-weight:900}
      .areaOverview{display:flex;gap:10px;flex-wrap:wrap}.kpi-chip{font-size:14px;font-weight:900;padding:7px 12px;border-radius:999px;background:rgba(0,100,145,.08);border:1px solid rgba(0,100,145,.14);display:inline-flex;gap:8px;align-items:center}
      .pill{display:inline-flex;align-items:center;justify-content:center;min-width:72px;padding:4px 10px;border-radius:999px;font-weight:900;border:1px solid rgba(15,23,42,.08);background:rgba(2,6,23,.04)}.pill.green{background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.22);color:#166534}.pill.amber{background:rgba(249,115,22,.12);border-color:rgba(249,115,22,.22);color:#9a3412}.pill.red{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.22);color:#991b1b}
      .areaMessage{border-left:3px solid #006491;background:rgba(0,100,145,.07);padding:12px 14px;border-radius:12px;font-size:15px;line-height:1.55;font-weight:700;color:#0f2f45}
      .highlights-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.highlight-card{background:rgba(255,255,255,.92);border-radius:16px;border:1px solid rgba(0,100,145,.14);box-shadow:0 12px 28px rgba(2,6,23,.05);padding:12px 14px}.highlightTitle{font-size:12px;font-weight:900;text-transform:uppercase}.highlightName{font-size:17px;font-weight:900;margin-top:8px}.highlightBody{margin-top:6px;font-size:13px;color:#334155;font-weight:700}.trendTop{display:flex;justify-content:space-between;margin-bottom:8px}
      .signalRow{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px dashed rgba(100,116,139,.25)}.signalRow:last-child{border-bottom:none}.muted{color:#64748b;font-size:12px;font-weight:700}
      .storesGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.storeCard{background:#fff;border:1px solid rgba(0,100,145,.14);border-radius:16px;padding:12px;box-shadow:0 8px 18px rgba(2,6,23,.05)}.storeTitleRow{display:flex;justify-content:space-between;align-items:center;gap:8px}.storeName{font-size:18px;font-weight:900}
      .metricsList{display:grid;gap:8px;margin-top:10px}.metricRow{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px;border:1px solid rgba(15,23,42,.07);border-radius:12px;background:rgba(248,250,252,.9)}.rowLabel{font-weight:900}.rowHint{font-size:12px;color:#64748b;font-weight:700}
      .detailsGrid{display:grid;gap:10px;margin-top:10px}.panel{background:rgba(255,255,255,.9);border:1px solid rgba(0,100,145,.14);border-radius:12px;padding:10px}.panel h4{margin:0 0 8px;font-size:15px;line-height:1.45}.panel p,.panel li{font-size:14px;line-height:1.5;font-weight:600}.kvGrid{display:flex;gap:6px;flex-wrap:wrap}
      @media (max-width:920px){.highlights-grid,.storesGrid{grid-template-columns:1fr}}
    `}</style>
  </div>;
}
