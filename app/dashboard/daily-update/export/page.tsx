"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";

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

const INPUT_TARGETS = {
  missedCallsMax01: 0.06,
  aofMin01: 0.62,
  gpsMin01: 0.95,
};

const AREA_TARGETS = {
  labourMax01: 0.26,
  foodVarAbsMax01: 0.003,
  addHoursOkMax: 1,
};

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

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

function PrintTrigger() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 500);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}

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
  const [firstPageTight, setFirstPageTight] = useState(false);
  const [firstPageClampMessage, setFirstPageClampMessage] = useState(false);
  const firstPageRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const previousBusinessDay = getPreviousBusinessDayUk();
        const wkStart = getWeekStartUK(previousBusinessDay);

        setTargetDate(previousBusinessDay);
        setWeekStart(wkStart);

        const [
          areaMessageRes,
          inputsRes,
          tasksRes,
          serviceRes,
          costRes,
          osaRes,
          serviceStoresRes,
          costStoresRes,
          inputStoresRes,
        ] = await Promise.all([
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
          supabase
            .from("osa_internal_results")
            .select("shift_date,store")
            .gte("shift_date", wkStart)
            .lte("shift_date", previousBusinessDay),
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

  const areaRollup = useMemo(() => {
    const sales = sum(costRows.map((r) => Number(r.sales_gbp || 0)));
    const labourCost = sum(costRows.map((r) => Number(r.labour_cost_gbp || 0)));
    const idealFood = sum(costRows.map((r) => Number(r.ideal_food_cost_gbp || 0)));
    const actualFood = sum(costRows.map((r) => Number(r.actual_food_cost_gbp || 0)));

    return {
      labourPct01: sales > 0 ? labourCost / sales : null,
      foodVarPct01: sales > 0 ? (actualFood - idealFood) / sales : null,
      additionalHours: sum(serviceRows.map((r) => Number(r.additional_hours || 0))),
    };
  }, [costRows, serviceRows]);

  const rankedStoreCards = useMemo(() => {
    return stores
      .map((store) => {
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
          inputs,
          tasks: storeTasks,
          osaWtdCount: osaCounts.byStore.get(store) || 0,
          metrics: {
            dotPct01,
            labourPct01,
            rnlMinutes,
            extremesPct01,
            additionalHours,
            foodVarPct01,
            missedCalls01: to01From100(inputs?.missed_calls_wtd ?? null),
            gps01: to01From100(inputs?.gps_tracked_wtd ?? null),
            aof01: to01From100(inputs?.aof_wtd ?? null),
          },
        };
      })
      .sort((a, b) => {
        const aDot = a.metrics.dotPct01 ?? -1;
        const bDot = b.metrics.dotPct01 ?? -1;
        if (bDot !== aDot) return bDot - aDot;
        const aLab = a.metrics.labourPct01 ?? Number.POSITIVE_INFINITY;
        const bLab = b.metrics.labourPct01 ?? Number.POSITIVE_INFINITY;
        return aLab - bLab;
      });
  }, [stores, costRows, serviceRows, inputsByStore, tasksByStore, osaCounts.byStore]);

  const storePages = useMemo(() => chunk(rankedStoreCards, 2), [rankedStoreCards]);
  const highlightCards = useMemo(() => rankedStoreCards.slice(0, 6), [rankedStoreCards]);

  useEffect(() => {
    if (loading || error) return;

    const applyOverflowGuard = () => {
      const pageEl = firstPageRef.current;
      if (!pageEl) return;

      setFirstPageTight(false);
      setFirstPageClampMessage(false);

      requestAnimationFrame(() => {
        const hasOverflow = pageEl.scrollHeight > pageEl.clientHeight;
        if (!hasOverflow) return;

        setFirstPageTight(true);
        requestAnimationFrame(() => {
          const stillOverflows = pageEl.scrollHeight > pageEl.clientHeight;
          if (stillOverflows) setFirstPageClampMessage(true);
        });
      });
    };

    applyOverflowGuard();
    window.addEventListener("resize", applyOverflowGuard);
    return () => window.removeEventListener("resize", applyOverflowGuard);
  }, [loading, error, targetDate, weekStart, areaMessage, highlightCards.length]);

  if (loading) return <main className="exportShell"><p>Loading export…</p></main>;
  if (error) return <main className="exportShell"><p>Failed to load export: {error}</p></main>;

  const areaLabourStatus = statusLowerBetter(areaRollup.labourPct01, AREA_TARGETS.labourMax01);
  const areaFoodStatus = statusAbsLowerBetter(areaRollup.foodVarPct01, AREA_TARGETS.foodVarAbsMax01);
  const areaAddHoursStatus: MetricStatus =
    areaRollup.additionalHours == null || !Number.isFinite(areaRollup.additionalHours)
      ? "na"
      : areaRollup.additionalHours <= 0
        ? "good"
        : areaRollup.additionalHours <= AREA_TARGETS.addHoursOkMax
          ? "ok"
          : "bad";
  const areaOsaStatus: MetricStatus = osaCounts.total <= 0 ? "good" : osaCounts.total <= 1 ? "ok" : "bad";

  return (
    <main className="exportShell">
      <PrintTrigger />

      <section
        ref={firstPageRef}
        className={`exportPage firstPage${firstPageTight ? " printTight" : ""}${firstPageClampMessage ? " printClampMessage" : ""}`}
      >
        <div className="banner">
          <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
        </div>

        <div className="card areaOverview">
          <h1>Daily Update — {targetDate}</h1>
          <h2>Area Overview</h2>
          <p className="overviewRange">WTD from {weekStart} · Previous business day {targetDate}</p>
          <div className="chipRow">
            <div className="chip">
              <span>OSA WTD count</span>
              <span className={pillClassFromStatus(areaOsaStatus)}>{osaCounts.total}</span>
            </div>
            <div className="chip">
              <span>Labour %</span>
              <span className={pillClassFromStatus(areaLabourStatus)}>{fmtPct2(areaRollup.labourPct01)}</span>
            </div>
            <div className="chip">
              <span>Food variance %</span>
              <span className={pillClassFromStatus(areaFoodStatus)}>{fmtPct2(areaRollup.foodVarPct01)}</span>
            </div>
            <div className="chip">
              <span>Additional hours</span>
              <span className={pillClassFromStatus(areaAddHoursStatus)}>{fmtNum2(areaRollup.additionalHours)}</span>
            </div>
          </div>
        </div>

        <div className="card areaMessageBlock">
          <h2>Area Message</h2>
          <p className="fullText areaMessageText">{areaMessage || "No area message submitted for this date."}</p>
          <p className="messageContinuationNote">Message continues on Daily Update page.</p>
        </div>

        <div className="card highlightsBlock">
          <h2>Highlights</h2>
          <div className="highlightsGrid">
            {highlightCards.map((card, idx) => (
              <article key={`highlight-${card.store}`} className="highlightCard">
                <p className="highlightTitle">#{idx + 1} Store Highlight</p>
                <h3>{card.store}</h3>
                <div className="highlightMetrics">
                  <p><span>DOT</span><strong>{fmtPct2(card.metrics.dotPct01)}</strong></p>
                  <p><span>Labour</span><strong>{fmtPct2(card.metrics.labourPct01)}</strong></p>
                  <p><span>Food var</span><strong>{fmtPct2(card.metrics.foodVarPct01)}</strong></p>
                  <p><span>OSA WTD</span><strong>{card.osaWtdCount}</strong></p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {storePages.map((storePair, pairIndex) => (
        <section className="exportPage storesPage" key={`pair-${pairIndex}`}>
          {storePair.map((card) => {
            const dotStatus = statusHigherBetter(card.metrics.dotPct01, card.targets.dotMin01);
            const labourStatus = statusLowerBetter(card.metrics.labourPct01, card.targets.labourMax01);
            const rnlStatus = statusLowerBetter(card.metrics.rnlMinutes, card.targets.rnlMaxMins, 0.1);
            const extremesStatus = statusLowerBetter(card.metrics.extremesPct01, card.targets.extremesMax01);
            const addHoursStatus: MetricStatus =
              card.metrics.additionalHours == null || !Number.isFinite(card.metrics.additionalHours)
                ? "na"
                : card.metrics.additionalHours <= 0
                  ? "good"
                  : card.metrics.additionalHours <= 1
                    ? "ok"
                    : "bad";
            const foodVarStatus = statusAbsLowerBetter(card.metrics.foodVarPct01, card.targets.foodVarAbsMax01);
            const missedStatus = statusLowerBetter(card.metrics.missedCalls01, INPUT_TARGETS.missedCallsMax01);
            const gpsStatus = statusHigherBetter(card.metrics.gps01, INPUT_TARGETS.gpsMin01);
            const aofStatus = statusHigherBetter(card.metrics.aof01, INPUT_TARGETS.aofMin01);

            return (
              <article className="storeHalf" key={card.store}>
                <div className="storeCard">
                  <div className="storeHead">
                    <h3>{card.store}</h3>
                    <span className="pill">OSA WTD: {card.osaWtdCount}</span>
                  </div>

                  <div className="storeGrid">
                    <div className="leftCol">
                      <div className="metricRow"><span>DOT %</span><span className={pillClassFromStatus(dotStatus)}>{fmtPct2(card.metrics.dotPct01)}</span><small>Target ≥ {(card.targets.dotMin01 * 100).toFixed(0)}%</small></div>
                      <div className="metricRow"><span>Labour %</span><span className={pillClassFromStatus(labourStatus)}>{fmtPct2(card.metrics.labourPct01)}</span><small>Target ≤ {(card.targets.labourMax01 * 100).toFixed(0)}%</small></div>
                      <div className="metricRow"><span>R&amp;L mins</span><span className={pillClassFromStatus(rnlStatus)}>{fmtMins2(card.metrics.rnlMinutes)}</span><small>Target ≤ {card.targets.rnlMaxMins.toFixed(0)}m</small></div>
                      <div className="metricRow"><span>Extremes &gt;40 %</span><span className={pillClassFromStatus(extremesStatus)}>{fmtPct2(card.metrics.extremesPct01)}</span><small>Target ≤ {(card.targets.extremesMax01 * 100).toFixed(0)}%</small></div>
                      <div className="metricRow"><span>Additional hours</span><span className={pillClassFromStatus(addHoursStatus)}>{fmtNum2(card.metrics.additionalHours)}</span><small>Target: actual vs rota</small></div>
                      <div className="metricRow"><span>Food variance %</span><span className={pillClassFromStatus(foodVarStatus)}>{fmtPct2(card.metrics.foodVarPct01)}</span><small>Target abs ≤ {(card.targets.foodVarAbsMax01 * 100).toFixed(2)}%</small></div>

                      <div className="metricRow"><span>Missed calls WTD %</span><span className={pillClassFromStatus(missedStatus)}>{fmtPct2(card.metrics.missedCalls01)}</span><small>Target ≤ {(INPUT_TARGETS.missedCallsMax01 * 100).toFixed(0)}%</small></div>
                      <div className="metricRow"><span>GPS tracked WTD %</span><span className={pillClassFromStatus(gpsStatus)}>{fmtPct2(card.metrics.gps01)}</span><small>Target ≥ {(INPUT_TARGETS.gpsMin01 * 100).toFixed(0)}%</small></div>
                      <div className="metricRow"><span>AOF WTD %</span><span className={pillClassFromStatus(aofStatus)}>{fmtPct2(card.metrics.aof01)}</span><small>Target ≥ {(INPUT_TARGETS.aofMin01 * 100).toFixed(0)}%</small></div>
                    </div>

                    <div className="rightCol">
                      <div className="panel">
                        <h4>Service losing targets inputs</h4>
                        <p>Load time target: {fmtNum2(card.inputs?.target_load_time_mins ?? null)}m</p>
                        <p>Rack time target: {fmtNum2(card.inputs?.target_rack_time_mins ?? null)}m</p>
                        <p>ADT target: {fmtNum2(card.inputs?.target_adt_mins ?? null)}m</p>
                        <p>
                          Extremes target %: {card.inputs?.target_extremes_over40_pct == null
                            ? "—"
                            : `${Number(card.inputs.target_extremes_over40_pct).toFixed(2)}%`}
                        </p>
                      </div>

                      <div className="panel">
                        <h4>Notes</h4>
                        <p className="fullText">{card.inputs?.notes?.trim() || "—"}</p>
                      </div>

                      <div className="panel">
                        <h4>Tasks list</h4>
                        {card.tasks.length === 0 ? (
                          <p>No tasks for this store on {targetDate}.</p>
                        ) : (
                          <ul className="taskList">
                            {card.tasks.map((task) => (
                              <li key={task.id}>{task.is_complete ? "☑" : "☐"} {task.task}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ))}

      <style jsx global>{`
        @page { size: A4 landscape; margin: 8mm; }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-sizing: border-box;
        }
        html, body {
          margin: 0;
          padding: 0;
          font-family: Inter, Arial, sans-serif;
          font-size: 14px;
          color: #0f172a;
          background: #f4f7fb;
        }

        .exportShell {
          margin: 0 auto;
          width: 100%;
          max-width: 281mm;
          background: #f4f7fb;
        }

        .exportPage {
          min-height: 190mm;
          display: flex;
          flex-direction: column;
          gap: 3.5mm;
          page-break-after: always;
          break-after: page;
        }
        .exportPage:last-of-type {
          page-break-after: auto;
          break-after: auto;
        }

        .banner img {
          width: 100%;
          height: 33mm;
          object-fit: cover;
          border-radius: 2mm;
          display: block;
        }

        .card,
        .storeCard {
          border: 1px solid #dbe3ef;
          border-radius: 2mm;
          background: #ffffff;
          padding: 2.5mm;
        }

        h1, h2, h3, h4, p { margin: 0; }
        h1 { font-size: 22px; font-weight: 800; }
        h2 { font-size: 17px; font-weight: 750; margin-bottom: 1.2mm; }
        h3 { font-size: 12px; }
        h4 { font-size: 11px; margin-bottom: 0.8mm; }
        .muted { color: #475569; margin-top: 0.8mm; }
        .fullText { white-space: pre-wrap; line-height: 1.3; }

        .areaOverview {
          border: 1.4px solid #94a3b8;
          background: #eef4ff;
          padding: 3.2mm;
        }
        .overviewRange {
          color: #334155;
          font-size: 13px;
          margin-top: 0.8mm;
          font-weight: 500;
        }

        .chipRow {
          margin-top: 2.2mm;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1.8mm;
        }
        .chip {
          border: 1.2px solid #cbd5e1;
          border-radius: 2mm;
          min-height: 14mm;
          min-width: 0;
          padding: 1.4mm 1.8mm;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.2mm;
          font-size: 12px;
          font-weight: 600;
        }
        .chip .pill {
          font-size: 11px;
          padding: 0.55mm 1.8mm;
        }

        .areaMessageBlock {
          padding: 3mm;
        }
        .areaMessageText {
          font-size: 14.5px;
          line-height: 1.58;
        }
        .messageContinuationNote {
          display: none;
          margin-top: 1.3mm;
          font-size: 11px;
          color: #475569;
          font-style: italic;
        }

        .highlightsBlock {
          padding: 3mm;
        }
        .highlightsGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1.8mm;
        }
        .highlightCard {
          border: 1px solid #dbe5f3;
          border-radius: 1.8mm;
          background: #f8fbff;
          padding: 2.3mm;
          min-height: 26mm;
          display: grid;
          gap: 1mm;
        }
        .highlightTitle {
          font-size: 12px;
          color: #334155;
          font-weight: 700;
        }
        .highlightCard h3 {
          font-size: 15px;
          font-weight: 800;
        }
        .highlightMetrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.8mm 1.4mm;
        }
        .highlightMetrics p {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 12px;
          color: #1e293b;
          gap: 1mm;
        }
        .highlightMetrics strong {
          font-size: 13px;
        }

        .storesPage {
          gap: 2mm;
        }
        .storeHalf {
          height: calc((190mm - 2mm) / 2);
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .storeCard {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .storeHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1mm;
          margin-bottom: 1.2mm;
        }

        .storeGrid {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 2mm;
        }

        .leftCol {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.7mm;
          align-content: start;
        }
        .metricRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.8mm;
          align-items: center;
          border: 1px solid #ebf0f8;
          border-radius: 1.2mm;
          padding: 0.8mm;
          font-size: 9.6px;
        }
        .metricRow small {
          grid-column: 1 / -1;
          color: #64748b;
          font-size: 8.5px;
        }

        .rightCol {
          display: grid;
          gap: 1mm;
          align-content: start;
        }
        .panel {
          border: 1px solid #edf2fa;
          border-radius: 1.2mm;
          padding: 1mm;
          font-size: 9.2px;
        }
        .panel p { line-height: 1.3; }

        .taskList {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.5mm;
          line-height: 1.25;
        }

        .pill {
          padding: 0.3mm 1.2mm;
          border-radius: 999px;
          border: 1px solid #cbd5e1;
          font-size: 8.8px;
          white-space: nowrap;
        }
        .pill.green { background: #dcfce7; border-color: #86efac; color: #166534; }
        .pill.amber { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
        .pill.red { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }

        @media print {
          .exportShell { max-width: none; }

          .firstPage.printTight .highlightCard {
            padding: 1.6mm;
          }

          .firstPage.printClampMessage .areaMessageText {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 7;
            overflow: hidden;
          }

          .firstPage.printClampMessage .messageContinuationNote {
            display: block;
          }
        }
      `}</style>
    </main>
  );
}
