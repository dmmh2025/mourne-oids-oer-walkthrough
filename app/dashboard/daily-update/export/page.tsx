"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
type TaskRow = {
  id: string;
  date: string;
  store: string;
  task: string;
  is_complete: boolean;
  created_at: string;
  completed_at: string | null;
};
type ServiceShiftRow = {
  shift_date: string;
  store: string;
  dot_pct: number | null;
  labour_pct: number | null;
  extreme_over_40: number | null;
  rnl_minutes: number | null;
  additional_hours?: number | null;
};
type CostControlRow = {
  shift_date: string;
  store: string;
  sales_gbp: number | null;
  labour_cost_gbp: number | null;
  ideal_food_cost_gbp: number | null;
  actual_food_cost_gbp: number | null;
};
type OsaInternalRow = { shift_date: string; store: string | null };

type Targets = {
  dotMin01: number;
  labourMax01: number;
  rnlMaxMins: number;
  extremesMax01: number;
  foodVarAbsMax01: number;
};

type MetricStatus = "good" | "ok" | "bad" | "na";

const DEFAULT_TARGETS: Record<string, Targets> = {
  Downpatrick: { dotMin01: 0.82, labourMax01: 0.25, rnlMaxMins: 9, extremesMax01: 0.03, foodVarAbsMax01: 0.003 },
  Kilkeel: { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 8, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
  Newcastle: { dotMin01: 0.78, labourMax01: 0.25, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
  Ballynahinch: { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
};

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

const parseIsoDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const getPreviousBusinessDayUk = () => {
  const todayUk = toISODateUK(new Date());
  const previous = parseIsoDate(todayUk);
  previous.setDate(previous.getDate() - 1);
  return toISODateUK(previous);
};

const getWeekStartUK = (isoDate: string) => {
  const d = parseIsoDate(isoDate);
  const day = d.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - mondayOffset);
  return toISODateUK(d);
};

const normalisePct01 = (v: number | null) => {
  if (v == null || !Number.isFinite(v)) return null;
  return v > 1 ? v / 100 : v;
};
const to01From100 = (v: number | null) => {
  if (v == null || !Number.isFinite(v)) return null;
  return v / 100;
};
const avg = (arr: number[]) => (arr.length ? arr.reduce((acc, val) => acc + val, 0) / arr.length : null);
const sum = (arr: number[]) => arr.reduce((acc, val) => acc + val, 0);
const fmtPct2 = (v01: number | null) => (v01 == null || !Number.isFinite(v01) ? "—" : `${(v01 * 100).toFixed(2)}%`);
const fmtNum2 = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${Number(v).toFixed(2)}`);
const fmtMins2 = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${Number(v).toFixed(2)}m`);

const within = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const statusHigherBetter = (value: number | null, targetMin: number, tol = 0.002): MetricStatus => {
  if (value == null || !Number.isFinite(value)) return "na";
  if (value >= targetMin + tol) return "good";
  if (within(value, targetMin, tol)) return "ok";
  return "bad";
};
const statusLowerBetter = (value: number | null, targetMax: number, tol = 0.002): MetricStatus => {
  if (value == null || !Number.isFinite(value)) return "na";
  if (value <= targetMax - tol) return "good";
  if (within(value, targetMax, tol)) return "ok";
  return "bad";
};
const statusAbsLowerBetter = (value: number | null, targetAbsMax: number, tol = 0.002): MetricStatus => {
  if (value == null || !Number.isFinite(value)) return "na";
  const absVal = Math.abs(value);
  if (absVal <= targetAbsMax - tol) return "good";
  if (within(absVal, targetAbsMax, tol)) return "ok";
  return "bad";
};

const getTargetsForStore = (store: string, inputs: StoreInputRow | null): Targets => {
  const base =
    DEFAULT_TARGETS[store] || { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 };
  const extFromInputs01 = inputs?.target_extremes_over40_pct != null ? to01From100(inputs.target_extremes_over40_pct) : null;
  return { ...base, extremesMax01: extFromInputs01 ?? base.extremesMax01 };
};

const pillClassFromStatus = (s: MetricStatus) => {
  if (s === "good") return "pill green";
  if (s === "ok") return "pill amber";
  if (s === "bad") return "pill red";
  return "pill";
};

export default function DailyUpdateExportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [areaMessage, setAreaMessage] = useState("");
  const [storeInputs, setStoreInputs] = useState<StoreInputRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [serviceRows, setServiceRows] = useState<ServiceShiftRow[]>([]);
  const [costRows, setCostRows] = useState<CostControlRow[]>([]);
  const [osaRows, setOsaRows] = useState<OsaInternalRow[]>([]);
  const [stores, setStores] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const previousBusinessDay = getPreviousBusinessDayUk();
        const wkStart = getWeekStartUK(previousBusinessDay);
        setTargetDate(previousBusinessDay);
        setWeekStart(wkStart);

        const [areaMessageRes, inputsRes, tasksRes, serviceRes, costRes, osaRes, serviceStoresRes, costStoresRes, inputStoresRes] =
          await Promise.all([
            supabase.from("daily_update_area_message").select("date,message").eq("date", previousBusinessDay).maybeSingle(),
            supabase
              .from("daily_update_store_inputs")
              .select(
                "date,store,missed_calls_wtd,gps_tracked_wtd,aof_wtd,target_load_time_mins,target_rack_time_mins,target_adt_mins,target_extremes_over40_pct,notes"
              )
              .eq("date", previousBusinessDay),
            supabase
              .from("daily_update_store_tasks")
              .select("id,date,store,task,is_complete,created_at,completed_at")
              .eq("date", previousBusinessDay)
              .order("created_at", { ascending: true }),
            supabase
              .from("service_shifts")
              .select("shift_date,store,dot_pct,labour_pct,extreme_over_40,rnl_minutes,additional_hours")
              .eq("shift_date", previousBusinessDay),
            supabase
              .from("cost_control_entries")
              .select("shift_date,store,sales_gbp,labour_cost_gbp,ideal_food_cost_gbp,actual_food_cost_gbp")
              .eq("shift_date", previousBusinessDay),
            supabase.from("osa_internal_results").select("shift_date,store").gte("shift_date", wkStart).lte("shift_date", previousBusinessDay),
            supabase.from("service_shifts").select("store,shift_date").order("shift_date", { ascending: false }).limit(500),
            supabase.from("cost_control_entries").select("store,shift_date").order("shift_date", { ascending: false }).limit(500),
            supabase.from("daily_update_store_inputs").select("store,date").order("date", { ascending: false }).limit(500),
          ]);

        const firstError = [
          areaMessageRes.error,
          inputsRes.error,
          tasksRes.error,
          serviceRes.error,
          costRes.error,
          osaRes.error,
          serviceStoresRes.error,
          costStoresRes.error,
          inputStoresRes.error,
        ].find(Boolean);

        if (firstError) throw new Error(firstError.message);

        setAreaMessage(((areaMessageRes.data as AreaMessageRow | null)?.message ?? "").trim());
        setStoreInputs((inputsRes.data || []) as StoreInputRow[]);
        setTasks((tasksRes.data || []) as TaskRow[]);
        setServiceRows((serviceRes.data || []) as ServiceShiftRow[]);
        setCostRows((costRes.data || []) as CostControlRow[]);
        setOsaRows((osaRes.data || []) as OsaInternalRow[]);

        const storeSet = new Set<string>();
        for (const row of [...(serviceStoresRes.data || []), ...(costStoresRes.data || []), ...(inputStoresRes.data || [])]) {
          const s = String((row as { store?: string }).store || "").trim();
          if (s) storeSet.add(s);
        }
        setStores(Array.from(storeSet).sort((a, b) => a.localeCompare(b)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load export data.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!loading && !error) {
      const timer = window.setTimeout(() => window.print(), 180);
      return () => window.clearTimeout(timer);
    }
  }, [loading, error]);

  const inputsByStore = useMemo(() => {
    const m = new Map<string, StoreInputRow>();
    for (const row of storeInputs) m.set(row.store, row);
    return m;
  }, [storeInputs]);

  const tasksByStore = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const row of tasks) m.set(row.store, [...(m.get(row.store) || []), row]);
    return m;
  }, [tasks]);

  const osaCounts = useMemo(() => {
    const byStore = new Map<string, number>();
    for (const row of osaRows) {
      const store = String(row.store || "").trim();
      if (!store) continue;
      byStore.set(store, (byStore.get(store) || 0) + 1);
    }
    return { total: osaRows.length, byStore };
  }, [osaRows]);

  const storeCards = useMemo(() => {
    const cards = stores.map((store) => {
      const cost = costRows.filter((row) => row.store === store);
      const service = serviceRows.filter((row) => row.store === store);
      const inputs = inputsByStore.get(store) || null;
      const storeTasks = tasksByStore.get(store) || [];

      const sales = sum(cost.map((row) => Number(row.sales_gbp || 0)));
      const labourCost = sum(cost.map((row) => Number(row.labour_cost_gbp || 0)));
      const idealFoodCost = sum(cost.map((row) => Number(row.ideal_food_cost_gbp || 0)));
      const actualFoodCost = sum(cost.map((row) => Number(row.actual_food_cost_gbp || 0)));

      const labourPct01 = sales > 0 ? labourCost / sales : null;
      const foodVarPct01 = sales > 0 ? (actualFoodCost - idealFoodCost) / sales : null;
      const dotPct01 = avg(service.map((row) => normalisePct01(row.dot_pct)).filter((v): v is number => v != null));
      const extremesPct01 = avg(service.map((row) => normalisePct01(row.extreme_over_40)).filter((v): v is number => v != null));
      const rnlMinutes = avg(service.map((row) => row.rnl_minutes).filter((v): v is number => v != null));
      const additionalHours = sum(service.map((row) => Number(row.additional_hours || 0)));
      const targets = getTargetsForStore(store, inputs);

      return {
        store,
        targets,
        osaWtdCount: osaCounts.byStore.get(store) || 0,
        notes: inputs?.notes?.trim() || "",
        tasksOpenCount: storeTasks.filter((task) => !task.is_complete).length,
        service: { dotPct01, labourPct01, rnlMinutes, extremesPct01, additionalHours },
        cost: { foodVarPct01 },
      };
    });

    return cards
      .sort((a, b) => {
        const aDot = a.service.dotPct01 ?? -1;
        const bDot = b.service.dotPct01 ?? -1;
        if (bDot !== aDot) return bDot - aDot;
        const aLab = a.service.labourPct01 ?? Number.POSITIVE_INFINITY;
        const bLab = b.service.labourPct01 ?? Number.POSITIVE_INFINITY;
        return aLab - bLab;
      })
      .slice(0, 4);
  }, [stores, costRows, serviceRows, inputsByStore, tasksByStore, osaCounts.byStore]);

  if (loading) return <main className="page"><p>Loading export…</p></main>;
  if (error) return <main className="page"><p>Failed to load export: {error}</p></main>;

  return (
    <main className="page">
      <div className="banner">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <section className="section areaMessage">
        <h1>Daily Update Export — {targetDate}</h1>
        <p className="meta">WTD from {weekStart} • OSA WTD total: {osaCounts.total}</p>
        <p>{areaMessage || "No area message submitted for this date."}</p>
      </section>

      <section className="section">
        <h2>Stores</h2>
        <div className="grid">
          {storeCards.map((card) => {
            const dotStatus = statusHigherBetter(card.service.dotPct01, card.targets.dotMin01);
            const labourStatus = statusLowerBetter(card.service.labourPct01, card.targets.labourMax01);
            const rnlStatus = statusLowerBetter(card.service.rnlMinutes, card.targets.rnlMaxMins, 0.1);
            const extremesStatus = statusLowerBetter(card.service.extremesPct01, card.targets.extremesMax01);
            const addHoursStatus: MetricStatus =
              card.service.additionalHours == null || !Number.isFinite(card.service.additionalHours)
                ? "na"
                : card.service.additionalHours <= 0
                  ? "good"
                  : card.service.additionalHours <= 1
                    ? "ok"
                    : "bad";
            const foodVarStatus = statusAbsLowerBetter(card.cost.foodVarPct01, card.targets.foodVarAbsMax01);

            return (
              <article className="tile" key={card.store}>
                <div className="tileTop">
                  <h3>{card.store}</h3>
                  <span className="pill">OSA WTD: {card.osaWtdCount}</span>
                </div>
                <div className="rows">
                  <div><span>DOT%</span><span className={pillClassFromStatus(dotStatus)}>{fmtPct2(card.service.dotPct01)}</span></div>
                  <div><span>Labour%</span><span className={pillClassFromStatus(labourStatus)}>{fmtPct2(card.service.labourPct01)}</span></div>
                  <div><span>R&amp;L mins</span><span className={pillClassFromStatus(rnlStatus)}>{fmtMins2(card.service.rnlMinutes)}</span></div>
                  <div><span>Extremes&gt;40%</span><span className={pillClassFromStatus(extremesStatus)}>{fmtPct2(card.service.extremesPct01)}</span></div>
                  <div><span>Add hours</span><span className={pillClassFromStatus(addHoursStatus)}>{fmtNum2(card.service.additionalHours)}</span></div>
                  <div><span>Food variance</span><span className={pillClassFromStatus(foodVarStatus)}>{fmtPct2(card.cost.foodVarPct01)}</span></div>
                </div>
                <p className="tasks">Open tasks: {card.tasksOpenCount}</p>
                <p className="notes">Notes: {card.notes || "—"}</p>
              </article>
            );
          })}
        </div>
      </section>

      <style jsx global>{`
        @page { size: A4 portrait; margin: 8mm; }
        html, body { margin: 0; padding: 0; font-family: Inter, Arial, sans-serif; font-size: 11px; color: #0f172a; }
        * { box-sizing: border-box; }
        .page { width: 100%; max-width: 194mm; margin: 0 auto; }
        .banner img { display: block; width: 100%; height: 34mm; object-fit: cover; border-radius: 2mm; margin-bottom: 2.5mm; }
        .section { border: 1px solid #dbe3ef; border-radius: 2mm; padding: 2.2mm; margin-bottom: 2.2mm; }
        h1 { margin: 0 0 1mm; font-size: 14px; }
        h2 { margin: 0 0 1.2mm; font-size: 12px; }
        h3 { margin: 0; font-size: 11.5px; }
        p { margin: 0; line-height: 1.25; }
        .meta { color: #475569; margin-bottom: 1mm; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.8mm; }
        .tile { border: 1px solid #d6dfec; border-radius: 2mm; padding: 1.8mm; min-height: 44mm; break-inside: avoid; }
        .tileTop { display: flex; align-items: center; justify-content: space-between; gap: 1.2mm; margin-bottom: 1.1mm; }
        .rows { display: grid; grid-template-columns: 1fr; gap: .55mm; }
        .rows > div { display: flex; justify-content: space-between; align-items: center; gap: 1mm; }
        .pill { padding: .2mm 1.1mm; border-radius: 999px; border: 1px solid #cbd5e1; font-size: 10px; white-space: nowrap; }
        .pill.green { background: #dcfce7; border-color: #86efac; color: #166534; }
        .pill.amber { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
        .pill.red { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
        .tasks, .notes { margin-top: 1mm; font-size: 10px; color: #334155; }
        @media print {
          html, body { font-size: 10.5px; }
          .section { padding: 2mm; margin-bottom: 1.6mm; }
          .grid { gap: 1.4mm; }
          .tile { padding: 1.6mm; min-height: 42mm; }
          h1 { font-size: 13px; }
          h2 { font-size: 11px; }
          h3 { font-size: 10.6px; }
          .pill { font-size: 9.2px; }
          .tasks, .notes { font-size: 9px; }
        }
      `}</style>
    </main>
  );
}
