"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

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

const INPUT_TARGETS = {
  missedCallsMax01: 0.06,
  aofMin01: 0.62,
  gpsMin01: 0.95,
};

// Area targets = store targets (director view). Use consistent WTD targets.
const AREA_TARGETS = {
  labourMax01: 0.26,
  foodVarAbsMax01: 0.003,
  // "Additional hours" is contextual; treat <=0 as good, 0-1 ok, >1 bad (same logic as store)
  addHoursOkMax: 1,
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

const to01From100 = (v0to100: number | null) => {
  if (v0to100 == null || !Number.isFinite(v0to100)) return null;
  return v0to100 / 100;
};

const fmtPct2 = (v01: number | null) =>
  v01 == null || !Number.isFinite(v01) ? "—" : `${(v01 * 100).toFixed(2)}%`;
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
    inputs?.target_extremes_over40_pct != null ? to01From100(inputs.target_extremes_over40_pct) : null;

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

const statusAbsLowerBetter = (value: number | null, targetAbsMax: number, tol = 0.002): MetricStatus => {
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

      const dotPct01 = avg(service.map((row) => normalisePct01(row.dot_pct)).filter((v): v is number => v != null));
      const extremesPct01 = avg(service.map((row) => normalisePct01(row.extreme_over_40)).filter((v): v is number => v != null));
      const rnlMinutes = avg(service.map((row) => row.rnl_minutes).filter((v): v is number => v != null));
      const additionalHours = sum(service.map((row) => Number(row.additional_hours || 0)));

      const targets = getTargetsForStore(store, inputs);

      const missedCalls01 = to01From100(inputs?.missed_calls_wtd ?? null);
      const gps01 = to01From100(inputs?.gps_tracked_wtd ?? null);
      const aof01 = to01From100(inputs?.aof_wtd ?? null);

      return {
        store,
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

    return { labourPct01, foodVarPct01, additionalHours };
  }, [costRows, serviceRows]);

  const toggleTask = async (task: TaskRow) => {
    const willComplete = !task.is_complete;
    const completedAt = willComplete ? new Date().toISOString() : null;

    setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, is_complete: willComplete, completed_at: completedAt } : row)));

    const { error: updateError } = await supabase
      .from("daily_update_store_tasks")
      .update({ is_complete: willComplete, completed_at: completedAt })
      .eq("id", task.id);

    if (updateError) {
      setTasks((prev) => prev.map((row) => (row.id === task.id ? task : row)));
      setError(updateError.message);
    }
  };

  const StatusDot = ({ status }: { status: MetricStatus }) => (
    <span className={`dot dot-${status}`} aria-hidden="true" title={status === "na" ? "No data" : status} />
  );

  const ValuePill = (props: { status: MetricStatus; children: React.ReactNode }) => (
    <span className={`valuePill valuePill-${props.status}`}>{props.children}</span>
  );

  const Pill = (props: { children: React.ReactNode; tone?: "slate" | "blue" | "purple" | "red" | "amber" | "green" }) => {
    const tone = props.tone || "slate";
    return <span className={`pill pill-${tone}`}>{props.children}</span>;
  };

  const toneFromStatus = (s: MetricStatus): "green" | "amber" | "red" | "slate" => {
    if (s === "good") return "green";
    if (s === "ok") return "amber";
    if (s === "bad") return "red";
    return "slate";
  };

  const KpiTile = (props: { icon?: string; label: string; value: string; sub?: string; status?: MetricStatus }) => {
    return (
      <div className="kpiTile">
        <div className="kpiTop">
          <div className="kpiLabelRow">
            {props.icon ? <span className="kpiIcon" aria-hidden="true">{props.icon}</span> : null}
            <span className="kpiLabel">{props.label}</span>
          </div>
          {props.status ? <StatusDot status={props.status} /> : null}
        </div>

        <div className="kpiValueRow">
          {props.status ? <ValuePill status={props.status}>{props.value}</ValuePill> : <span className="kpiValuePlain">{props.value}</span>}
        </div>

        {props.sub ? <div className="kpiSub">{props.sub}</div> : null}
      </div>
    );
  };

  const MiniMetric = (props: { label: string; value: string; status: MetricStatus; hint?: string }) => (
    <div className="miniMetric">
      <div className="miniTop">
        <span className="miniLabel" title={props.label}>
          {props.label}
        </span>
        <StatusDot status={props.status} />
      </div>

      <div className="miniValueRow">
        <ValuePill status={props.status}>{props.value}</ValuePill>
      </div>

      {props.hint ? <div className="miniHint">{props.hint}</div> : null}
    </div>
  );

  const KV = (props: { label: string; value: string }) => (
    <div className="kv">
      <span className="kvLabel">{props.label}</span>
      <strong className="kvValue">{props.value}</strong>
    </div>
  );

  // Area statuses
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
  const areaOsaStatus: MetricStatus =
    osaCounts.total <= 0 ? "good" : osaCounts.total <= 1 ? "ok" : "bad";

  return (
    <main className="page">
      <div className="banner print-hidden">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <div className="container">
        <div className="topBar print-hidden">
          <button className="btn" type="button" onClick={() => router.back()}>
            ← Back
          </button>
          <button className="btn" type="button" onClick={() => router.push("/")}>
            🏠 Home
          </button>
          <div className="spacer" />
          <button className="btn btnSolid" type="button" onClick={() => window.print()}>
            📄 Export PDF
          </button>
        </div>

        <header className="header">
          <div className="headerLeft">
            <div className="titleRow">
              <h1>Daily Update</h1>
              <Pill tone="blue">Mourne-oids Hub</Pill>
            </div>
            <div className="metaRow">
              <span className="metaText">
                Previous business day: <strong>{targetDate || "Loading…"}</strong>
              </span>
              {weekStart ? (
                <span className="metaText">
                  WTD from <strong>{weekStart}</strong>
                </span>
              ) : null}
            </div>
          </div>
          <div className="headerRight">
            <Pill tone="slate">“Climbing New Peaks, One Shift at a Time.” ⛰️</Pill>
          </div>
        </header>

        <section className="section">
          <div className="sectionHead">
            <h2>Area snapshot</h2>
            <div className="chipRow">
              <Pill tone={toneFromStatus(areaOsaStatus)}>OSA WTD: {String(osaCounts.total)}</Pill>
            </div>
          </div>

          <div className="kpiGrid">
            <KpiTile
              icon="🧑‍🤝‍🧑"
              label="Labour"
              value={fmtPct2(areaRollup.labourPct01)}
              sub={`Target ≤ ${(AREA_TARGETS.labourMax01 * 100).toFixed(0)}%`}
              status={areaLabourStatus}
            />
            <KpiTile
              icon="🍕"
              label="Food variance"
              value={fmtPct2(areaRollup.foodVarPct01)}
              sub={`Abs ≤ ${(AREA_TARGETS.foodVarAbsMax01 * 100).toFixed(2)}%`}
              status={areaFoodStatus}
            />
            <KpiTile
              icon="⏱️"
              label="Additional hours"
              value={fmtNum2(areaRollup.additionalHours)}
              sub="Actual vs rota (WTD)"
              status={areaAddHoursStatus}
            />
            <KpiTile
              icon="✅"
              label="OSA items"
              value={String(osaCounts.total)}
              sub="Internal OSA logged (WTD)"
              status={areaOsaStatus}
            />
          </div>

          <div className="osaBreakdown">
            <div className="osaTitle">OSA breakdown</div>
            <div className="osaChips">
              {stores.map((store) => {
                const v = osaCounts.byStore.get(store) || 0;
                const s: MetricStatus = v <= 0 ? "good" : v <= 1 ? "ok" : "bad";
                return (
                  <span key={store} className="osaChip">
                    <span className="osaChipName">{store}</span>
                    <ValuePill status={s}>{v}</ValuePill>
                  </span>
                );
              })}
              {!stores.length && <span className="osaChip">No stores loaded</span>}
            </div>
          </div>
        </section>

        {areaMessage ? (
          <section className="section callout">
            <div className="sectionHead">
              <h2>Area message</h2>
              <Pill tone="amber">Action focus</Pill>
            </div>
            <p className="calloutText">{areaMessage}</p>
          </section>
        ) : null}

        {loading && <div className="state">Loading daily update…</div>}
        {error && <div className="state stateError">Error: {error}</div>}

        {!loading && !error ? (
          <section className="section">
            <div className="sectionHead">
              <h2>Stores</h2>
              <span className="mutedSmall"></span>
            </div>

            <div className="storeGrid">
              {storeCards.map((card) => {
                const dotStatus = statusHigherBetter(card.service.dotPct01, card.targets.dotMin01);
                const labourStatus = statusLowerBetter(card.cost.labourPct01, card.targets.labourMax01);
                const rnlStatus = statusLowerBetter(card.service.rnlMinutes, card.targets.rnlMaxMins, 0.1);
                const extremesStatus = statusLowerBetter(card.service.extremesPct01, card.targets.extremesMax01);
                const foodVarStatus = statusAbsLowerBetter(card.cost.foodVarPct01, card.targets.foodVarAbsMax01);

                const missedStatus = statusLowerBetter(card.daily.missedCalls01, INPUT_TARGETS.missedCallsMax01);
                const gpsStatus = statusHigherBetter(card.daily.gps01, INPUT_TARGETS.gpsMin01);
                const aofStatus = statusHigherBetter(card.daily.aof01, INPUT_TARGETS.aofMin01);

                const addHoursStatus: MetricStatus =
                  card.additionalHours == null || !Number.isFinite(card.additionalHours)
                    ? "na"
                    : card.additionalHours <= 0
                      ? "good"
                      : card.additionalHours <= 1
                        ? "ok"
                        : "bad";

                const osaStatus: MetricStatus =
                  card.osaWtdCount <= 0 ? "good" : card.osaWtdCount <= 1 ? "ok" : "bad";

                return (
                  <article key={card.store} className="storeCard">
                    <div className="storeHead">
                      <div className="storeTitle">
                        <h3>{card.store}</h3>
                        <div className="storeChips">
                          <Pill tone={card.osaWtdCount <= 0 ? "green" : card.osaWtdCount === 1 ? "amber" : "red"}>OSA WTD: {card.osaWtdCount}</Pill>
                        </div>
                      </div>
                    </div>

                    <div className="metricGrid">
                      <MiniMetric
                        label="DOT"
                        value={fmtPct2(card.service.dotPct01)}
                        status={dotStatus}
                        hint={`Target ≥ ${(card.targets.dotMin01 * 100).toFixed(0)}%`}
                      />
                      <MiniMetric
                        label="Labour"
                        value={fmtPct2(card.cost.labourPct01)}
                        status={labourStatus}
                        hint={`Target ≤ ${(card.targets.labourMax01 * 100).toFixed(0)}%`}
                      />
                      <MiniMetric
                        label="R&L"
                        value={fmtMins2(card.service.rnlMinutes)}
                        status={rnlStatus}
                        hint={`Target ≤ ${card.targets.rnlMaxMins.toFixed(0)}m`}
                      />
                      <MiniMetric
                        label="Extremes >40"
                        value={fmtPct2(card.service.extremesPct01)}
                        status={extremesStatus}
                        hint={`Target ≤ ${(card.targets.extremesMax01 * 100).toFixed(0)}%`}
                      />
                      <MiniMetric
                        label="Add. hours"
                        value={fmtNum2(card.additionalHours)}
                        status={addHoursStatus}
                        hint="Actual vs rota"
                      />
                      <MiniMetric
                        label="Food variance"
                        value={fmtPct2(card.cost.foodVarPct01)}
                        status={foodVarStatus}
                        hint={`Abs ≤ ${(card.targets.foodVarAbsMax01 * 100).toFixed(2)}%`}
                      />
                    </div>

                    <div className="metricGrid metricGridSecondary">
                      <MiniMetric label="Missed calls" value={fmtPct2(card.daily.missedCalls01)} status={missedStatus} hint="≤ 6%" />
                      <MiniMetric label="GPS tracked" value={fmtPct2(card.daily.gps01)} status={gpsStatus} hint="≥ 95%" />
                      <MiniMetric label="AOF" value={fmtPct2(card.daily.aof01)} status={aofStatus} hint="≥ 62%" />

                      <div className="noteCard">
                        <div className="noteTop">
                          <span className="noteLabel">Notes</span>
                          <span className="noteHint">From store</span>
                        </div>
                        <div className="noteText">{card.inputs?.notes?.trim() || "—"}</div>
                      </div>
                    </div>

                    <div className="panelStack">
                      <div className="panel">
                        <div className="panelHead">
                          <span className="panelTitle">Service losing targets</span>
                          <span className="panelHint">Input</span>
                        </div>
                        <div className="kvGrid">
                          <KV label="Load (mins)" value={fmtNum2(card.inputs?.target_load_time_mins ?? null)} />
                          <KV label="Rack (mins)" value={fmtNum2(card.inputs?.target_rack_time_mins ?? null)} />
                          <KV label="ADT (mins)" value={fmtNum2(card.inputs?.target_adt_mins ?? null)} />
                          <KV
                            label="Extremes %"
                            value={
                              card.inputs?.target_extremes_over40_pct == null
                                ? "—"
                                : `${Number(card.inputs.target_extremes_over40_pct).toFixed(2)}%`
                            }
                          />
                        </div>
                      </div>

                      <div className="panel">
                        <div className="panelHead">
                          <span className="panelTitle">Tasks</span>
                          <span className="panelHint">{card.tasks.length} item(s)</span>
                        </div>

                        {card.tasks.length === 0 ? (
                          <p className="mutedSmall">No tasks for this store on {targetDate}.</p>
                        ) : (
                          <ul className="taskList">
                            {card.tasks.map((task) => (
                              <li key={task.id} className="task">
                                <label className="taskRow">
                                  <input type="checkbox" checked={task.is_complete} onChange={() => toggleTask(task)} />
                                  <span className={task.is_complete ? "taskDone" : ""}>{task.task}</span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <footer className="footer">© {new Date().getFullYear()} Mourne-oids | Domino’s Pizza | Racz Group</footer>
      </div>

      <style jsx>{`
        :root {
          --bg0: #f6f8fb;
          --bg1: #eef3f8;
          --ink: #0f172a;
          --muted: #64748b;
          --card: rgba(255, 255, 255, 0.92);
          --border: rgba(15, 23, 42, 0.10);
          --shadow: 0 12px 28px rgba(2, 6, 23, 0.08);
          --radius: 18px;
        }

        .page {
          min-height: 100dvh;
          background: radial-gradient(900px 420px at 50% 0%, rgba(0, 100, 145, 0.10), transparent 60%),
            linear-gradient(180deg, var(--bg1), var(--bg0));
          color: var(--ink);
          padding-bottom: 28px;
        }

        .banner {
          display: flex;
          justify-content: center;
          background: #fff;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }
        .banner img {
          max-width: min(1160px, 92%);
          height: auto;
          display: block;
        }

        .container {
          width: min(1180px, 94vw);
          margin: 14px auto 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .topBar {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .spacer {
          flex: 1;
        }

        .btn {
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.14);
          background: rgba(255, 255, 255, 0.9);
          color: var(--ink);
          font-weight: 900;
          font-size: 13px;
          padding: 8px 12px;
          cursor: pointer;
          box-shadow: 0 10px 20px rgba(2, 6, 23, 0.06);
        }
        .btn:hover {
          transform: translateY(-1px);
        }
        .btnSolid {
          border-color: rgba(0, 100, 145, 0.20);
          background: linear-gradient(180deg, rgba(0, 100, 145, 0.95), rgba(0, 100, 145, 0.85));
          color: #fff;
        }

        .header {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          padding: 14px 16px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .titleRow {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .header h1 {
          margin: 0;
          font-size: clamp(1.4rem, 2vw, 1.9rem);
          letter-spacing: 0.2px;
        }
        .metaRow {
          margin-top: 6px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .metaText {
          color: rgba(15, 23, 42, 0.72);
          font-weight: 800;
          font-size: 13px;
        }
        .metaText strong {
          color: rgba(15, 23, 42, 0.92);
        }

        .pill {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(15, 23, 42, 0.05);
          color: rgba(15, 23, 42, 0.82);
          font-weight: 950;
          font-size: 12px;
          white-space: nowrap;
        }
        .pill-blue {
          border-color: rgba(0, 100, 145, 0.18);
          background: rgba(0, 100, 145, 0.10);
          color: rgba(11, 79, 112, 0.95);
        }
        .pill-purple {
          border-color: rgba(124, 58, 237, 0.18);
          background: rgba(124, 58, 237, 0.10);
          color: rgba(76, 29, 149, 0.95);
        }
        .pill-green {
          border-color: rgba(34, 197, 94, 0.22);
          background: rgba(34, 197, 94, 0.12);
          color: rgba(20, 83, 45, 0.95);
        }
        .pill-amber {
          border-color: rgba(245, 158, 11, 0.25);
          background: rgba(245, 158, 11, 0.12);
          color: rgba(120, 53, 15, 0.95);
        }
        .pill-red {
          border-color: rgba(239, 68, 68, 0.24);
          background: rgba(239, 68, 68, 0.12);
          color: rgba(127, 29, 29, 0.95);
        }

        .section {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          padding: 14px;
        }

        .sectionHead {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .sectionHead h2 {
          margin: 0;
          font-size: 14px;
          font-weight: 1000;
          letter-spacing: 0.35px;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.78);
        }
        .chipRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .mutedSmall {
          color: rgba(100, 116, 139, 0.98);
          font-weight: 800;
          font-size: 12px;
        }

        /* Value bubbles (traffic light) */
        .valuePill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          font-weight: 1100;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.15px;
          line-height: 1.1;
          white-space: nowrap;
        }
        .valuePill-good {
          background: rgba(34, 197, 94, 0.14);
          border-color: rgba(34, 197, 94, 0.32);
          color: rgba(20, 83, 45, 0.98);
        }
        .valuePill-ok {
          background: rgba(245, 158, 11, 0.14);
          border-color: rgba(245, 158, 11, 0.32);
          color: rgba(120, 53, 15, 0.98);
        }
        .valuePill-bad {
          background: rgba(239, 68, 68, 0.14);
          border-color: rgba(239, 68, 68, 0.32);
          color: rgba(127, 29, 29, 0.98);
        }
        .valuePill-na {
          background: rgba(148, 163, 184, 0.16);
          border-color: rgba(148, 163, 184, 0.30);
          color: rgba(51, 65, 85, 0.95);
        }

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .kpiTile {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(15, 23, 42, 0.10);
          border-radius: 16px;
          padding: 12px;
        }
        .kpiTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .kpiLabelRow {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .kpiIcon {
          font-size: 14px;
        }
        /* ✅ Make metric name bold (not the figure) */
        .kpiLabel {
          font-size: 11px;
          font-weight: 1100;
          letter-spacing: 0.55px;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.78);
        }
        .kpiValueRow {
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .kpiValuePlain {
          font-size: 26px;
          font-weight: 950;
          font-variant-numeric: tabular-nums;
        }
        .kpiValueRow .valuePill {
          font-size: 18px;
        }
        .kpiSub {
          margin-top: 8px;
          font-size: 12px;
          font-weight: 800;
          color: rgba(100, 116, 139, 0.98);
        }

        .osaBreakdown {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(15, 23, 42, 0.07);
        }
        .osaTitle {
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: 0.35px;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.62);
          margin-bottom: 8px;
        }
        .osaChips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .osaChip {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(15, 23, 42, 0.05);
          font-size: 12px;
          font-weight: 950;
          color: rgba(15, 23, 42, 0.78);
        }
        .osaChipName {
          opacity: 0.92;
          font-weight: 950;
        }
        .osaChip .valuePill {
          padding: 5px 10px;
          font-size: 12px;
        }

        .callout {
          background: rgba(248, 250, 252, 0.92);
          border-color: rgba(15, 23, 42, 0.10);
        }
        .calloutText {
          margin: 0;
          white-space: pre-wrap;
          font-weight: 850;
          color: rgba(15, 23, 42, 0.78);
          line-height: 1.45;
        }

        .state {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          box-shadow: 0 10px 20px rgba(2, 6, 23, 0.06);
          padding: 12px 14px;
          font-weight: 850;
          color: rgba(15, 23, 42, 0.78);
        }
        .stateError {
          background: rgba(254, 242, 242, 0.92);
          border-color: rgba(239, 68, 68, 0.20);
          color: rgba(127, 29, 29, 0.95);
        }

        /* 2 stores per row */
        .storeGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          align-items: start;
        }

        .storeCard {
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid rgba(15, 23, 42, 0.10);
          border-radius: var(--radius);
          box-shadow: 0 10px 22px rgba(2, 6, 23, 0.06);
          padding: 14px;
        }

        .storeHead {
          margin-bottom: 12px;
        }
        .storeTitle h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 1000;
          letter-spacing: -0.1px;
        }
        .storeChips {
          margin-top: 8px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .storeChips .pill {
          font-size: 11px;
          padding: 5px 9px;
        }

        /* Metrics rebuilt: label bold + value bubble */
        .metricGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .metricGridSecondary {
          margin-top: 10px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .miniMetric {
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(248, 250, 252, 0.70);
          padding: 12px;
          min-height: 98px;
        }
        .miniTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        /* ✅ Metric NAME bold */
        .miniLabel {
          font-size: 11px;
          font-weight: 1100;
          letter-spacing: 0.55px;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.78);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .miniValueRow {
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .miniValueRow .valuePill {
          font-size: 18px;
        }
        .miniHint {
          margin-top: 8px;
          font-size: 12px;
          font-weight: 800;
          color: rgba(100, 116, 139, 0.98);
        }

        .noteCard {
          grid-column: 1 / -1;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(255, 255, 255, 0.92);
          padding: 12px;
        }
        .noteTop {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
        }
        .noteLabel {
          font-size: 11px;
          font-weight: 1100;
          letter-spacing: 0.55px;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.70);
        }
        .noteHint {
          font-size: 12px;
          font-weight: 850;
          color: rgba(100, 116, 139, 0.98);
        }
        .noteText {
          margin-top: 10px;
          font-size: 13px;
          font-weight: 850;
          line-height: 1.35;
          white-space: pre-wrap;
          color: rgba(15, 23, 42, 0.80);
        }

        .panelStack {
          margin-top: 12px;
          display: grid;
          gap: 10px;
        }
        .panel {
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(255, 255, 255, 0.92);
          padding: 12px;
        }

        /* ✅ Put "Service losing targets" and "Tasks" on their own lines (no bunched headings) */
        .panelHead {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          margin-bottom: 10px;
        }
        .panelTitle {
          font-size: 12px;
          font-weight: 1100;
          letter-spacing: 0.45px;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.78);
          line-height: 1.2;
        }
        .panelHint {
          font-size: 12px;
          font-weight: 850;
          color: rgba(100, 116, 139, 0.98);
        }

        .kvGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .kv {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(248, 250, 252, 0.85);
          padding: 9px 10px;
        }
        .kvLabel {
          font-size: 12px;
          font-weight: 900;
          color: rgba(15, 23, 42, 0.72);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .kvValue {
          font-variant-numeric: tabular-nums;
          font-weight: 1000;
          color: rgba(15, 23, 42, 0.92);
          white-space: nowrap;
        }

        .taskList {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 10px;
        }
        .task {
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(248, 250, 252, 0.85);
          padding: 8px 10px;
        }
        .taskRow {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-weight: 850;
          color: rgba(15, 23, 42, 0.82);
          line-height: 1.25;
        }
        .taskRow input {
          margin-top: 2px;
        }
        .taskDone {
          text-decoration: line-through;
          color: rgba(100, 116, 139, 0.95);
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          display: inline-block;
          flex-shrink: 0;
        }
        .dot-good {
          background: rgba(34, 197, 94, 0.85);
          border-color: rgba(34, 197, 94, 0.40);
        }
        .dot-ok {
          background: rgba(245, 158, 11, 0.85);
          border-color: rgba(245, 158, 11, 0.40);
        }
        .dot-bad {
          background: rgba(239, 68, 68, 0.85);
          border-color: rgba(239, 68, 68, 0.40);
        }
        .dot-na {
          background: rgba(148, 163, 184, 0.75);
          border-color: rgba(148, 163, 184, 0.40);
        }

        .footer {
          text-align: center;
          color: rgba(100, 116, 139, 0.9);
          font-weight: 800;
          font-size: 12px;
          padding: 6px 0 2px;
        }

        @media (max-width: 980px) {
          .kpiGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .storeGrid {
            grid-template-columns: 1fr;
          }
          .metricGridSecondary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .kvGrid {
            grid-template-columns: 1fr;
          }
          .header {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media print {
          .print-hidden,
          .banner {
            display: none !important;
          }
          .page {
            background: #fff;
            padding: 0;
          }
          .container {
            width: 100%;
            margin: 0;
          }
          .section,
          .storeCard,
          .kpiTile,
          .miniMetric,
          .panel,
          .noteCard {
            box-shadow: none !important;
            break-inside: avoid;
          }
        }
      `}</style>
    </main>
  );
}
