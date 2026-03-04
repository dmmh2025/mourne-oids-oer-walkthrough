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
    inputs?.target_extremes_over40_pct != null
      ? to01From100(inputs.target_extremes_over40_pct)
      : null;

  return { ...base, extremesMax01: extFromInputs01 ?? base.extremesMax01 };
};

type MetricStatus = "good" | "ok" | "bad" | "na";
const within = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

const statusHigherBetter = (
  value: number | null,
  targetMin: number,
  tol = 0.002
): MetricStatus => {
  if (value == null || !Number.isFinite(value)) return "na";
  if (value >= targetMin + tol) return "good";
  if (within(value, targetMin, tol)) return "ok";
  return "bad";
};

const statusLowerBetter = (
  value: number | null,
  targetMax: number,
  tol = 0.002
): MetricStatus => {
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

// ---- UI helpers aligned to OSA page ----
const pillClassFromStatus = (s: MetricStatus) => {
  if (s === "good") return "pill green";
  if (s === "ok") return "pill amber";
  if (s === "bad") return "pill red";
  return "pill";
};

const statusEmoji = (s: MetricStatus) => {
  if (s === "good") return "🟢";
  if (s === "ok") return "🟠";
  if (s === "bad") return "🔴";
  return "⚪️";
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
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

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
            .select(
              "shift_date,store,dot_pct,labour_pct,extreme_over_40,rnl_minutes,additional_hours"
            )
            .eq("shift_date", previousBusinessDay),
          supabase
            .from("cost_control_entries")
            .select(
              "shift_date,store,sales_gbp,labour_cost_gbp,ideal_food_cost_gbp,actual_food_cost_gbp"
            )
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
        service
          .map((row) => normalisePct01(row.dot_pct))
          .filter((v): v is number => v != null)
      );
      const extremesPct01 = avg(
        service
          .map((row) => normalisePct01(row.extreme_over_40))
          .filter((v): v is number => v != null)
      );
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

  // ---- statuses (area) ----
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

  // ---- Slack summary ----
  const slackText = useMemo(() => {
    const lines: string[] = [];

    lines.push(`*Mourne-oids Daily Update* (${targetDate || "—"})`);
    if (weekStart) lines.push(`WTD from *${weekStart}*`);
    lines.push("");

    lines.push(`*Area overview*`);
    lines.push(
      `• Labour: ${statusEmoji(areaLabourStatus)} ${fmtPct2(areaRollup.labourPct01)} (≤ ${(AREA_TARGETS.labourMax01 * 100).toFixed(0)}%)`
    );
    lines.push(
      `• Food: ${statusEmoji(areaFoodStatus)} ${fmtPct2(areaRollup.foodVarPct01)} (abs ≤ ${(AREA_TARGETS.foodVarAbsMax01 * 100).toFixed(2)}%)`
    );
    lines.push(
      `• Add. hours: ${statusEmoji(areaAddHoursStatus)} ${fmtNum2(areaRollup.additionalHours)} (actual vs rota)`
    );
    lines.push(`• OSA WTD: ${statusEmoji(areaOsaStatus)} ${osaCounts.total}`);
    lines.push("");

    // Store lines sorted by DOT desc, tiebreak labour asc (per your competitive ordering)
    const ranked = [...storeCards].sort((a, b) => {
      const aDot = a.service.dotPct01 ?? -1;
      const bDot = b.service.dotPct01 ?? -1;
      if (bDot !== aDot) return bDot - aDot;

      const aLab = a.cost.labourPct01 ?? Number.POSITIVE_INFINITY;
      const bLab = b.cost.labourPct01 ?? Number.POSITIVE_INFINITY;
      return aLab - bLab;
    });

    lines.push(`*Stores (ranked by DOT)*`);
    for (const card of ranked) {
      const dotStatus = statusHigherBetter(card.service.dotPct01, card.targets.dotMin01);
      const labourStatus = statusLowerBetter(card.cost.labourPct01, card.targets.labourMax01);
      const rnlStatus = statusLowerBetter(card.service.rnlMinutes, card.targets.rnlMaxMins, 0.1);
      const extremesStatus = statusLowerBetter(card.service.extremesPct01, card.targets.extremesMax01);
      const foodVarStatus = statusAbsLowerBetter(card.cost.foodVarPct01, card.targets.foodVarAbsMax01);

      const addHoursStatus: MetricStatus =
        card.additionalHours == null || !Number.isFinite(card.additionalHours)
          ? "na"
          : card.additionalHours <= 0
            ? "good"
            : card.additionalHours <= 1
              ? "ok"
              : "bad";

      lines.push(
        `• *${card.store}* | DOT ${statusEmoji(dotStatus)} ${fmtPct2(card.service.dotPct01)} | Labour ${statusEmoji(labourStatus)} ${fmtPct2(card.cost.labourPct01)} | R&L ${statusEmoji(rnlStatus)} ${fmtMins2(card.service.rnlMinutes)} | Extremes ${statusEmoji(extremesStatus)} ${fmtPct2(card.service.extremesPct01)} | AddH ${statusEmoji(addHoursStatus)} ${fmtNum2(card.additionalHours)} | Food ${statusEmoji(foodVarStatus)} ${fmtPct2(card.cost.foodVarPct01)} | OSA ${card.osaWtdCount}`
      );

      const notes = card.inputs?.notes?.trim();
      if (notes) lines.push(`   _Notes:_ ${notes}`);

      const openTasks = card.tasks.filter((t) => !t.is_complete);
      if (openTasks.length) lines.push(`   _Open tasks (${openTasks.length}):_ ${openTasks.map((t) => t.task).join(" • ")}`);
    }

    if (areaMessage) {
      lines.push("");
      lines.push(`*Area message*`);
      lines.push(areaMessage);
    }

    return lines.join("\n");
  }, [
    targetDate,
    weekStart,
    areaMessage,
    areaRollup.additionalHours,
    areaRollup.foodVarPct01,
    areaRollup.labourPct01,
    areaLabourStatus,
    areaFoodStatus,
    areaAddHoursStatus,
    areaOsaStatus,
    osaCounts.total,
    storeCards,
  ]);

  const copySlack = async () => {
    try {
      setCopyState("idle");
      await navigator.clipboard.writeText(slackText);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 1600);
    }
  };

  return (
    <main className="wrap">
      <div className="banner print-hidden">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <div className="shell">
        <div className="topbar print-hidden">
          <button className="navbtn" onClick={() => router.back()} type="button">
            ← Back
          </button>
          <div className="topbar-spacer" />
          <button className="navbtn solid" onClick={() => router.push("/")} type="button">
            🏠 Home
          </button>
          <button className="navbtn solid" onClick={() => window.print()} type="button">
            📄 Export PDF
          </button>
        </div>

        <header className="header">
          <h1>Daily Update</h1>
          <p className="subtitle">
            Previous business day: <b>{targetDate || "Loading…"}</b>
            {weekStart ? (
              <>
                {" "}
                • WTD from <b>{weekStart}</b>
              </>
            ) : null}
          </p>

          <div className="kpi-mini">
            <span className="kpi-chip">
              <b>OSA WTD</b>{" "}
              <span className={pillClassFromStatus(areaOsaStatus)} style={{ minWidth: 54 }}>
                {osaCounts.total}
              </span>
            </span>

            <span className="kpi-chip">
              <b>Labour</b>{" "}
              <span className={pillClassFromStatus(areaLabourStatus)}>{fmtPct2(areaRollup.labourPct01)}</span>
            </span>

            <span className="kpi-chip">
              <b>Food</b>{" "}
              <span className={pillClassFromStatus(areaFoodStatus)}>{fmtPct2(areaRollup.foodVarPct01)}</span>
            </span>

            <span className="kpi-chip">
              <b>Add. hours</b>{" "}
              <span className={pillClassFromStatus(areaAddHoursStatus)}>{fmtNum2(areaRollup.additionalHours)}</span>
            </span>
          </div>
        </header>

        {error ? (
          <div className="alert">
            <b>Error:</b> {error}
          </div>
        ) : loading ? (
          <div className="alert muted">Loading daily update…</div>
        ) : null}

        {/* Slack copy */}
        <section className="section">
          <div className="section-head">
            <div>
              <h2>Slack-ready summary</h2>
              <p>One click copy → paste into Slack (keeps bold + bullets).</p>
            </div>
            <div className="kpi-mini">
              <button className="navbtn solid" onClick={copySlack} type="button">
                {copyState === "copied" ? "✅ Copied" : copyState === "error" ? "⚠️ Copy failed" : "📋 Copy"}
              </button>
            </div>
          </div>

          <div className="slackBox">
            <pre className="slackPre">{slackText}</pre>
          </div>
        </section>

        {/* Area message */}
        {areaMessage ? (
          <section className="section callout">
            <div className="section-head">
              <div>
                <h2>Area message</h2>
                <p>Action focus for today.</p>
              </div>
              <span className="pill amber">Action focus</span>
            </div>
            <p className="calloutText">{areaMessage}</p>
          </section>
        ) : null}

        {/* Store cards */}
        {!loading && !error ? (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>Stores</h2>
                <p>Card layout aligned to OSA scorecard style (scan-first).</p>
              </div>
              <div className="kpi-mini">
                <span className="kpi-chip">
                  <b>{stores.length}</b> stores
                </span>
              </div>
            </div>

            <div className="storeGrid">
              {[...storeCards]
                .sort((a, b) => {
                  const aDot = a.service.dotPct01 ?? -1;
                  const bDot = b.service.dotPct01 ?? -1;
                  if (bDot !== aDot) return bDot - aDot;
                  const aLab = a.cost.labourPct01 ?? Number.POSITIVE_INFINITY;
                  const bLab = b.cost.labourPct01 ?? Number.POSITIVE_INFINITY;
                  return aLab - bLab;
                })
                .map((card) => {
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
                      <div className="storeTop">
                        <div>
                          <div className="storeName">{card.store}</div>
                          <div className="storeMeta">
                            <span className="storeChip">
                              <span className="storeChipLabel">OSA WTD</span>
                              <span className={pillClassFromStatus(osaStatus)} style={{ minWidth: 52 }}>
                                {card.osaWtdCount}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="storeBadges">
                          <span className="storeBadge">
                            <span className="badgeLabel">DOT</span>
                            <span className={pillClassFromStatus(dotStatus)}>{fmtPct2(card.service.dotPct01)}</span>
                          </span>
                          <span className="storeBadge">
                            <span className="badgeLabel">Labour</span>
                            <span className={pillClassFromStatus(labourStatus)}>{fmtPct2(card.cost.labourPct01)}</span>
                          </span>
                        </div>
                      </div>

                      <div className="metricGrid">
                        <div className="metric">
                          <div className="metricName">R&amp;L</div>
                          <div className="metricValue">
                            <span className={pillClassFromStatus(rnlStatus)}>{fmtMins2(card.service.rnlMinutes)}</span>
                          </div>
                          <div className="metricHint">≤ {card.targets.rnlMaxMins.toFixed(0)}m</div>
                        </div>

                        <div className="metric">
                          <div className="metricName">Extremes &gt;40</div>
                          <div className="metricValue">
                            <span className={pillClassFromStatus(extremesStatus)}>{fmtPct2(card.service.extremesPct01)}</span>
                          </div>
                          <div className="metricHint">≤ {(card.targets.extremesMax01 * 100).toFixed(0)}%</div>
                        </div>

                        <div className="metric">
                          <div className="metricName">Additional hours</div>
                          <div className="metricValue">
                            <span className={pillClassFromStatus(addHoursStatus)}>{fmtNum2(card.additionalHours)}</span>
                          </div>
                          <div className="metricHint">Actual vs rota</div>
                        </div>

                        <div className="metric">
                          <div className="metricName">Food variance</div>
                          <div className="metricValue">
                            <span className={pillClassFromStatus(foodVarStatus)}>{fmtPct2(card.cost.foodVarPct01)}</span>
                          </div>
                          <div className="metricHint">Abs ≤ {(card.targets.foodVarAbsMax01 * 100).toFixed(2)}%</div>
                        </div>
                      </div>

                      <div className="subGrid">
                        <div className="subMetric">
                          <div className="subName">Missed calls</div>
                          <div className="subVal">
                            <span className={pillClassFromStatus(missedStatus)}>{fmtPct2(card.daily.missedCalls01)}</span>
                          </div>
                          <div className="subHint">≤ 6%</div>
                        </div>
                        <div className="subMetric">
                          <div className="subName">GPS tracked</div>
                          <div className="subVal">
                            <span className={pillClassFromStatus(gpsStatus)}>{fmtPct2(card.daily.gps01)}</span>
                          </div>
                          <div className="subHint">≥ 95%</div>
                        </div>
                        <div className="subMetric">
                          <div className="subName">AOF</div>
                          <div className="subVal">
                            <span className={pillClassFromStatus(aofStatus)}>{fmtPct2(card.daily.aof01)}</span>
                          </div>
                          <div className="subHint">≥ 62%</div>
                        </div>
                      </div>

                      <div className="panels">
                        <div className="panel">
                          <div className="panelHead">
                            <div className="panelTitle">Service losing targets</div>
                            <div className="panelHint">Input</div>
                          </div>
                          <div className="kvGrid">
                            <div className="kv">
                              <span className="kvLabel">Load</span>
                              <span className="kvValue">{fmtNum2(card.inputs?.target_load_time_mins ?? null)}</span>
                            </div>
                            <div className="kv">
                              <span className="kvLabel">Rack</span>
                              <span className="kvValue">{fmtNum2(card.inputs?.target_rack_time_mins ?? null)}</span>
                            </div>
                            <div className="kv">
                              <span className="kvLabel">ADT</span>
                              <span className="kvValue">{fmtNum2(card.inputs?.target_adt_mins ?? null)}</span>
                            </div>
                            <div className="kv">
                              <span className="kvLabel">Extremes %</span>
                              <span className="kvValue">
                                {card.inputs?.target_extremes_over40_pct == null
                                  ? "—"
                                  : `${Number(card.inputs.target_extremes_over40_pct).toFixed(2)}%`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="panel">
                          <div className="panelHead">
                            <div className="panelTitle">Notes</div>
                            <div className="panelHint">From store</div>
                          </div>
                          <div className="noteText">{card.inputs?.notes?.trim() || "—"}</div>
                        </div>

                        <div className="panel">
                          <div className="panelHead">
                            <div className="panelTitle">Tasks</div>
                            <div className="panelHint">{card.tasks.length} item(s)</div>
                          </div>

                          {card.tasks.length === 0 ? (
                            <p className="mutedSmall">No tasks for this store on {targetDate}.</p>
                          ) : (
                            <ul className="taskList">
                              {card.tasks.map((task) => (
                                <li key={task.id} className="task">
                                  <label className="taskRow">
                                    <input
                                      type="checkbox"
                                      checked={task.is_complete}
                                      onChange={() => toggleTask(task)}
                                    />
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
          --text: #0f172a;
          --muted: #64748b;
          --brand: #006491;
          --shadow: 0 16px 40px rgba(0, 0, 0, 0.05);
        }

        /* OSA-style background + center shell */
        .wrap {
          min-height: 100dvh;
          background: radial-gradient(circle at top, rgba(0, 100, 145, 0.08), transparent 45%),
            linear-gradient(180deg, #e3edf4 0%, #f2f5f9 30%, #f2f5f9 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          color: var(--text);
          padding-bottom: 40px;
        }

        .banner {
          display: flex;
          justify-content: center;
          align-items: center;
          background: #fff;
          border-bottom: 3px solid var(--brand);
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
          box-shadow: var(--shadow);
          padding: 18px 22px 26px;
        }

        /* Top nav (OSA buttons) */
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
          border: 2px solid var(--brand);
          background: #fff;
          color: var(--brand);
          font-weight: 900;
          font-size: 14px;
          padding: 8px 12px;
          cursor: pointer;
          box-shadow: 0 6px 14px rgba(0, 100, 145, 0.12);
          transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
        }
        .navbtn:hover {
          background: var(--brand);
          color: #fff;
          transform: translateY(-1px);
        }
        .navbtn.solid {
          background: var(--brand);
          color: #fff;
        }
        .navbtn.solid:hover {
          background: #004b75;
          border-color: #004b75;
        }

        /* Header */
        .header {
          text-align: center;
          margin-bottom: 12px;
        }
        .header h1 {
          font-size: clamp(2rem, 3vw, 2.3rem);
          font-weight: 900;
          letter-spacing: -0.015em;
          margin: 0;
        }
        .subtitle {
          margin: 6px 0 0;
          color: var(--muted);
          font-weight: 700;
          font-size: 0.95rem;
        }

        .kpi-mini {
          margin-top: 12px;
          display: inline-flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
        }
        .kpi-chip {
          font-size: 12px;
          font-weight: 900;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.08);
          border: 1px solid rgba(0, 100, 145, 0.14);
          color: #004b75;
          white-space: nowrap;
          display: inline-flex;
          gap: 8px;
          align-items: center;
        }

        /* Pills (OSA) */
        .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 76px;
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(2, 6, 23, 0.04);
          color: rgba(15, 23, 42, 0.8);
        }
        .pill.green {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.22);
          color: #166534;
        }
        .pill.amber {
          background: rgba(249, 115, 22, 0.12);
          border-color: rgba(249, 115, 22, 0.22);
          color: #9a3412;
        }
        .pill.red {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.22);
          color: #991b1b;
        }

        /* Sections */
        .section {
          margin-top: 16px;
          background: rgba(255, 255, 255, 0.92);
          border-radius: 18px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          padding: 14px 14px;
        }

        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .section-head h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 0.01em;
        }
        .section-head p {
          margin: 4px 0 0;
          font-size: 12px;
          color: var(--muted);
          font-weight: 800;
        }

        .alert {
          margin-top: 14px;
          background: rgba(254, 242, 242, 0.9);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 800;
          color: #7f1d1d;
        }
        .alert.muted {
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(15, 23, 42, 0.1);
          color: #334155;
          font-weight: 800;
        }

        /* Slack pre */
        .slackBox {
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(248, 250, 252, 0.70);
          padding: 12px;
          overflow: auto;
          max-height: 420px;
        }
        .slackPre {
          margin: 0;
          white-space: pre-wrap;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
            "Courier New", monospace;
          font-size: 12px;
          line-height: 1.35;
          color: rgba(15, 23, 42, 0.92);
        }

        /* Callout */
        .callout {
          background: rgba(255, 255, 255, 0.82);
        }
        .calloutText {
          margin: 0;
          white-space: pre-wrap;
          font-weight: 800;
          color: rgba(15, 23, 42, 0.78);
          line-height: 1.45;
        }

        /* Stores grid */
        .storeGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          align-items: start;
        }

        .storeCard {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 18px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          padding: 12px 12px;
        }

        .storeTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .storeName {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: -0.01em;
        }

        .storeMeta {
          margin-top: 6px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .storeChip {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          background: rgba(0, 100, 145, 0.06);
          font-size: 12px;
          font-weight: 900;
          color: #004b75;
          white-space: nowrap;
        }

        .storeChipLabel {
          opacity: 0.9;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          font-size: 11px;
        }

        .storeBadges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .storeBadge {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(2, 6, 23, 0.04);
          font-size: 12px;
          font-weight: 900;
        }

        .badgeLabel {
          font-size: 11px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.65);
          font-weight: 900;
        }

        /* Main metrics */
        .metricGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .metric {
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(248, 250, 252, 0.70);
          padding: 10px 10px;
        }
        .metricName {
          font-size: 11px;
          font-weight: 900; /* ✅ name bold */
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.70);
        }
        .metricValue {
          margin-top: 8px;
        }
        .metricHint {
          margin-top: 8px;
          font-size: 12px;
          font-weight: 800;
          color: rgba(100, 116, 139, 0.98);
        }

        /* Secondary */
        .subGrid {
          margin-top: 10px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .subMetric {
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.85);
          padding: 10px 10px;
        }
        .subName {
          font-size: 11px;
          font-weight: 900; /* ✅ name bold */
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.68);
        }
        .subVal {
          margin-top: 8px;
        }
        .subHint {
          margin-top: 8px;
          font-size: 12px;
          font-weight: 800;
          color: rgba(100, 116, 139, 0.98);
        }

        /* Panels */
        .panels {
          margin-top: 10px;
          display: grid;
          gap: 10px;
        }

        .panel {
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.92);
          padding: 10px 10px;
        }

        .panelHead {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          margin-bottom: 10px;
        }

        .panelTitle {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.78);
          line-height: 1.2;
        }

        .panelHint {
          font-size: 12px;
          font-weight: 800;
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
          border: 1px solid rgba(15, 23, 42, 0.06);
          background: rgba(248, 250, 252, 0.85);
          padding: 9px 10px;
        }

        .kvLabel {
          font-size: 12px;
          font-weight: 900;
          color: rgba(15, 23, 42, 0.72);
        }

        .kvValue {
          font-variant-numeric: tabular-nums;
          font-weight: 900;
          color: rgba(15, 23, 42, 0.92);
        }

        .noteText {
          white-space: pre-wrap;
          font-weight: 800;
          color: rgba(15, 23, 42, 0.82);
          line-height: 1.35;
          font-size: 13px;
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
          border: 1px solid rgba(15, 23, 42, 0.06);
          background: rgba(248, 250, 252, 0.85);
          padding: 8px 10px;
        }
        .taskRow {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-weight: 800;
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

        .mutedSmall {
          color: rgba(100, 116, 139, 0.98);
          font-weight: 800;
          font-size: 12px;
          margin: 0;
        }

        .footer {
          text-align: center;
          margin-top: 18px;
          color: #94a3b8;
          font-size: 0.8rem;
          font-weight: 700;
        }

        @media (max-width: 980px) {
          .storeGrid {
            grid-template-columns: 1fr;
          }
          .subGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .kvGrid {
            grid-template-columns: 1fr;
          }
          .storeTop {
            flex-direction: column;
          }
          .storeBadges {
            justify-content: flex-start;
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
            box-shadow: none;
            border: none;
            background: #fff;
          }
          .section,
          .storeCard,
          .panel,
          .metric,
          .subMetric {
            box-shadow: none !important;
            break-inside: avoid;
          }
          .slackBox {
            max-height: none;
          }
        }
      `}</style>
    </main>
  );
}
