"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type StoreInputRow = { date: string; store: string; missed_calls_wtd: number | null; gps_tracked_wtd: number | null; aof_wtd: number | null; target_load_time_mins: number | null; target_rack_time_mins: number | null; target_adt_mins: number | null; target_extremes_over40_pct: number | null; notes: string | null };
type TaskRow = { id: string; date: string; store: string; task: string; is_complete: boolean };
type ServiceShiftRow = { shift_date: string; store: string; dot_pct: number | null; labour_pct: number | null; extreme_over_40: number | null; rnl_minutes: number | null; additional_hours: number | null; manager?: string | null };
type CostControlRow = { shift_date: string; store: string; sales_gbp: number | null; labour_cost_gbp: number | null; ideal_food_cost_gbp: number | null; actual_food_cost_gbp: number | null };
type OsaRow = { shift_date: string; store: string | null; team_member_name: string | null; points_lost: number | null };

type Targets = { dotMin01: number; labourMax01: number; rnlMaxMins: number; extremesMax01: number; foodVarAbsMax01: number };
const DEFAULT_TARGETS: Record<string, Targets> = {
  Downpatrick: { dotMin01: 0.82, labourMax01: 0.25, rnlMaxMins: 9, extremesMax01: 0.03, foodVarAbsMax01: 0.003 },
  Kilkeel: { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 8, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
  Newcastle: { dotMin01: 0.78, labourMax01: 0.25, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
  Ballynahinch: { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
};
const INPUT_TARGETS = { missedCallsMax01: 0.06, aofMin01: 0.62, gpsMin01: 0.95 };

const toISODateUK = (date: Date) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return `${p.find((x) => x.type === "year")?.value}-${p.find((x) => x.type === "month")?.value}-${p.find((x) => x.type === "day")?.value}`;
};
const parse = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const move = (iso: string, days: number) => { const d = parse(iso); d.setDate(d.getDate() + days); return toISODateUK(d); };
const getPrev = () => move(toISODateUK(new Date()), -1);
const getWeekStart = (iso: string) => { const d = parse(iso); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return toISODateUK(d); };

const n01 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : v > 1 ? v / 100 : v);
const from100 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : v / 100);
const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const fmtPct = (v: number | null, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const fmtNum = (v: number | null, d = 1) => (v == null ? "—" : Number(v).toFixed(d));
const fmtMin = (v: number | null) => (v == null ? "—" : `${Number(v).toFixed(2)}m`);
const pp = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}pp`);

const Sparkline = ({ values }: { values: Array<number | null> }) => {
  const pts = values
    .map((v, i) => {
      if (v == null) return null;
      const set = values.filter((x): x is number => x != null);
      const min = Math.min(...set, 0);
      const max = Math.max(...set, 1);
      const y = 24 - (((v - min) / Math.max(max - min, 0.0001)) * 20);
      return `${(i / 6) * 90},${y}`;
    })
    .filter(Boolean)
    .join(" ");
  return <svg viewBox="0 0 90 26" className="spark"><polyline points={pts} fill="none" stroke="#0c4a6e" strokeWidth="2"/></svg>;
};

function PrintTrigger() {
  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 500);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

export default function DailyUpdateExportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [sdlw, setSdlw] = useState("");
  const [areaMessage, setAreaMessage] = useState("");
  const [inputs, setInputs] = useState<StoreInputRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [service, setService] = useState<ServiceShiftRow[]>([]);
  const [cost, setCost] = useState<CostControlRow[]>([]);
  const [osa, setOsa] = useState<OsaRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const td = getPrev();
        const ws = getWeekStart(td);
        const sd = move(td, -7);
        setTargetDate(td); setWeekStart(ws); setSdlw(sd);

        const [m, i, t, s, c, o] = await Promise.all([
          supabase.from("daily_update_area_message").select("message").eq("date", td).maybeSingle(),
          supabase.from("daily_update_store_inputs").select("*").gte("date", ws).lte("date", td),
          supabase.from("daily_update_store_tasks").select("id,date,store,task,is_complete").eq("date", td),
          supabase.from("service_shifts").select("shift_date,store,dot_pct,labour_pct,extreme_over_40,rnl_minutes,additional_hours,manager").gte("shift_date", sd).lte("shift_date", td),
          supabase.from("cost_control_entries").select("*").gte("shift_date", ws).lte("shift_date", td),
          supabase.from("osa_internal_results").select("shift_date,store,team_member_name,points_lost").gte("shift_date", ws).lte("shift_date", td),
        ]);
        const e = [m.error, i.error, t.error, s.error, c.error, o.error].find(Boolean); if (e) throw new Error(e.message);
        setAreaMessage(((m.data as { message: string | null } | null)?.message || "").trim());
        setInputs((i.data || []) as StoreInputRow[]); setTasks((t.data || []) as TaskRow[]); setService((s.data || []) as ServiceShiftRow[]); setCost((c.data || []) as CostControlRow[]); setOsa((o.data || []) as OsaRow[]);
      } catch (err: any) {
        setError(err.message || "Load failed");
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const inputsDay = useMemo(() => inputs.filter((r) => r.date === targetDate), [inputs, targetDate]);
  const inputByStore = useMemo(() => new Map(inputsDay.map((r) => [r.store, r])), [inputsDay]);
  const tasksByStore = useMemo(() => {
    const m = new Map<string, TaskRow[]>(); for (const t of tasks) m.set(t.store, [...(m.get(t.store) || []), t]); return m;
  }, [tasks]);
  const stores = useMemo(() => Array.from(new Set([...inputsDay.map((r) => r.store), ...service.map((r) => r.store), ...cost.map((r) => r.store)])).sort(), [inputsDay, service, cost]);

  const storeCards = useMemo(() => stores.map((store) => {
    const i = inputByStore.get(store) || null;
    const t = tasksByStore.get(store) || [];
    const sy = service.filter((r) => r.store === store && r.shift_date === targetDate);
    const ss = service.filter((r) => r.store === store && r.shift_date === sdlw);
    const cw = cost.filter((r) => r.store === store && r.shift_date >= weekStart && r.shift_date <= targetDate);
    const cy = cost.filter((r) => r.store === store && r.shift_date === targetDate);
    const iw = inputs.filter((r) => r.store === store && r.date >= weekStart && r.date <= targetDate);

    const salesY = sum(cy.map((r) => Number(r.sales_gbp || 0))); const salesW = sum(cw.map((r) => Number(r.sales_gbp || 0)));
    const labourY = salesY > 0 ? sum(cy.map((r) => Number(r.labour_cost_gbp || 0))) / salesY : null;
    const labourW = salesW > 0 ? sum(cw.map((r) => Number(r.labour_cost_gbp || 0))) / salesW : null;
    const foodY = salesY > 0 ? (sum(cy.map((r) => Number(r.actual_food_cost_gbp || 0))) - sum(cy.map((r) => Number(r.ideal_food_cost_gbp || 0)))) / salesY : null;
    const foodW = salesW > 0 ? (sum(cw.map((r) => Number(r.actual_food_cost_gbp || 0))) - sum(cw.map((r) => Number(r.ideal_food_cost_gbp || 0)))) / salesW : null;
    const dotY = avg(sy.map((r) => n01(r.dot_pct)).filter((x): x is number => x != null));
    const dotS = avg(ss.map((r) => n01(r.dot_pct)).filter((x): x is number => x != null));
    const rnlY = avg(sy.map((r) => r.rnl_minutes).filter((x): x is number => x != null));
    const rnlS = avg(ss.map((r) => r.rnl_minutes).filter((x): x is number => x != null));
    const extY = avg(sy.map((r) => n01(r.extreme_over_40)).filter((x): x is number => x != null));
    const extS = avg(ss.map((r) => n01(r.extreme_over_40)).filter((x): x is number => x != null));
    const addH = sum(sy.map((r) => Number(r.additional_hours || 0)));
    const missedY = from100(i?.missed_calls_wtd); const missedW = avg(iw.map((r) => from100(r.missed_calls_wtd)).filter((x): x is number => x != null));
    const gpsY = from100(i?.gps_tracked_wtd); const gpsW = avg(iw.map((r) => from100(r.gps_tracked_wtd)).filter((x): x is number => x != null));
    const aofY = from100(i?.aof_wtd); const aofW = avg(iw.map((r) => from100(r.aof_wtd)).filter((x): x is number => x != null));
    const osaW = osa.filter((r) => r.store === store).length;
    const tar = DEFAULT_TARGETS[store] || { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 };

    return { store, i, t, tar, osaW, m: { dotY, dotS, rnlY, rnlS, extY, extS, labourY, labourW, foodY, foodW, missedY, missedW, gpsY, gpsW, aofY, aofW, addH } };
  }).sort((a, b) => (b.m.dotY ?? -1) - (a.m.dotY ?? -1) || (a.m.labourY ?? 9) - (b.m.labourY ?? 9)).map((x, i) => ({ ...x, rank: i + 1 })), [stores, inputByStore, tasksByStore, service, cost, inputs, targetDate, sdlw, weekStart, osa]);

  const storePages = useMemo(() => {
    const out: typeof storeCards[] = []; for (let i = 0; i < storeCards.length; i += 2) out.push(storeCards.slice(i, i + 2)); return out;
  }, [storeCards]);

  const managerTop = useMemo(() => {
    const bucket: Record<string, { d: number[] }> = {};
    for (const r of service.filter((x) => x.shift_date >= weekStart && x.shift_date <= targetDate)) { const n = (r.manager || "Unknown").trim() || "Unknown"; bucket[n] ||= { d: [] }; const d = n01(r.dot_pct); if (d != null) bucket[n].d.push(d); }
    return Object.entries(bucket).map(([name, v]) => ({ name, dot: avg(v.d) })).sort((a, b) => (b.dot ?? -1) - (a.dot ?? -1))[0] || null;
  }, [service, weekStart, targetDate]);
  const osaTop = useMemo(() => {
    const bucket: Record<string, { t: number; c: number }> = {};
    for (const r of osa) { const n = (r.team_member_name || "Unknown").trim() || "Unknown"; const p = Number(r.points_lost); if (!Number.isFinite(p)) continue; bucket[n] ||= { t: 0, c: 0 }; bucket[n].t += p; bucket[n].c += 1; }
    return Object.entries(bucket).map(([name, v]) => ({ name, avg: v.c ? v.t / v.c : null })).sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99))[0] || null;
  }, [osa]);
  const foodTop = useMemo(() => {
    const b: Record<string, { sales: number; ideal: number; actual: number }> = {};
    for (const r of cost) { b[r.store] ||= { sales: 0, ideal: 0, actual: 0 }; b[r.store].sales += Number(r.sales_gbp || 0); b[r.store].ideal += Number(r.ideal_food_cost_gbp || 0); b[r.store].actual += Number(r.actual_food_cost_gbp || 0); }
    return Object.entries(b).map(([store, v]) => ({ store, fv: v.sales > 0 ? (v.actual - v.ideal) / v.sales : null })).sort((a, b) => Math.abs(a.fv ?? 99) - Math.abs(b.fv ?? 99))[0] || null;
  }, [cost]);

  const watchList = useMemo(() => {
    const arr: string[] = [];
    for (const c of storeCards) {
      if (c.m.dotY != null && c.m.dotY < c.tar.dotMin01) arr.push(`${c.store} · DOT ${fmtPct(c.m.dotY)} below target`);
      if (c.m.dotY != null && c.m.dotS != null && c.m.dotY - c.m.dotS < -0.03) arr.push(`${c.store} · DOT down ${pp((c.m.dotY - c.m.dotS))} vs SDLW`);
      if (c.m.rnlY != null && c.m.rnlY > c.tar.rnlMaxMins) arr.push(`${c.store} · R&L ${fmtMin(c.m.rnlY)} high`);
      if (c.m.extY != null && c.m.extY > c.tar.extremesMax01) arr.push(`${c.store} · Extremes ${fmtPct(c.m.extY)} high`);
      if (c.m.labourY != null && c.m.labourY > c.tar.labourMax01) arr.push(`${c.store} · Labour ${fmtPct(c.m.labourY)} high`);
      if (c.m.foodY != null && Math.abs(c.m.foodY) > c.tar.foodVarAbsMax01) arr.push(`${c.store} · Food ${fmtPct(c.m.foodY)} breach`);
      if (c.m.missedY != null && c.m.missedY > INPUT_TARGETS.missedCallsMax01) arr.push(`${c.store} · Missed calls ${fmtPct(c.m.missedY)} > 6%`);
      if (c.m.gpsY != null && c.m.gpsY < INPUT_TARGETS.gpsMin01) arr.push(`${c.store} · GPS ${fmtPct(c.m.gpsY)} < 95%`);
      if (c.m.aofY != null && c.m.aofY < INPUT_TARGETS.aofMin01) arr.push(`${c.store} · AOF ${fmtPct(c.m.aofY)} < 62%`);
      if (c.m.addH > 1) arr.push(`${c.store} · Add hours ${fmtNum(c.m.addH)} > 1`);
    }
    return arr;
  }, [storeCards]);

  const trends = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => move(targetDate, i - 6));
    return {
      labour: days.map((d) => { const rows = cost.filter((r) => r.shift_date === d); const s = sum(rows.map((r) => Number(r.sales_gbp || 0))); return s > 0 ? sum(rows.map((r) => Number(r.labour_cost_gbp || 0))) / s : null; }),
      food: days.map((d) => { const rows = cost.filter((r) => r.shift_date === d); const s = sum(rows.map((r) => Number(r.sales_gbp || 0))); return s > 0 ? (sum(rows.map((r) => Number(r.actual_food_cost_gbp || 0))) - sum(rows.map((r) => Number(r.ideal_food_cost_gbp || 0)))) / s : null; }),
      osa: days.map((d) => osa.filter((r) => r.shift_date === d).length),
      missed: days.map((d) => avg(inputs.filter((r) => r.date === d).map((r) => from100(r.missed_calls_wtd)).filter((x): x is number => x != null))),
      gps: days.map((d) => avg(inputs.filter((r) => r.date === d).map((r) => from100(r.gps_tracked_wtd)).filter((x): x is number => x != null))),
      aof: days.map((d) => avg(inputs.filter((r) => r.date === d).map((r) => from100(r.aof_wtd)).filter((x): x is number => x != null))),
    };
  }, [targetDate, cost, osa, inputs]);

  if (loading) return <main className="shell">Loading export…</main>;
  if (error) return <main className="shell">Failed export: {error}</main>;

  return (
    <main className="shell">
      <PrintTrigger />
      <section className="page page1">
        <img src="/mourneoids_forms_header_1600x400.png" className="banner" alt="banner" />
        <div className="box overview"><h2>Area Overview</h2><div className="pillRow"><span>DOT {fmtPct(avg(service.filter((r) => r.shift_date === targetDate).map((r) => n01(r.dot_pct)).filter((x): x is number => x != null)))} ({pp((avg(service.filter((r) => r.shift_date === targetDate).map((r) => n01(r.dot_pct)).filter((x): x is number => x != null)) ?? 0) - (avg(service.filter((r) => r.shift_date === sdlw).map((r) => n01(r.dot_pct)).filter((x): x is number => x != null)) ?? 0))})</span><span>R&L {fmtMin(avg(service.filter((r) => r.shift_date === targetDate).map((r) => r.rnl_minutes).filter((x): x is number => x != null)))} </span><span>Extremes {fmtPct(avg(service.filter((r) => r.shift_date === targetDate).map((r) => n01(r.extreme_over_40)).filter((x): x is number => x != null)))} </span></div></div>
        <div className="box message"><h2>Area Message</h2><p>{areaMessage || "No area message submitted for this date."}</p></div>
        <div className="box"><h2>Highlights</h2><div className="h3">✅ Top Manager (WTD): <b>{managerTop?.name || "No data"}</b> ({fmtPct(managerTop?.dot ?? null)})</div><div className="h3">✅ Best OSA (WTD): <b>{osaTop?.name || "No data"}</b> ({fmtNum(osaTop?.avg ?? null, 1)})</div><div className="h3">✅ Top Store Food (WTD): <b>{foodTop?.store || "No data"}</b> ({fmtPct(foodTop?.fv ?? null)})</div></div>
        <div className="box"><h2>Watch List</h2>{watchList.length ? <div className="watch">{watchList.map((x) => <span className="watchPill" key={x}>{x}</span>)}</div> : <p className="ok">🟢 No watch list alerts today</p>}</div>
        <div className="box"><h2>Mini trends</h2><div className="trendGrid">{(["labour", "food", "osa", "missed", "gps", "aof"] as const).map((k) => <div key={k}><b>{k.toUpperCase()}</b><Sparkline values={trends[k] as Array<number | null>} /></div>)}</div></div>
      </section>

      {storePages.map((pair, idx) => (
        <section className="page stores" key={idx}>
          {pair.map((c) => (
            <article className="storeHalf" key={c.store}>
              <div className="storeHead"><strong>#{c.rank} {c.store}</strong><span>OSA WTD {c.osaW}</span></div>
              <div className="tileGrid">
                <div>DOT {fmtPct(c.m.dotY)}<small>SDLW {fmtPct(c.m.dotS)} ({pp((c.m.dotY ?? 0) - (c.m.dotS ?? 0))})</small></div>
                <div>R&L {fmtMin(c.m.rnlY)}<small>SDLW {fmtMin(c.m.rnlS)} ({fmtNum((c.m.rnlY ?? 0) - (c.m.rnlS ?? 0),2)}m)</small></div>
                <div>Ext {fmtPct(c.m.extY)}<small>SDLW {fmtPct(c.m.extS)} ({pp((c.m.extY ?? 0) - (c.m.extS ?? 0))})</small></div>
                <div>Labour {fmtPct(c.m.labourY)}<small>WTD {fmtPct(c.m.labourW)} ({pp((c.m.labourY ?? 0) - (c.m.labourW ?? 0))})</small></div>
                <div>Food {fmtPct(c.m.foodY)}<small>WTD {fmtPct(c.m.foodW)} ({pp((c.m.foodY ?? 0) - (c.m.foodW ?? 0))})</small></div>
                <div>OSA {c.osaW}<small>WTD count</small></div>
                <div>Missed {fmtPct(c.m.missedY)}<small>WTD {fmtPct(c.m.missedW)}</small></div>
                <div>GPS {fmtPct(c.m.gpsY)}<small>WTD {fmtPct(c.m.gpsW)}</small></div>
                <div>AOF {fmtPct(c.m.aofY)}<small>WTD {fmtPct(c.m.aofW)}</small></div>
              </div>
              <div className="side"><b>Service losing targets:</b> Load {fmtNum(c.i?.target_load_time_mins ?? null)} · Rack {fmtNum(c.i?.target_rack_time_mins ?? null)} · ADT {fmtNum(c.i?.target_adt_mins ?? null)} · Extremes {fmtNum(c.i?.target_extremes_over40_pct ?? null)}%</div>
              <p><b>Notes:</b> {(c.i?.notes || "—").slice(0, 220)}{(c.i?.notes || "").length > 220 ? "… See Daily Update page." : ""}</p>
              <p><b>Tasks:</b> {c.t.slice(0, 5).map((x) => `${x.is_complete ? "☑" : "☐"} ${x.task}`).join(" · ") || "—"}{c.t.length > 5 ? " … See Daily Update page." : ""}</p>
            </article>
          ))}
          {pair.length === 1 ? <article className="storeHalf empty" /> : null}
        </section>
      ))}

      <style jsx global>{`
        @page { size: A4 landscape; margin: 8mm; }
        *,*::before,*::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        body{margin:0;font-family:Inter,Arial,sans-serif;background:#f1f5f9;color:#0f172a}
        .shell{max-width:281mm;margin:0 auto}
        .page{min-height:194mm;page-break-after:always;break-after:page;display:flex;flex-direction:column;gap:2mm}
        .page:last-of-type{page-break-after:auto;break-after:auto}
        .page1{overflow:hidden}
        .banner{height:30mm;object-fit:cover;border-radius:2mm}
        .box{background:#fff;border:1px solid #cbd5e1;border-radius:2mm;padding:2mm}
        .overview{background:#eaf2ff;border:1.3px solid #3b82f6}.pillRow{display:grid;grid-template-columns:repeat(3,1fr);gap:1mm}.pillRow span{background:#fff;border:1px solid #bfdbfe;border-radius:999px;padding:1mm 1.5mm;font-weight:700;font-size:12px}
        .message{background:#fff7ed;border-color:#fb923c}.message p{font-size:14px;font-weight:800;line-height:1.6}
        .h3{font-size:12px;line-height:1.4}.watch{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1mm}.watchPill{font-size:10px;border:1px solid #fca5a5;background:#fee2e2;border-radius:999px;padding:0.8mm 1.4mm}.ok{color:#15803d;font-weight:700}
        .trendGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:1mm}.spark{width:100%;height:16mm}
        .stores{gap:2mm}
        .storeHalf{height:96mm;break-inside:avoid;page-break-inside:avoid;overflow:hidden;border:1px solid #cbd5e1;background:#fff;border-radius:2mm;padding:2mm;display:flex;flex-direction:column;gap:1.5mm}
        .storeHalf.empty{border-style:dashed;background:#f8fafc}
        .storeHead{display:flex;justify-content:space-between;background:#e2e8f0;padding:1mm 1.5mm;border-radius:1.5mm}
        .tileGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1mm}.tileGrid>div{border:1px solid #dbe3ef;border-radius:1.5mm;padding:1mm;font-size:11px;font-weight:700}.tileGrid small{display:block;font-size:10px;color:#334155;font-weight:600}
        .side{font-size:11px;font-weight:700;background:#f8fafc;border:1px solid #e2e8f0;border-radius:1.5mm;padding:1mm}
        p{margin:0;font-size:11px;line-height:1.3}
      `}</style>
    </main>
  );
}
