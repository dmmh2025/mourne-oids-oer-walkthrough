"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type MetricStatus = "good" | "ok" | "bad" | "na";
type StoreInputRow = { date: string; store: string; missed_calls_wtd: number | null; gps_tracked_wtd: number | null; aof_wtd: number | null; target_load_time_mins: number | null; target_rack_time_mins: number | null; target_adt_mins: number | null; target_extremes_over40_pct: number | null; notes: string | null };
type TaskRow = { id: string; date: string; store: string; task: string; is_complete: boolean };
type ServiceShiftRow = { shift_date: string; store: string; dot_pct: number | null; labour_pct: number | null; extreme_over_40: number | null; rnl_minutes: number | null; additional_hours: number | null; manager?: string | null };
type CostControlRow = { shift_date: string; store: string; sales_gbp: number | null; labour_cost_gbp: number | null; ideal_food_cost_gbp: number | null; actual_food_cost_gbp: number | null };
type OsaInternalRow = { shift_date: string; store: string | null; team_member_name?: string | null; points_lost?: number | null };
type Targets = { dotMin01: number; labourMax01: number; rnlMaxMins: number; extremesMax01: number; foodVarAbsMax01: number };

const DEFAULT_TARGETS: Record<string, Targets> = {
  Downpatrick: { dotMin01: 0.82, labourMax01: 0.25, rnlMaxMins: 9, extremesMax01: 0.03, foodVarAbsMax01: 0.003 },
  Kilkeel: { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 8, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
  Newcastle: { dotMin01: 0.78, labourMax01: 0.25, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
  Ballynahinch: { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
};

const toISODateUK = (date: Date) => { const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date); return `${p.find((x) => x.type === "year")?.value}-${p.find((x) => x.type === "month")?.value}-${p.find((x) => x.type === "day")?.value}`; };
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

const statusHigherBetter = (v: number | null, t: number): MetricStatus => (v == null ? "na" : v >= t ? "good" : "bad");
const statusLowerBetter = (v: number | null, t: number): MetricStatus => (v == null ? "na" : v <= t ? "good" : "bad");
const statusAbsLowerBetter = (v: number | null, t: number): MetricStatus => (v == null ? "na" : Math.abs(v) <= t ? "good" : "bad");
const pillClassFromStatus = (s: MetricStatus) => (s === "good" ? "pill green" : s === "bad" ? "pill red" : "pill");
const getTargetsForStore = (store: string, i: StoreInputRow | null): Targets => ({ ...(DEFAULT_TARGETS[store] || DEFAULT_TARGETS.Kilkeel), extremesMax01: i?.target_extremes_over40_pct != null ? to01From100(i.target_extremes_over40_pct)! : (DEFAULT_TARGETS[store] || DEFAULT_TARGETS.Kilkeel).extremesMax01 });
const sparklinePath = (points: (number | null)[], w = 130, h = 30) => { const vals = points.filter((v): v is number => v != null && Number.isFinite(v)); if (!vals.length) return ""; const min = Math.min(...vals); const max = Math.max(...vals); const span = max - min || 1; return points.map((v, i) => v == null ? null : `${i === 0 ? "M" : "L"}${((i / Math.max(points.length - 1, 1)) * w).toFixed(1)},${(h - (((v - min) / span) * h)).toFixed(1)}`).filter(Boolean).join(" "); };
const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

function PrintTrigger() { useEffect(() => { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); }, []); return null; }

export default function DailyUpdateExportPage() {
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(""); const [weekStart, setWeekStart] = useState(""); const [sdlwDate, setSdlwDate] = useState("");
  const [areaMessage, setAreaMessage] = useState(""); const [storeInputs, setStoreInputs] = useState<StoreInputRow[]>([]); const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [serviceRows, setServiceRows] = useState<ServiceShiftRow[]>([]); const [serviceWtdRows, setServiceWtdRows] = useState<ServiceShiftRow[]>([]);
  const [costRows, setCostRows] = useState<CostControlRow[]>([]); const [costWtdRows, setCostWtdRows] = useState<CostControlRow[]>([]);
  const [osaWtdRows, setOsaWtdRows] = useState<OsaInternalRow[]>([]); const [osaTrendRows, setOsaTrendRows] = useState<OsaInternalRow[]>([]);
  const [stores, setStores] = useState<string[]>([]);

  useEffect(() => { (async () => {
    try {
      setLoading(true); setError(null);
      const day = getPreviousBusinessDayUk(); const wk = getWeekStartUK(day); const sdlw = minusDaysUK(day, 7); const trendStart = minusDaysUK(day, 6);
      setTargetDate(day); setWeekStart(wk); setSdlwDate(sdlw);
      const [msg, inputs, tsk, svcCmp, svcWtd, costDay, costWtd, osaWtd, osaTrend] = await Promise.all([
        supabase.from("daily_update_area_message").select("message").eq("date", day).maybeSingle(),
        supabase.from("daily_update_store_inputs").select("*").eq("date", day),
        supabase.from("daily_update_store_tasks").select("id,date,store,task,is_complete").eq("date", day),
        supabase.from("service_shifts").select("shift_date,store,dot_pct,labour_pct,extreme_over_40,rnl_minutes,additional_hours").in("shift_date", [day, sdlw]),
        supabase.from("service_shifts").select("shift_date,store,dot_pct,labour_pct,rnl_minutes,manager").gte("shift_date", wk).lte("shift_date", day),
        supabase.from("cost_control_entries").select("*").eq("shift_date", day),
        supabase.from("cost_control_entries").select("*").gte("shift_date", wk).lte("shift_date", day),
        supabase.from("osa_internal_results").select("shift_date,store,team_member_name,points_lost").gte("shift_date", wk).lte("shift_date", day),
        supabase.from("osa_internal_results").select("shift_date,store,points_lost").gte("shift_date", trendStart).lte("shift_date", day),
      ]);
      const firstErr = [msg.error, inputs.error, tsk.error, svcCmp.error, svcWtd.error, costDay.error, costWtd.error, osaWtd.error, osaTrend.error].find(Boolean);
      if (firstErr) throw new Error(firstErr.message);
      setAreaMessage((msg.data as any)?.message || ""); setStoreInputs((inputs.data || []) as StoreInputRow[]); setTasks((tsk.data || []) as TaskRow[]);
      setServiceRows((svcCmp.data || []) as ServiceShiftRow[]); setServiceWtdRows((svcWtd.data || []) as ServiceShiftRow[]);
      setCostRows((costDay.data || []) as CostControlRow[]); setCostWtdRows((costWtd.data || []) as CostControlRow[]);
      setOsaWtdRows((osaWtd.data || []) as OsaInternalRow[]); setOsaTrendRows((osaTrend.data || []) as OsaInternalRow[]);
      const seen = new Set<string>(); [...(inputs.data || []), ...(svcCmp.data || []), ...(costDay.data || [])].forEach((r: any) => r?.store && seen.add(r.store)); setStores([...seen].sort());
    } catch (e: any) { setError(e?.message || "Failed"); } finally { setLoading(false); }
  })(); }, []);

  const inputsByStore = useMemo(() => new Map(storeInputs.map((r) => [r.store, r])), [storeInputs]);
  const tasksByStore = useMemo(() => { const m = new Map<string, TaskRow[]>(); tasks.forEach((t) => m.set(t.store, [...(m.get(t.store) || []), t])); return m; }, [tasks]);
  const serviceByStoreDay = useMemo(() => { const m = new Map<string, { y: ServiceShiftRow[]; s: ServiceShiftRow[] }>(); serviceRows.forEach((r) => { if (!m.has(r.store)) m.set(r.store, { y: [], s: [] }); if (r.shift_date === targetDate) m.get(r.store)!.y.push(r); if (r.shift_date === sdlwDate) m.get(r.store)!.s.push(r); }); return m; }, [serviceRows, targetDate, sdlwDate]);
  const osaByStoreWtd = useMemo(() => { const m = new Map<string, { total: number; count: number }>(); osaWtdRows.forEach((r) => { const s = (r.store || "").trim(); const p = Number(r.points_lost); if (!s || !Number.isFinite(p)) return; if (!m.has(s)) m.set(s, { total: 0, count: 0 }); m.get(s)!.total += p; m.get(s)!.count += 1; }); return m; }, [osaWtdRows]);

  const topManager = useMemo(() => {
    const bucket: Record<string, { d: number[]; l: number[]; r: number[] }> = {};
    serviceWtdRows.forEach((row) => { const n = (row.manager || "Unknown").trim() || "Unknown"; if (!bucket[n]) bucket[n] = { d: [], l: [], r: [] }; const d = normalisePct01(row.dot_pct); const l = normalisePct01(row.labour_pct); if (d != null) bucket[n].d.push(d); if (l != null) bucket[n].l.push(l); if (row.rnl_minutes != null) bucket[n].r.push(row.rnl_minutes); });
    return Object.entries(bucket).map(([name, v]) => ({ name, dot: avg(v.d), labour: avg(v.l), rnl: avg(v.r) })).sort((a, b) => (b.dot ?? -1) - (a.dot ?? -1) || (a.labour ?? 9) - (b.labour ?? 9) || (a.rnl ?? 99) - (b.rnl ?? 99))[0] || null;
  }, [serviceWtdRows]);
  const bestOsa = useMemo(() => { const b: Record<string, { t: number; c: number }> = {}; osaWtdRows.forEach((r) => { const n = (r.team_member_name || "Unknown").trim() || "Unknown"; const p = Number(r.points_lost); if (!Number.isFinite(p)) return; if (!b[n]) b[n] = { t: 0, c: 0 }; b[n].t += p; b[n].c += 1; }); return Object.entries(b).map(([name, v]) => ({ name, avgPointsLost: v.t / v.c })).sort((a, b) => a.avgPointsLost - b.avgPointsLost)[0] || null; }, [osaWtdRows]);
  const topStoreFood = useMemo(() => { const b: Record<string, { s: number; i: number; a: number }> = {}; costWtdRows.forEach((r) => { if (!b[r.store]) b[r.store] = { s: 0, i: 0, a: 0 }; b[r.store].s += Number(r.sales_gbp || 0); b[r.store].i += Number(r.ideal_food_cost_gbp || 0); b[r.store].a += Number(r.actual_food_cost_gbp || 0); }); return Object.entries(b).map(([store, v]) => ({ store, foodVarPct: v.s > 0 ? (v.a - v.i) / v.s : null })).sort((x, y) => Math.abs(x.foodVarPct ?? 99) - Math.abs(y.foodVarPct ?? 99))[0] || null; }, [costWtdRows]);

  const trendDates = useMemo(() => (targetDate ? rangeDatesUK(targetDate, 7) : []), [targetDate]);
  const microTrends = useMemo(() => {
    const labour: (number | null)[] = []; const food: (number | null)[] = []; const osa: (number | null)[] = [];
    trendDates.forEach((d) => { const dayRows = costWtdRows.filter((r) => r.shift_date === d || costRows.some((c) => c.shift_date === d)); const sales = sum(dayRows.map((r) => Number(r.sales_gbp || 0))); const labourCost = sum(dayRows.map((r) => Number(r.labour_cost_gbp || 0))); const ideal = sum(dayRows.map((r) => Number(r.ideal_food_cost_gbp || 0))); const actual = sum(dayRows.map((r) => Number(r.actual_food_cost_gbp || 0))); labour.push(sales > 0 ? labourCost / sales : null); food.push(sales > 0 ? (actual - ideal) / sales : null); const o = osaTrendRows.filter((r) => r.shift_date === d).map((r) => Number(r.points_lost)).filter(Number.isFinite) as number[]; osa.push(o.length ? avg(o) : null); });
    return { labour, food, osa };
  }, [trendDates, costWtdRows, costRows, osaTrendRows]);

  const cards = useMemo(() => stores.map((store) => {
    const inputs = inputsByStore.get(store) || null; const targets = getTargetsForStore(store, inputs); const cost = costRows.filter((r) => r.store === store); const y = serviceByStoreDay.get(store)?.y || []; const s = serviceByStoreDay.get(store)?.s || [];
    const sales = sum(cost.map((r) => Number(r.sales_gbp || 0))); const labourCost = sum(cost.map((r) => Number(r.labour_cost_gbp || 0))); const ideal = sum(cost.map((r) => Number(r.ideal_food_cost_gbp || 0))); const actual = sum(cost.map((r) => Number(r.actual_food_cost_gbp || 0)));
    const dot = avg(y.map((r) => normalisePct01(r.dot_pct)).filter((v): v is number => v != null)); const dotS = avg(s.map((r) => normalisePct01(r.dot_pct)).filter((v): v is number => v != null));
    const rnl = avg(y.map((r) => r.rnl_minutes).filter((v): v is number => v != null)); const rnlS = avg(s.map((r) => r.rnl_minutes).filter((v): v is number => v != null));
    const ext = avg(y.map((r) => normalisePct01(r.extreme_over_40)).filter((v): v is number => v != null)); const extS = avg(s.map((r) => normalisePct01(r.extreme_over_40)).filter((v): v is number => v != null));
    const addHours = sum(y.map((r) => Number(r.additional_hours || 0))); const labourPct = sales > 0 ? labourCost / sales : null; const foodPct = sales > 0 ? (actual - ideal) / sales : null;
    const osaStats = osaByStoreWtd.get(store); const osaAvg = osaStats && osaStats.count > 0 ? osaStats.total / osaStats.count : null;
    const daily = { missed: to01From100(inputs?.missed_calls_wtd ?? null), gps: to01From100(inputs?.gps_tracked_wtd ?? null), aof: to01From100(inputs?.aof_wtd ?? null) };
    const dotDelta = dot != null && dotS != null ? dot - dotS : null;
    const keySignal = [
      { hit: dot != null && (dot < targets.dotMin01 || (dotDelta != null && dotDelta <= -0.03)), label: "DOT", value: fmtPct2(dot), comp: dotDelta != null && dotDelta <= -0.03 ? `vs SDLW ${fmtPct2(dotS)}` : `Target ≥ ${(targets.dotMin01 * 100).toFixed(0)}%` },
      { hit: ext != null && ext > targets.extremesMax01, label: "Extremes", value: fmtPct2(ext), comp: `Target ≤ ${(targets.extremesMax01 * 100).toFixed(0)}%` },
      { hit: rnl != null && rnl > targets.rnlMaxMins, label: "R&L", value: fmtMins2(rnl), comp: `Target ≤ ${targets.rnlMaxMins.toFixed(0)}m` },
      { hit: foodPct != null && Math.abs(foodPct) > targets.foodVarAbsMax01, label: "Food variance", value: fmtPct2(foodPct), comp: `Target abs ≤ ${(targets.foodVarAbsMax01 * 100).toFixed(2)}%` },
      { hit: labourPct != null && labourPct > targets.labourMax01, label: "Labour", value: fmtPct2(labourPct), comp: `Target ≤ ${(targets.labourMax01 * 100).toFixed(0)}%` },
      { hit: daily.missed != null && daily.missed > 0.06, label: "Missed calls", value: fmtPct2(daily.missed), comp: "Target ≤ 6%" },
      { hit: daily.gps != null && daily.gps < 0.95, label: "GPS", value: fmtPct2(daily.gps), comp: "Target ≥ 95%" },
      { hit: daily.aof != null && daily.aof < 0.62, label: "AOF", value: fmtPct2(daily.aof), comp: "Target ≥ 62%" },
      { hit: addHours > 1, label: "Additional hours", value: fmtNum2(addHours), comp: "Target ≤ 1" },
    ].find((x) => x.hit);
    return { store, rank: 0, targets, tasks: tasksByStore.get(store) || [], inputs, osaAvg, dot, dotS, rnl, rnlS, ext, extS, labourPct, foodPct, addHours, keySignal };
  }).sort((a, b) => (b.dot ?? -1) - (a.dot ?? -1) || (a.labourPct ?? 9) - (b.labourPct ?? 9)).map((c, i) => ({ ...c, rank: i + 1 })), [stores, inputsByStore, costRows, serviceByStoreDay, osaByStoreWtd, tasksByStore]);

  const storePages = useMemo(() => chunk(cards, 2), [cards]);
  if (loading) return <main className="exportShell"><p>Loading export…</p></main>;
  if (error) return <main className="exportShell"><p>Failed to load export: {error}</p></main>;

  return <main className="exportShell"><PrintTrigger />
    <section className="exportPage firstPage">
      <div className="banner"><img src="/mourneoids_forms_header.png" alt="Mourne-oids" /></div>
      <header><h1>Daily Update</h1><p>{targetDate} · WTD from {weekStart}</p></header>
      <div className="panel"><h2>Area Overview</h2><div className="row"><span className="kpi-chip">Labour <span className="pill">{fmtPct2(avg(cards.map((c) => c.labourPct).filter((v): v is number => v != null)))}</span></span><span className="kpi-chip">Food variance <span className="pill">{fmtPct2(avg(cards.map((c) => c.foodPct).filter((v): v is number => v != null)))}</span></span><span className="kpi-chip">Additional hours <span className="pill">{fmtNum2(sum(cards.map((c) => c.addHours)))}</span></span></div></div>
      <div className="panel"><h2>Area Message</h2><div className="areaMessage">{areaMessage || "No area message for today."}</div></div>
      <div className="panel"><h2>Highlights</h2><div className="highlights"><article className="highlight-card"><h3>Top Manager (WTD)</h3><p>{topManager?.name || "No data"}</p><small>DOT {fmtPct2(topManager?.dot ?? null)} · Labour {fmtPct2(topManager?.labour ?? null)} · R&L {fmtMins2(topManager?.rnl ?? null)}</small></article><article className="highlight-card"><h3>Best OSA (WTD)</h3><p>{bestOsa?.name || "No data"}</p><small>Avg points lost {bestOsa?.avgPointsLost == null ? "—" : bestOsa.avgPointsLost.toFixed(1)}</small></article><article className="highlight-card"><h3>Top Store Food (WTD)</h3><p>{topStoreFood?.store || "No data"}</p><small>Food variance {fmtPct2(topStoreFood?.foodVarPct ?? null)}</small></article></div></div>
      <div className="panel"><h2>Key Signals</h2>{cards.map((c) => <div key={c.store} className="signalRow"><strong>{c.store}</strong>{c.keySignal ? <><span className="pill red">{c.keySignal.label}: {c.keySignal.value}</span><small>{c.keySignal.comp}</small></> : <span className="pill green">All good</span>}</div>)}</div>
      <div className="panel"><h2>Mini Trends (7 days)</h2><div className="highlights">{[["Labour %", microTrends.labour, fmtPct2(microTrends.labour.at(-1) ?? null)], ["Food variance %", microTrends.food, fmtPct2(microTrends.food.at(-1) ?? null)], ["OSA avg points lost", microTrends.osa, microTrends.osa.at(-1) == null ? "—" : (microTrends.osa.at(-1) as number).toFixed(1)]].map(([label, series, latest]) => <article key={String(label)} className="highlight-card"><h3>{String(label)}</h3><div className="row"><span className="pill">{String(latest)}</span><svg width="130" height="30" viewBox="0 0 130 30"><path d={sparklinePath(series as (number | null)[])} stroke="#006491" fill="none" strokeWidth="2"/></svg></div></article>)}</div></div>
    </section>

    {storePages.map((pair, idx) => <section className="exportPage storesPage" key={idx}>{pair.map((c) => {
      const note = (c.inputs?.notes || "").trim(); const tasksTxt = c.tasks.map((t) => t.task); const clampNotes = note.length > 240; const clampTasks = tasksTxt.join(" ").length > 260;
      return <article className="storeCard" key={c.store}><div className="storeHead"><h3>{c.store}</h3><span className="pill">#{c.rank}</span><span className="pill">OSA WTD {c.osaAvg == null ? "—" : c.osaAvg.toFixed(1)}</span></div>
        <div className="metricGrid">
          <div className="metricRow"><span>DOT</span><span className={pillClassFromStatus(statusHigherBetter(c.dot, c.targets.dotMin01))}>{fmtPct2(c.dot)}</span><small>vs SDLW {fmtPct2(c.dotS)} {fmtDelta(c.dot != null && c.dotS != null ? (c.dot - c.dotS) * 100 : null)}</small></div>
          <div className="metricRow"><span>R&L</span><span className={pillClassFromStatus(statusLowerBetter(c.rnl, c.targets.rnlMaxMins))}>{fmtMins2(c.rnl)}</span><small>vs SDLW {fmtMins2(c.rnlS)} {fmtDelta(c.rnl != null && c.rnlS != null ? c.rnl - c.rnlS : null, "m")}</small></div>
          <div className="metricRow"><span>Extremes &gt;40</span><span className={pillClassFromStatus(statusLowerBetter(c.ext, c.targets.extremesMax01))}>{fmtPct2(c.ext)}</span><small>vs SDLW {fmtPct2(c.extS)} {fmtDelta(c.ext != null && c.extS != null ? (c.ext - c.extS) * 100 : null)}</small></div>
          <div className="metricRow"><span>Labour</span><span className={pillClassFromStatus(statusLowerBetter(c.labourPct, c.targets.labourMax01))}>{fmtPct2(c.labourPct)}</span></div>
          <div className="metricRow"><span>Food variance</span><span className={pillClassFromStatus(statusAbsLowerBetter(c.foodPct, c.targets.foodVarAbsMax01))}>{fmtPct2(c.foodPct)}</span></div>
        </div>
        <div className="cols"><div className="panel"><h4>Service losing targets</h4><div className="row"><span className="pill">Load {fmtNum2(c.inputs?.target_load_time_mins ?? null)}</span><span className="pill">Rack {fmtNum2(c.inputs?.target_rack_time_mins ?? null)}</span><span className="pill">ADT {fmtNum2(c.inputs?.target_adt_mins ?? null)}</span></div></div><div className="panel"><h4>Notes</h4><p>{clampNotes ? `${note.slice(0, 220)}…` : note || "—"}</p>{clampNotes ? <small>See Daily Update for full details.</small> : null}</div><div className="panel"><h4>Tasks</h4><ul>{tasksTxt.length ? tasksTxt.slice(0, clampTasks ? 5 : 20).map((t, i) => <li key={i}>{t}</li>) : <li>No tasks</li>}</ul>{clampTasks ? <small>See Daily Update for full details.</small> : null}</div></div>
      </article>;
    })}</section>)}

    <style jsx>{`
      :global(*){-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
      .exportShell{background:#f2f5f9;color:#0f172a;padding:0}.exportPage{width:210mm;min-height:297mm;background:#fff;margin:0 auto;box-sizing:border-box;padding:10mm 10mm 8mm}
      .firstPage{page-break-after:always;break-after:page}.storesPage{page-break-after:always;break-after:page;display:flex;flex-direction:column;gap:8mm;justify-content:flex-start}
      .banner{display:flex;justify-content:center;border-bottom:3px solid #006491;margin:-10mm -10mm 4mm}.banner img{max-width:95%}
      h1{margin:0;font-size:24px}header p{margin:2px 0 0;color:#64748b;font-weight:700}
      .panel{border:1px solid rgba(0,100,145,.14);border-radius:12px;padding:8px;margin-top:6px;background:rgba(255,255,255,.98)} h2{margin:0 0 6px;font-size:14px}
      .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.kpi-chip{font-size:13px;font-weight:900;padding:6px 10px;border-radius:999px;background:rgba(0,100,145,.08);border:1px solid rgba(0,100,145,.14)}
      .pill{display:inline-flex;align-items:center;justify-content:center;padding:3px 9px;border-radius:999px;border:1px solid rgba(15,23,42,.1);background:rgba(2,6,23,.04);font-weight:900;font-size:12px}.pill.green{background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.25);color:#166534}.pill.red{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.25);color:#991b1b}
      .areaMessage{border-left:3px solid #006491;background:rgba(0,100,145,.07);padding:10px;border-radius:10px;font-size:13px;line-height:1.5;font-weight:700}
      .highlights{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.highlight-card{border:1px solid rgba(0,100,145,.14);border-radius:10px;padding:8px;background:rgba(255,255,255,.95)}.highlight-card h3{margin:0;font-size:11px;text-transform:uppercase}.highlight-card p{margin:6px 0 4px;font-size:14px;font-weight:900}.highlight-card small{color:#475569}
      .signalRow{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px dashed rgba(100,116,139,.3)}.signalRow:last-child{border-bottom:none}
      .storeCard{border:1px solid rgba(0,100,145,.15);border-radius:12px;padding:8px;break-inside:avoid;page-break-inside:avoid}.storeHead{display:flex;gap:8px;align-items:center}.storeHead h3{margin:0;font-size:18px}
      .metricGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:6px}.metricRow{border:1px solid rgba(15,23,42,.08);border-radius:8px;padding:6px;background:#f8fafc;display:grid;gap:2px}.metricRow>span:first-child{font-weight:800}.metricRow small{color:#64748b;font-size:10px}
      .cols{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px}.cols h4{margin:0 0 6px;font-size:14px;line-height:1.4}.cols p,.cols li{font-size:12px;line-height:1.45;font-weight:600} ul{padding-left:16px;margin:0}
      @media print{@page{size:A4;margin:0}.exportShell{background:#fff}}
    `}</style>
  </main>;
}
