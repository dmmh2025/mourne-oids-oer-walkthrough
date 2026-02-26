"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AreaMessageRow = {
  date: string;
  message: string | null;
};

type StoreInputRow = {
  date: string;
  store: string;

  // Stored as 0–100 values (we display as % and compare against targets)
  missed_calls_wtd: number | null;
  gps_tracked_wtd: number | null;
  aof_wtd: number | null;

  target_load_time_mins: number | null;
  target_rack_time_mins: number | null;
  target_adt_mins: number | null;
  target_extremes_over40_pct: number | null; // 0–100
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
  dot_pct: number | null; // 0–1 or 0–100
  labour_pct: number | null; // 0–1 or 0–100
  extreme_over_40: number | null; // 0–1 or 0–100
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

type OsaInternalRow = {
  shift_date: string;
  store: string | null;
};

/** ===== Daily Input targets (global) ===== */
const INPUT_TARGETS = {
  missedCallsMax01: 0.06, // < 6%
  aofMin01: 0.62, // > 62%
  gpsMin01: 0.95, // > 95%
};

/* ---------- UK date (Europe/London) ---------- */
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

const to01From100 = (v0to100: number | null) => {
  if (v0to100 == null || !Number.isFinite(v0to100)) return null;
  return v0to100 / 100;
};

const fmtPct2 = (v01: number | null) =>
  v01 == null ? "—" : `${(v01 * 100).toFixed(2)}%`;

const fmtNum2 = (v: number | null) =>
  v == null || !Number.isFinite(v) ? "—" : `${Number(v).toFixed(2)}`;

const fmtMins2 = (v: number | null) =>
  v == null || !Number.isFinite(v) ? "—" : `${Number(v).toFixed(2)}m`;

const avg = (arr: number[]) =>
  arr.length ? arr.reduce((acc, val) => acc + val, 0) / arr.length : null;

const sum = (arr: number[]) => arr.reduce((acc, val) => acc + val, 0);

type Targets = {
  dotMin01: number;
  labourMax01: number;
  rnlMaxMins: number;
  extremesMax01: number;
  foodVarAbsMax01: number;
};

const DEFAULT_TARGETS: Record<string, Targets> = {
  Downpatrick: {
    dotMin01: 0.82,
    labourMax01: 0.25,
    rnlMaxMins: 9,
    extremesMax01: 0.03,
    foodVarAbsMax01: 0.003,
  },
  Kilkeel: {
    dotMin01: 0.78,
    labourMax01: 0.28,
    rnlMaxMins: 8,
    extremesMax01: 0.04,
    foodVarAbsMax01: 0.003,
  },
  Newcastle: {
    dotMin01: 0.78,
    labourMax01: 0.25,
    rnlMaxMins: 9,
    extremesMax01: 0.04,
    foodVarAbsMax01: 0.003,
  },
  Ballynahinch: {
    dotMin01: 0.78,
    labourMax01: 0.28,
    rnlMaxMins: 9,
    extremesMax01: 0.04,
    foodVarAbsMax01: 0.003,
  },
};

const getTargetsForStore = (store: string, inputs: StoreInputRow | null): Targets => {
  const base =
    DEFAULT_TARGETS[store] || {
      dotMin01: 0.78,
      labourMax01: 0.28,
      rnlMaxMins: 9,
      extremesMax01: 0.04,
      foodVarAbsMax01: 0.003,
    };

  const extFromInputs01 =
    inputs?.target_extremes_over40_pct != null
      ? to01From100(inputs.target_extremes_over40_pct)
      : null;

  return { ...base, extremesMax01: extFromInputs01 ?? base.extremesMax01 };
};

type MetricStatus = "good" | "ok" | "bad" | "na";

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

const statusAbsLowerBetter = (
  value: number | null,
  targetAbsMax: number,
  tol = 0.002
): MetricStatus => {
  if (value == null || !Number.isFinite(value)) return "na";
  const absVal = Math.abs(value);
  if (absVal <= targetAbsMax - tol) return "good";
  if (within(absVal, targetAbsMax, tol)) return "ok";
  return "bad";
};

export default function DailyUpdateClient() {
  const router = useRouter();

  const [targetDate, setTargetDate] = useState<string>("");
  const [weekStart, setWeekStart] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [areaMessage, setAreaMessage] = useState<string>("");
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
          supabase
            .from("daily_update_area_message")
            .select("date,message")
            .eq("date", previousBusinessDay)
            .maybeSingle(),
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
          supabase
            .from("service_shifts")
            .select("store,shift_date")
            .order("shift_date", { ascending: false })
            .limit(500),
          supabase
            .from("cost_control_entries")
            .select("store,shift_date")
            .order("shift_date", { ascending: false })
            .limit(500),
          supabase
            .from("daily_update_store_inputs")
            .select("store,date")
            .order("date", { ascending: false })
            .limit(500),
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
        for (const row of [
          ...(serviceStoresRes.data || []),
          ...(costStoresRes.data || []),
          ...(inputStoresRes.data || []),
        ]) {
          const s = String((row as { store?: string }).store || "").trim();
          if (s) storeSet.add(s);
        }
        setStores(Array.from(storeSet).sort((a, b) => a.localeCompare(b)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load daily update data.");
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
    const total = osaRows.length;
    const byStore = new Map<string, number>();
    for (const r of osaRows) {
      const s = String(r.store || "").trim();
      if (!s) continue;
      byStore.set(s, (byStore.get(s) || 0) + 1);
    }
    return { total, byStore };
  }, [osaRows]);

  const storeCards = useMemo(() => {
    return stores.map((store) => {
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

      const dotPct01 = avg(
        service.map((row) => normalisePct01(row.dot_pct)).filter((v): v is number => v != null)
      );
      const extremesPct01 = avg(
        service.map((row) => normalisePct01(row.extreme_over_40)).filter((v): v is number => v != null)
      );
      const rnlMinutes = avg(service.map((row) => row.rnl_minutes).filter((v): v is number => v != null));

      const additionalHours = sum(service.map((row) => Number(row.additional_hours || 0)));

      const targets = getTargetsForStore(store, inputs);

      // daily input values converted to 0–1 for comparisons + formatting
      const missedCalls01 = to01From100(inputs?.missed_calls_wtd ?? null);
      const gps01 = to01From100(inputs?.gps_tracked_wtd ?? null);
      const aof01 = to01From100(inputs?.aof_wtd ?? null);

      return {
        store,
        sales,
        additionalHours,
        cost: { labourPct01, foodVarPct01 },
        service: { dotPct01, extremesPct01, rnlMinutes },
        inputs,
        tasks: storeTasks,
        targets,
        osaWtdCount: osaCounts.byStore.get(store) || 0,
        daily: { missedCalls01, gps01, aof01 },
      };
    });
  }, [stores, costRows, serviceRows, inputsByStore, tasksByStore, osaCounts.byStore]);

  const areaRollup = useMemo(() => {
    const sales = sum(costRows.map((r) => Number(r.sales_gbp || 0)));
    const labourCost = sum(costRows.map((r) => Number(r.labour_cost_gbp || 0)));
    const idealFood = sum(costRows.map((r) => Number(r.ideal_food_cost_gbp || 0)));
    const actualFood = sum(costRows.map((r) => Number(r.actual_food_cost_gbp || 0)));

    const labourPct01 = sales > 0 ? labourCost / sales : null;
    const foodVarPct01 = sales > 0 ? (actualFood - idealFood) / sales : null;

    const additionalHours = sum(serviceRows.map((r) => Number(r.additional_hours || 0)));

    return { sales, labourPct01, foodVarPct01, additionalHours };
  }, [costRows, serviceRows]);

  const toggleTask = async (task: TaskRow) => {
    const willComplete = !task.is_complete;
    const completedAt = willComplete ? new Date().toISOString() : null;

    setTasks((prev) =>
      prev.map((row) =>
        row.id === task.id ? { ...row, is_complete: willComplete, completed_at: completedAt } : row
      )
    );

    const { error: updateError } = await supabase
      .from("daily_update_store_tasks")
      .update({ is_complete: willComplete, completed_at: completedAt })
      .eq("id", task.id);

    if (updateError) {
      setTasks((prev) => prev.map((row) => (row.id === task.id ? task : row)));
      setError(updateError.message);
    }
  };

  const MetricLine = (props: { label: string; valueText: string; status: MetricStatus }) => {
    const cls =
      props.status === "good"
        ? "metric good"
        : props.status === "ok"
        ? "metric ok"
        : props.status === "bad"
        ? "metric bad"
        : "metric na";

    return (
      <div className={cls}>
        <span className="mLabel">{props.label}</span>
        <span className="mRight">
          <strong className="mValue">{props.valueText}</strong>
        </span>
      </div>
    );
  };

  const AreaBox = (props: { label: string; value: string; sub?: string }) => (
    <div className="areaBox">
      <div className="areaBoxTop">
        <span className="areaBoxLabel">{props.label}</span>
      </div>
      <div className="areaBoxValue">{props.value}</div>
      {props.sub ? <div className="areaBoxSub">{props.sub}</div> : null}
    </div>
  );

  return (
    <main className="wrap">
      <div className="banner">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <div className="shell">
        <div className="topbar print-hidden">
          <button className="navbtn" type="button" onClick={() => router.back()}>
            ← Back
          </button>
          <div className="topbar-spacer" />
          <button className="navbtn" type="button" onClick={() => router.push("/")}>
            🏠 Home
          </button>
          <button className="navbtn solid" type="button" onClick={() => window.print()}>
            📄 Export PDF
          </button>
        </div>

        <header className="header">
          <h1>Mourne-oids Daily Update</h1>
          <p className="subtitle">
            Previous business day: {targetDate || "Loading…"}
            {weekStart ? ` · WTD from ${weekStart}` : ""}
          </p>
        </header>

        {/* Area overview: 4 highlighted boxes in one row */}
        <section className="areaOverview">
          <AreaBox label="Area Labour" value={fmtPct2(areaRollup.labourPct01)} />
          <AreaBox label="Area Food Var" value={fmtPct2(areaRollup.foodVarPct01)} />
          <AreaBox label="Area Add. Hours" value={fmtNum2(areaRollup.additionalHours)} />
          <AreaBox label="OSA WTD" value={String(osaCounts.total)} sub="Total checks WTD" />

          <div className="storeOsaRow">
            {stores.map((store) => (
              <span key={store} className="chip">
                {store}: {String(osaCounts.byStore.get(store) || 0)}
              </span>
            ))}
            {!stores.length && <span className="chip">No stores loaded</span>}
          </div>
        </section>

        {areaMessage && (
          <section className="message">
            <h2>Area Message</h2>
            <p>{areaMessage}</p>
          </section>
        )}

        {loading && <div className="alert">Loading daily update…</div>}
        {error && <div className="alert error">Error: {error}</div>}

        {!loading && !error && (
          <section className="storesGrid">
            {storeCards.map((card) => {
              const dotStatus = statusHigherBetter(card.service.dotPct01, card.targets.dotMin01);
              const labourStatus = statusLowerBetter(card.cost.labourPct01, card.targets.labourMax01);
              const rnlStatus = statusLowerBetter(card.service.rnlMinutes, card.targets.rnlMaxMins, 0.1);
              const extremesStatus = statusLowerBetter(card.service.extremesPct01, card.targets.extremesMax01);
              const foodVarStatus = statusAbsLowerBetter(card.cost.foodVarPct01, card.targets.foodVarAbsMax01);

              // Daily input KPI statuses (targets: Missed <6%, GPS >95%, AOF >62%)
              const missedStatus = statusLowerBetter(card.daily.missedCalls01, INPUT_TARGETS.missedCallsMax01);
              const gpsStatus = statusHigherBetter(card.daily.gps01, INPUT_TARGETS.gpsMin01);
              const aofStatus = statusHigherBetter(card.daily.aof01, INPUT_TARGETS.aofMin01);

              const addHoursStatus: MetricStatus =
                card.additionalHours == null
                  ? "na"
                  : !Number.isFinite(card.additionalHours)
                  ? "na"
                  : card.additionalHours <= 0
                  ? "good"
                  : card.additionalHours <= 1
                  ? "ok"
                  : "bad";

              return (
                <article key={card.store} className="storeCard">
                  <div className="storeHead">
                    <h2 className="storeName">{card.store}</h2>
                    <span className="osaChip">OSA WTD: {card.osaWtdCount}</span>
                  </div>

                  <div className="metricGrid">
                    <div className="metricBlock">
                      <h3>Cost Controls</h3>
                      <MetricLine label="Labour %" valueText={fmtPct2(card.cost.labourPct01)} status={labourStatus} />
                      <MetricLine
                        label="Food var % of sales"
                        valueText={fmtPct2(card.cost.foodVarPct01)}
                        status={foodVarStatus}
                      />
                    </div>

                    <div className="metricBlock">
                      <h3>Service</h3>
                      <MetricLine label="DOT %" valueText={fmtPct2(card.service.dotPct01)} status={dotStatus} />
                      <MetricLine label="R&L mins" valueText={fmtMins2(card.service.rnlMinutes)} status={rnlStatus} />
                      <MetricLine
                        label="Extremes >40"
                        valueText={fmtPct2(card.service.extremesPct01)}
                        status={extremesStatus}
                      />
                      <MetricLine label="Additional hours" valueText={fmtNum2(card.additionalHours)} status={addHoursStatus} />
                    </div>

                    <div className="metricBlock">
                      <h3>Daily Inputs</h3>
                      <MetricLine
                        label="Missed Calls (WTD %)"
                        valueText={fmtPct2(card.daily.missedCalls01)}
                        status={missedStatus}
                      />
                      <MetricLine
                        label="GPS Tracked (WTD %)"
                        valueText={fmtPct2(card.daily.gps01)}
                        status={gpsStatus}
                      />
                      <MetricLine label="AOF (WTD %)" valueText={fmtPct2(card.daily.aof01)} status={aofStatus} />
                    </div>
                  </div>

                  {/* Notes: make it stand out */}
                  <section className="notes">
                    <h3>Notes</h3>
                    <p>{card.inputs?.notes?.trim() || "—"}</p>
                  </section>

                  {/* Targets: keep the data but remove arrows/extra notes; keep it compact */}
                  <section className="targets">
                    <h3>Service Losing Targets</h3>
                    <div className="metricGrid compact">
                      <div className="lineItem">
                        <span>Load target (mins)</span>
                        <strong>{fmtNum2(card.inputs?.target_load_time_mins ?? null)}</strong>
                      </div>
                      <div className="lineItem">
                        <span>Rack target (mins)</span>
                        <strong>{fmtNum2(card.inputs?.target_rack_time_mins ?? null)}</strong>
                      </div>
                      <div className="lineItem">
                        <span>ADT target (mins)</span>
                        <strong>{fmtNum2(card.inputs?.target_adt_mins ?? null)}</strong>
                      </div>
                      <div className="lineItem">
                        <span>Extremes target %</span>
                        <strong>
                          {card.inputs?.target_extremes_over40_pct == null
                            ? "—"
                            : `${Number(card.inputs.target_extremes_over40_pct).toFixed(2)}%`}
                        </strong>
                      </div>
                    </div>
                  </section>

                  {/* Tasks: make it stand out */}
                  <section className="tasks">
                    <h3>Tasks</h3>
                    {card.tasks.length === 0 ? (
                      <p className="placeholder">No tasks for this store on {targetDate}.</p>
                    ) : (
                      <ul>
                        {card.tasks.map((task) => (
                          <li key={task.id}>
                            <label>
                              <input type="checkbox" checked={task.is_complete} onChange={() => toggleTask(task)} />
                              <span className={task.is_complete ? "done" : ""}>{task.task}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </article>
              );
            })}
          </section>
        )}
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100dvh;
          background: radial-gradient(circle at top, rgba(0, 100, 145, 0.08), transparent 45%),
            linear-gradient(180deg, #e3edf4 0%, #f2f5f9 30%, #f2f5f9 100%);
          color: #0f172a;
          padding-bottom: 32px;
        }
        .banner {
          display: flex;
          justify-content: center;
          background: #fff;
          border-bottom: 3px solid #006491;
        }
        .banner img {
          max-width: min(1160px, 92%);
          height: auto;
          display: block;
        }
        .shell {
          width: min(1180px, 95vw);
          margin: 20px auto;
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: saturate(160%) blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 1.5rem;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.05);
          padding: 18px;
        }
        .topbar {
          display: flex;
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
          margin: 0;
        }
        .subtitle {
          color: #64748b;
          font-weight: 800;
          margin: 4px 0 0;
        }

        /* === Area overview: 4 boxes row === */
        .areaOverview {
          display: grid;
          gap: 10px;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(0, 100, 145, 0.14);
          border-radius: 16px;
          padding: 12px;
        }
        .areaBox {
          border-radius: 16px;
          background: rgba(0, 100, 145, 0.08);
          border: 1px solid rgba(0, 100, 145, 0.16);
          padding: 10px 12px;
        }
        .areaBoxTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .areaBoxLabel {
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          color: #0f172a;
        }
        .areaBoxValue {
          margin-top: 6px;
          font-weight: 950;
          font-size: 20px;
          color: #006491;
          letter-spacing: 0.2px;
        }
        .areaBoxSub {
          margin-top: 4px;
          font-size: 12px;
          font-weight: 800;
          color: #475569;
        }
        .areaOverview {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .storeOsaRow {
          grid-column: 1 / -1;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 2px;
        }
        .chip {
          border: 1px solid rgba(0, 100, 145, 0.16);
          border-radius: 999px;
          padding: 4px 10px;
          background: rgba(0, 100, 145, 0.08);
          font-size: 12px;
          font-weight: 900;
        }

        /* === Message: pop === */
        .message {
          margin-top: 12px;
          border: 2px solid rgba(0, 100, 145, 0.22);
          border-radius: 16px;
          background: rgba(0, 100, 145, 0.06);
          padding: 12px;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.05);
        }
        .message h2 {
          margin: 0 0 6px;
          font-size: 16px;
          letter-spacing: 0.2px;
        }
        .message p {
          margin: 0;
          white-space: pre-wrap;
          font-weight: 950;
          color: #334155;
        }

        .alert {
          margin-top: 12px;
          border-radius: 14px;
          padding: 12px;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(15, 23, 42, 0.1);
        }
        .alert.error {
          background: rgba(254, 242, 242, 0.9);
          border-color: rgba(239, 68, 68, 0.25);
          color: #7f1d1d;
        }

        .storesGrid {
          margin-top: 12px;
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .storeCard {
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(0, 100, 145, 0.14);
          border-radius: 18px;
          padding: 14px;
        }
        .storeHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .storeName {
          margin: 0;
          font-size: 20px;
        }
        .osaChip {
          border-radius: 999px;
          padding: 6px 10px;
          background: rgba(124, 58, 237, 0.08);
          border: 1px solid rgba(124, 58, 237, 0.18);
          color: #4c1d95;
          font-weight: 950;
          font-size: 12px;
          white-space: nowrap;
        }

        .metricGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .metricGrid.compact {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 10px;
        }

        .metricBlock {
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 12px;
          background: #fff;
          padding: 10px;
        }
        .metricBlock h3,
        .notes h3,
        .targets h3,
        .tasks h3 {
          margin: 0 0 8px;
          font-size: 13px;
          text-transform: uppercase;
          color: #334155;
        }

        .metric {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          border-radius: 12px;
          padding: 9px 12px;
          margin-top: 8px;
          font-size: 13px;
          border: 1px solid rgba(15, 23, 42, 0.05);
          background: rgba(248, 250, 252, 0.75);
        }
        .metric.good {
          background: rgba(220, 252, 231, 0.75);
          border-color: rgba(34, 197, 94, 0.25);
        }
        .metric.ok {
          background: rgba(255, 237, 213, 0.7);
          border-color: rgba(245, 158, 11, 0.25);
        }
        .metric.bad {
          background: rgba(254, 226, 226, 0.75);
          border-color: rgba(239, 68, 68, 0.25);
        }
        .metric.na {
          opacity: 0.8;
        }

        .mLabel {
          font-weight: 900;
          color: #0f172a;
        }
        .mRight {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }
        .mValue {
          font-weight: 950;
          color: #0f172a;
        }

        .lineItem {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 10px;
          padding: 6px 8px;
          background: rgba(248, 250, 252, 0.8);
          font-size: 13px;
          margin-top: 6px;
        }
        .lineItem strong {
          white-space: nowrap;
        }

        .placeholder {
          margin: 0;
          color: #64748b;
          font-weight: 800;
        }

        .notes,
        .targets,
        .tasks {
          margin-top: 10px;
          border: 2px solid rgba(15, 23, 42, 0.1);
          border-radius: 12px;
          background: #fff;
          padding: 10px;
        }

        /* Notes stand out */
        .notes {
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.05);
          border-left: 6px solid rgba(0, 100, 145, 0.7);
          background: rgba(255, 255, 255, 0.98);
        }
        .notes p {
          margin: 0;
          white-space: pre-wrap;
          font-weight: 850;
          color: #334155;
        }

        /* Tasks stand out */
        .tasks {
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.05);
          border-left: 6px solid rgba(124, 58, 237, 0.55);
          background: rgba(255, 255, 255, 0.98);
        }
        .tasks ul {
          margin: 0;
          padding-left: 0;
          list-style: none;
          display: grid;
          gap: 8px;
        }
        .tasks label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
        }
        .done {
          text-decoration: line-through;
          color: #64748b;
        }

        @media (max-width: 980px) {
          .storesGrid,
          .metricGrid,
          .metricGrid.compact {
            grid-template-columns: 1fr;
          }
          .areaOverview {
            grid-template-columns: 1fr;
          }
        }

        @media print {
          .print-hidden,
          .banner {
            display: none !important;
          }
          .wrap {
            background: #fff;
            padding: 0;
          }
          .shell {
            width: 100%;
            margin: 0;
            border: none;
            box-shadow: none;
            background: #fff;
            padding: 0;
          }
          .storesGrid {
            grid-template-columns: 1fr;
          }
          .storeCard,
          .metricBlock,
          .notes,
          .targets,
          .tasks,
          .areaOverview,
          .message {
            break-inside: avoid;
            box-shadow: none;
          }
        }
      `}</style>
    </main>
  );
}
