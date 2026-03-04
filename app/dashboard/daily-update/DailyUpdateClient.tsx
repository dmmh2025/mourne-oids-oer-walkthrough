"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

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
  additional_hours?: number | null;
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
type MetricStatus = "good" | "ok" | "bad" | "na";

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
const parseIsoDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};
const shiftDateIso = (isoDate: string, days: number) => {
  const d = parseIsoDate(isoDate);
  d.setDate(d.getDate() + days);
  return toISODateUK(d);
};
const getPreviousBusinessDayUk = () => shiftDateIso(toISODateUK(new Date()), -1);
const getWeekStartUK = (isoDate: string) => {
  const d = parseIsoDate(isoDate);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return toISODateUK(d);
};

const n01 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : v > 1 ? v / 100 : v);
const from100 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : v / 100);
const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const fmtPct = (v: number | null, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const fmtNum = (v: number | null, d = 2) => (v == null ? "—" : Number(v).toFixed(d));
const fmtMins = (v: number | null) => (v == null ? "—" : `${Number(v).toFixed(2)}m`);
const pp = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}pp`);

const statusHigherBetter = (value: number | null, targetMin: number): MetricStatus => (value == null ? "na" : value >= targetMin ? "good" : "bad");
const statusLowerBetter = (value: number | null, targetMax: number): MetricStatus => (value == null ? "na" : value <= targetMax ? "good" : "bad");
const statusAbsLowerBetter = (value: number | null, targetAbsMax: number): MetricStatus => (value == null ? "na" : Math.abs(value) <= targetAbsMax ? "good" : "bad");
const pillClass = (s: MetricStatus) => `pill ${s}`;

const getTargetsForStore = (store: string, input: StoreInputRow | null): Targets => {
  const base = DEFAULT_TARGETS[store] || { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 };
  const ext = input?.target_extremes_over40_pct != null ? from100(input.target_extremes_over40_pct) : null;
  return { ...base, extremesMax01: ext ?? base.extremesMax01 };
};

const Sparkline = ({ values }: { values: Array<number | null> }) => {
  const usable = values.map((v) => (v == null ? null : Number(v)));
  const min = Math.min(...usable.filter((v): v is number => v != null), 0);
  const max = Math.max(...usable.filter((v): v is number => v != null), 1);
  const span = Math.max(max - min, 0.0001);
  const points = usable
    .map((v, i) => {
      if (v == null) return null;
      const x = (i / 6) * 110;
      const y = 28 - ((v - min) / span) * 24;
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(" ");
  return (
    <svg viewBox="0 0 110 30" className="spark">
      <polyline fill="none" stroke="#0369a1" strokeWidth="2" points={points} />
    </svg>
  );
};

export default function DailyUpdateClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [sdlwDate, setSdlwDate] = useState("");
  const [areaMessage, setAreaMessage] = useState("");
  const [inputs, setInputs] = useState<StoreInputRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [serviceRange, setServiceRange] = useState<ServiceShiftRow[]>([]);
  const [costRange, setCostRange] = useState<CostControlRow[]>([]);
  const [osaRange, setOsaRange] = useState<OsaInternalRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const td = getPreviousBusinessDayUk();
        const ws = getWeekStartUK(td);
        const sdlw = shiftDateIso(td, -7);
        setTargetDate(td);
        setWeekStart(ws);
        setSdlwDate(sdlw);

        const [msgRes, inRes, taskRes, serviceRes, costRes, osaRes] = await Promise.all([
          supabase.from("daily_update_area_message").select("date,message").eq("date", td).maybeSingle(),
          supabase.from("daily_update_store_inputs").select("*").gte("date", ws).lte("date", td),
          supabase.from("daily_update_store_tasks").select("*").eq("date", td).order("created_at", { ascending: true }),
          supabase.from("service_shifts").select("shift_date,store,dot_pct,labour_pct,extreme_over_40,rnl_minutes,additional_hours,manager").in("shift_date", [td, sdlw]).or(`shift_date.gte.${ws},shift_date.lte.${td}`),
          supabase.from("cost_control_entries").select("*").gte("shift_date", ws).lte("shift_date", td),
          supabase.from("osa_internal_results").select("shift_date,store,team_member_name,points_lost").gte("shift_date", ws).lte("shift_date", td),
        ]);
        const firstError = [msgRes.error, inRes.error, taskRes.error, serviceRes.error, costRes.error, osaRes.error].find(Boolean);
        if (firstError) throw new Error(firstError.message);

        setAreaMessage(((msgRes.data as AreaMessageRow | null)?.message || "").trim());
        setInputs((inRes.data || []) as StoreInputRow[]);
        setTasks((taskRes.data || []) as TaskRow[]);
        const rows = (serviceRes.data || []) as ServiceShiftRow[];
        setServiceRange(rows.filter((r) => r.shift_date >= ws || r.shift_date === sdlw));
        setCostRange((costRes.data || []) as CostControlRow[]);
        setOsaRange((osaRes.data || []) as OsaInternalRow[]);
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const dayInputs = useMemo(() => inputs.filter((r) => r.date === targetDate), [inputs, targetDate]);
  const stores = useMemo(() => Array.from(new Set([...dayInputs.map((r) => r.store), ...serviceRange.map((r) => r.store), ...costRange.map((r) => r.store)])).sort(), [dayInputs, serviceRange, costRange]);
  const inputByStore = useMemo(() => new Map(dayInputs.map((r) => [r.store, r])), [dayInputs]);
  const inputWtd = useMemo(() => {
    const m = new Map<string, StoreInputRow[]>();
    for (const r of inputs.filter((x) => x.date >= weekStart && x.date <= targetDate)) m.set(r.store, [...(m.get(r.store) || []), r]);
    return m;
  }, [inputs, weekStart, targetDate]);
  const tasksByStore = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const t of tasks) m.set(t.store, [...(m.get(t.store) || []), t]);
    return m;
  }, [tasks]);

  const serviceYesterday = useMemo(() => serviceRange.filter((r) => r.shift_date === targetDate), [serviceRange, targetDate]);
  const serviceSdlw = useMemo(() => serviceRange.filter((r) => r.shift_date === sdlwDate), [serviceRange, sdlwDate]);
  const serviceByStoreDate = useMemo(() => {
    const m = new Map<string, ServiceShiftRow[]>();
    for (const r of serviceRange) m.set(`${r.store}|${r.shift_date}`, [...(m.get(`${r.store}|${r.shift_date}`) || []), r]);
    return m;
  }, [serviceRange]);
  const costYesterday = useMemo(() => costRange.filter((r) => r.shift_date === targetDate), [costRange, targetDate]);
  const osaWtdByStore = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of osaRange) {
      const s = String(r.store || "").trim();
      if (s) m.set(s, (m.get(s) || 0) + 1);
    }
    return m;
  }, [osaRange]);

  const managerTop = useMemo(() => {
    const b: Record<string, { dot: number[]; labour: number[] }> = {};
    for (const r of serviceRange.filter((x) => x.shift_date >= weekStart && x.shift_date <= targetDate)) {
      const key = (r.manager || "Unknown").trim() || "Unknown";
      b[key] ||= { dot: [], labour: [] };
      const d = n01(r.dot_pct);
      const l = n01(r.labour_pct);
      if (d != null) b[key].dot.push(d);
      if (l != null) b[key].labour.push(l);
    }
    return Object.entries(b)
      .map(([name, v]) => ({ name, dot: avg(v.dot), labour: avg(v.labour) }))
      .sort((a, b) => (b.dot || -1) - (a.dot || -1) || (a.labour || 99) - (b.labour || 99))[0] || null;
  }, [serviceRange, weekStart, targetDate]);

  const osaWinner = useMemo(() => {
    const b: Record<string, { t: number; c: number }> = {};
    for (const r of osaRange) {
      const n = (r.team_member_name || "Unknown").trim() || "Unknown";
      const p = Number(r.points_lost);
      if (!Number.isFinite(p)) continue;
      b[n] ||= { t: 0, c: 0 };
      b[n].t += p;
      b[n].c += 1;
    }
    const sorted = Object.entries(b).map(([name, v]) => ({ name, avg: v.c ? v.t / v.c : null })).sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99));
    return sorted[0] || null;
  }, [osaRange]);

  const costWinner = useMemo(() => {
    const b: Record<string, { sales: number; ideal: number; actual: number }> = {};
    for (const r of costRange) {
      b[r.store] ||= { sales: 0, ideal: 0, actual: 0 };
      b[r.store].sales += Number(r.sales_gbp || 0);
      b[r.store].ideal += Number(r.ideal_food_cost_gbp || 0);
      b[r.store].actual += Number(r.actual_food_cost_gbp || 0);
    }
    return Object.entries(b)
      .map(([store, v]) => ({ store, varp: v.sales > 0 ? (v.actual - v.ideal) / v.sales : null }))
      .sort((a, b) => Math.abs(a.varp ?? 99) - Math.abs(b.varp ?? 99))[0] || null;
  }, [costRange]);

  const storeCards = useMemo(() => {
    return stores
      .map((store) => {
        const input = inputByStore.get(store) || null;
        const wtdIn = inputWtd.get(store) || [];
        const sY = serviceByStoreDate.get(`${store}|${targetDate}`) || [];
        const sS = serviceByStoreDate.get(`${store}|${sdlwDate}`) || [];
        const cY = costYesterday.filter((r) => r.store === store);
        const cW = costRange.filter((r) => r.store === store && r.shift_date >= weekStart && r.shift_date <= targetDate);

        const salesY = sum(cY.map((r) => Number(r.sales_gbp || 0)));
        const salesW = sum(cW.map((r) => Number(r.sales_gbp || 0)));
        const labourY = salesY > 0 ? sum(cY.map((r) => Number(r.labour_cost_gbp || 0))) / salesY : null;
        const labourW = salesW > 0 ? sum(cW.map((r) => Number(r.labour_cost_gbp || 0))) / salesW : null;
        const foodY = salesY > 0 ? (sum(cY.map((r) => Number(r.actual_food_cost_gbp || 0))) - sum(cY.map((r) => Number(r.ideal_food_cost_gbp || 0)))) / salesY : null;
        const foodW = salesW > 0 ? (sum(cW.map((r) => Number(r.actual_food_cost_gbp || 0))) - sum(cW.map((r) => Number(r.ideal_food_cost_gbp || 0)))) / salesW : null;

        const dotY = avg(sY.map((r) => n01(r.dot_pct)).filter((v): v is number => v != null));
        const dotS = avg(sS.map((r) => n01(r.dot_pct)).filter((v): v is number => v != null));
        const extY = avg(sY.map((r) => n01(r.extreme_over_40)).filter((v): v is number => v != null));
        const extS = avg(sS.map((r) => n01(r.extreme_over_40)).filter((v): v is number => v != null));
        const rnlY = avg(sY.map((r) => r.rnl_minutes).filter((v): v is number => v != null));
        const rnlS = avg(sS.map((r) => r.rnl_minutes).filter((v): v is number => v != null));
        const addH = sum(sY.map((r) => Number(r.additional_hours || 0)));

        const missedY = from100(input?.missed_calls_wtd);
        const gpsY = from100(input?.gps_tracked_wtd);
        const aofY = from100(input?.aof_wtd);
        const missedW = avg(wtdIn.map((r) => from100(r.missed_calls_wtd)).filter((v): v is number => v != null));
        const gpsW = avg(wtdIn.map((r) => from100(r.gps_tracked_wtd)).filter((v): v is number => v != null));
        const aofW = avg(wtdIn.map((r) => from100(r.aof_wtd)).filter((v): v is number => v != null));

        return {
          store,
          input,
          tasks: tasksByStore.get(store) || [],
          osaWtd: osaWtdByStore.get(store) || 0,
          targets: getTargetsForStore(store, input),
          metrics: { dotY, dotS, extY, extS, rnlY, rnlS, labourY, labourW, foodY, foodW, missedY, missedW, gpsY, gpsW, aofY, aofW, addH },
        };
      })
      .sort((a, b) => (b.metrics.dotY ?? -1) - (a.metrics.dotY ?? -1) || (a.metrics.labourY ?? 9) - (b.metrics.labourY ?? 9))
      .map((c, i) => ({ ...c, rank: i + 1 }));
  }, [stores, inputByStore, inputWtd, serviceByStoreDate, targetDate, sdlwDate, costYesterday, costRange, weekStart, tasksByStore, osaWtdByStore]);

  const areaOverview = useMemo(() => {
    const salesY = sum(costYesterday.map((r) => Number(r.sales_gbp || 0)));
    const salesW = sum(costRange.map((r) => Number(r.sales_gbp || 0)));
    const labourY = salesY > 0 ? sum(costYesterday.map((r) => Number(r.labour_cost_gbp || 0))) / salesY : null;
    const labourW = salesW > 0 ? sum(costRange.map((r) => Number(r.labour_cost_gbp || 0))) / salesW : null;
    const foodY = salesY > 0 ? (sum(costYesterday.map((r) => Number(r.actual_food_cost_gbp || 0))) - sum(costYesterday.map((r) => Number(r.ideal_food_cost_gbp || 0)))) / salesY : null;
    const foodW = salesW > 0 ? (sum(costRange.map((r) => Number(r.actual_food_cost_gbp || 0))) - sum(costRange.map((r) => Number(r.ideal_food_cost_gbp || 0)))) / salesW : null;
    const dotY = avg(serviceYesterday.map((r) => n01(r.dot_pct)).filter((v): v is number => v != null));
    const dotS = avg(serviceSdlw.map((r) => n01(r.dot_pct)).filter((v): v is number => v != null));
    const extY = avg(serviceYesterday.map((r) => n01(r.extreme_over_40)).filter((v): v is number => v != null));
    const extS = avg(serviceSdlw.map((r) => n01(r.extreme_over_40)).filter((v): v is number => v != null));
    const rnlY = avg(serviceYesterday.map((r) => r.rnl_minutes).filter((v): v is number => v != null));
    const rnlS = avg(serviceSdlw.map((r) => r.rnl_minutes).filter((v): v is number => v != null));
    return { labourY, labourW, foodY, foodW, dotY, dotS, extY, extS, rnlY, rnlS };
  }, [costYesterday, costRange, serviceYesterday, serviceSdlw]);

  const watchList = useMemo(() => {
    const alerts: string[] = [];
    for (const c of storeCards) {
      const t = c.targets;
      if (c.metrics.dotY != null && c.metrics.dotY < t.dotMin01) alerts.push(`${c.store} · DOT ${fmtPct(c.metrics.dotY)} below target`);
      if (c.metrics.dotY != null && c.metrics.dotS != null && c.metrics.dotY - c.metrics.dotS < -0.03) alerts.push(`${c.store} · DOT ${fmtPct(c.metrics.dotY)} down ${pp((c.metrics.dotY - c.metrics.dotS))} vs SDLW`);
      if (c.metrics.rnlY != null && c.metrics.rnlY > t.rnlMaxMins) alerts.push(`${c.store} · R&L ${fmtMins(c.metrics.rnlY)} above max`);
      if (c.metrics.extY != null && c.metrics.extY > t.extremesMax01) alerts.push(`${c.store} · Extremes ${fmtPct(c.metrics.extY)} above max`);
      if (c.metrics.labourY != null && c.metrics.labourY > t.labourMax01) alerts.push(`${c.store} · Labour ${fmtPct(c.metrics.labourY)} above max`);
      if (c.metrics.foodY != null && Math.abs(c.metrics.foodY) > t.foodVarAbsMax01) alerts.push(`${c.store} · Food variance ${fmtPct(c.metrics.foodY)} breach`);
      if (c.metrics.missedY != null && c.metrics.missedY > INPUT_TARGETS.missedCallsMax01) alerts.push(`${c.store} · Missed calls ${fmtPct(c.metrics.missedY)} > 6%`);
      if (c.metrics.gpsY != null && c.metrics.gpsY < INPUT_TARGETS.gpsMin01) alerts.push(`${c.store} · GPS tracked ${fmtPct(c.metrics.gpsY)} < 95%`);
      if (c.metrics.aofY != null && c.metrics.aofY < INPUT_TARGETS.aofMin01) alerts.push(`${c.store} · AOF ${fmtPct(c.metrics.aofY)} < 62%`);
      if (c.metrics.addH > 1) alerts.push(`${c.store} · Additional hours ${fmtNum(c.metrics.addH, 1)} > 1`);
    }
    return alerts;
  }, [storeCards]);

  const trends = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => shiftDateIso(targetDate, i - 6));
    const dayCost = (d: string) => costRange.filter((r) => r.shift_date === d);
    const dayInputsRows = (d: string) => inputs.filter((r) => r.date === d);
    const dayOsa = (d: string) => osaRange.filter((r) => r.shift_date === d);
    return {
      labour: days.map((d) => {
        const rows = dayCost(d); const s = sum(rows.map((r) => Number(r.sales_gbp || 0))); return s > 0 ? sum(rows.map((r) => Number(r.labour_cost_gbp || 0))) / s : null;
      }),
      food: days.map((d) => {
        const rows = dayCost(d); const s = sum(rows.map((r) => Number(r.sales_gbp || 0))); return s > 0 ? (sum(rows.map((r) => Number(r.actual_food_cost_gbp || 0))) - sum(rows.map((r) => Number(r.ideal_food_cost_gbp || 0)))) / s : null;
      }),
      osa: days.map((d) => dayOsa(d).length),
      missed: days.map((d) => avg(dayInputsRows(d).map((r) => from100(r.missed_calls_wtd)).filter((v): v is number => v != null))),
      gps: days.map((d) => avg(dayInputsRows(d).map((r) => from100(r.gps_tracked_wtd)).filter((v): v is number => v != null))),
      aof: days.map((d) => avg(dayInputsRows(d).map((r) => from100(r.aof_wtd)).filter((v): v is number => v != null))),
    };
  }, [targetDate, costRange, inputs, osaRange]);

  if (loading) return <main className="wrap">Loading…</main>;
  if (error) return <main className="wrap">Failed: {error}</main>;

  return (
    <main className="wrap">
      <header className="top"><h1>Daily Update · {targetDate}</h1><button onClick={() => router.push("/dashboard/daily-update/export")}>Export PDF</button></header>

      <section className="card overview">
        <h2>Area Overview</h2>
        <div className="chips">
          <div className="chip"><b>DOT vs SDLW</b><span>{fmtPct(areaOverview.dotY)} · {pp((areaOverview.dotY ?? 0) - (areaOverview.dotS ?? 0))}</span></div>
          <div className="chip"><b>R&L vs SDLW</b><span>{fmtMins(areaOverview.rnlY)} · {fmtNum((areaOverview.rnlY ?? 0) - (areaOverview.rnlS ?? 0))}m</span></div>
          <div className="chip"><b>Extremes vs SDLW</b><span>{fmtPct(areaOverview.extY)} · {pp((areaOverview.extY ?? 0) - (areaOverview.extS ?? 0))}</span></div>
          <div className="chip"><b>Labour Y / WTD</b><span>{fmtPct(areaOverview.labourY)} / {fmtPct(areaOverview.labourW)}</span></div>
          <div className="chip"><b>Food var Y / WTD</b><span>{fmtPct(areaOverview.foodY)} / {fmtPct(areaOverview.foodW)}</span></div>
          <div className="chip"><b>OSA WTD count</b><span>{osaRange.length}</span></div>
        </div>
      </section>

      <section className="card message"><h2>Area Message</h2><p>{areaMessage || "No area message submitted for this date."}</p></section>

      <section className="card"><h2>Highlights</h2><div className="highlights"><div>✅ Top Manager (WTD): <b>{managerTop?.name || "No data"}</b> ({fmtPct(managerTop?.dot ?? null)})</div><div>✅ Best OSA (WTD): <b>{osaWinner?.name || "No data"}</b> (avg lost {fmtNum(osaWinner?.avg ?? null, 1)})</div><div>✅ Top Store Food (WTD): <b>{costWinner?.store || "No data"}</b> ({fmtPct(costWinner?.varp ?? null)})</div></div></section>

      <section className="card"><h2>Watch List</h2>{watchList.length ? <div className="watch">{watchList.map((a) => <span key={a} className="alert">{a}</span>)}</div> : <p className="ok">🟢 No watch list alerts today</p>}</section>

      <section className="card"><h2>Mini Trends (7 days)</h2><div className="trends">{(["labour", "food", "osa", "missed", "gps", "aof"] as const).map((k) => <div key={k}><b>{k.toUpperCase()}</b><Sparkline values={trends[k] as Array<number | null>} /></div>)}</div></section>

      {storeCards.map((c) => (
        <article key={c.store} className="card store">
          <div className="storeHead"><strong>#{c.rank} {c.store}</strong><span className="pill good">OSA WTD {c.osaWtd}</span></div>
          <div className="grid">
            <div>DOT {fmtPct(c.metrics.dotY)} <small>SDLW {fmtPct(c.metrics.dotS)} ({pp((c.metrics.dotY ?? 0) - (c.metrics.dotS ?? 0))})</small></div>
            <div>R&L {fmtMins(c.metrics.rnlY)} <small>SDLW {fmtMins(c.metrics.rnlS)} ({fmtNum((c.metrics.rnlY ?? 0) - (c.metrics.rnlS ?? 0))}m)</small></div>
            <div>Extremes {fmtPct(c.metrics.extY)} <small>SDLW {fmtPct(c.metrics.extS)} ({pp((c.metrics.extY ?? 0) - (c.metrics.extS ?? 0))})</small></div>
            <div>Labour {fmtPct(c.metrics.labourY)} <small>WTD {fmtPct(c.metrics.labourW)} Δ {pp((c.metrics.labourY ?? 0) - (c.metrics.labourW ?? 0))}</small></div>
            <div>Food {fmtPct(c.metrics.foodY)} <small>WTD {fmtPct(c.metrics.foodW)} Δ {pp((c.metrics.foodY ?? 0) - (c.metrics.foodW ?? 0))}</small></div>
            <div>Missed {fmtPct(c.metrics.missedY)} <small>WTD {fmtPct(c.metrics.missedW)}</small></div>
            <div>GPS {fmtPct(c.metrics.gpsY)} <small>WTD {fmtPct(c.metrics.gpsW)}</small></div>
            <div>AOF {fmtPct(c.metrics.aofY)} <small>WTD {fmtPct(c.metrics.aofW)}</small></div>
            <div>Add Hours {fmtNum(c.metrics.addH, 1)}</div>
          </div>
          <div className="notes"><b>Service losing targets:</b> Load {fmtNum(c.input?.target_load_time_mins ?? null)} · Rack {fmtNum(c.input?.target_rack_time_mins ?? null)} · ADT {fmtNum(c.input?.target_adt_mins ?? null)} · Extremes {fmtNum(c.input?.target_extremes_over40_pct ?? null)}%</div>
          <p><b>Notes:</b> {c.input?.notes || "—"}</p>
          <p><b>Tasks:</b> {c.tasks.map((t) => `${t.is_complete ? "☑" : "☐"} ${t.task}`).join(" · ") || "—"}</p>
        </article>
      ))}

      <style jsx>{`
        .wrap{padding:20px;background:#f1f5f9;display:grid;gap:14px}.top{display:flex;justify-content:space-between;align-items:center}
        .card{background:white;border:1px solid #cbd5e1;border-radius:12px;padding:14px}.overview{background:#eaf2ff;border:2px solid #60a5fa}
        .chips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.chip{background:#fff;border:1px solid #bfdbfe;border-radius:10px;padding:10px;font-size:15px}.chip span{font-size:20px;font-weight:800}
        .message{background:#fff7ed;border:2px solid #fb923c}.message p{font-weight:700;line-height:1.7;font-size:18px}
        .highlights,.watch,.trends{display:grid;gap:8px}.watch{grid-template-columns:repeat(2,minmax(0,1fr))}.alert{background:#fee2e2;border:1px solid #f87171;padding:6px 8px;border-radius:999px;font-size:12px}.ok{color:#15803d;font-weight:700}
        .spark{width:120px;height:30px}.storeHead{display:flex;justify-content:space-between}.pill{padding:3px 8px;border-radius:999px}.pill.good{background:#dcfce7}
        .grid{margin-top:8px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.grid>div{border:1px solid #e2e8f0;border-radius:8px;padding:8px} small{display:block;color:#475569}
        .notes{margin:10px 0;font-weight:700}
      `}</style>
    </main>
  );
}
