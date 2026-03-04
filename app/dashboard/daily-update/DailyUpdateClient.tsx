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

type ServiceRowMini = {
  store: string;
  dot_pct: number | null;
  labour_pct: number | null;
  rnl_minutes?: number | null;
  manager: string | null;
  created_at?: string | null;
  shift_date?: string | null;
};

type RankedItem = {
  name: string;
  avgDOT: number;
  avgLabour: number;
  avgRnlMinutes: number;
  shifts: number;
};


type CostControlRow = {
  shift_date: string;
  store: string;
  sales_gbp: number | null;
  labour_cost_gbp: number | null;
  ideal_food_cost_gbp: number | null;
  actual_food_cost_gbp: number | null;
};

type OsaInternalRow = { shift_date: string; store: string | null; points_lost: number | null };

type OsaInternalHighlightRow = {
  shift_date: string;
  team_member_name: string | null;
  points_lost: number | null;
};

type OsaWinner = {
  name: string;
  avgPointsLost: number | null;
};

type CostWinner = {
  foodName: string;
  foodVarPctSales: number | null;
};

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

const addDaysIsoUk = (isoDate: string, days: number) => {
  const d = parseIsoDate(isoDate);
  d.setDate(d.getDate() + days);
  return toISODateUK(d);
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
const fmtNum1 = (v: number | null) =>
  v == null || !Number.isFinite(v) ? "—" : `${Number(v).toFixed(1)}`;
const fmtMins2 = (v: number | null) =>
  v == null || !Number.isFinite(v) ? "—" : `${Number(v).toFixed(2)}m`;

const fmtDelta = (delta: number | null, kind: "pct" | "mins") => {
  if (delta == null || !Number.isFinite(delta)) return "";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "•";
  const abs = Math.abs(delta);
  if (kind === "mins") return `${arrow} ${(delta >= 0 ? "+" : "-")}${abs.toFixed(2)}m`;
  return `${arrow} ${(delta >= 0 ? "+" : "-")}${(abs * 100).toFixed(2)}pp`;
};

const buildSdlwLine = (value: number | null, sdlwValue: number | null, kind: "pct" | "mins") => {
  if (sdlwValue == null || !Number.isFinite(sdlwValue)) return "SDLW: —";
  const base = kind === "mins" ? `${sdlwValue.toFixed(2)}m` : `${(sdlwValue * 100).toFixed(2)}%`;
  const delta = value == null || !Number.isFinite(value) ? null : value - sdlwValue;
  const deltaText = fmtDelta(delta, kind);
  return `SDLW: ${base}${deltaText ? ` ${deltaText}` : ""}`;
};

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
type SignalCategory = "Service" | "Food" | "Labour" | "OSA";
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

const normalisePct = (v: number | null) => {
  if (v == null) return null;
  return v > 1 ? v / 100 : v;
};

const formatPct = (v: number | null, dp = 0) => (v == null ? "—" : (v * 100).toFixed(dp) + "%");

const formatAvgPointsLost = (v: number | null) => (v == null ? "—" : v.toFixed(1));

const computeRanked = (rows: ServiceRowMini[], key: "store" | "manager") => {
  const bucket: Record<string, { dot: number[]; labour: number[]; rnl: number[]; shifts: number }> = {};

  for (const r of rows) {
    const name = key === "store" ? (r.store || "").trim() : (r.manager || "Unknown").trim() || "Unknown";
    if (!name) continue;

    if (!bucket[name]) bucket[name] = { dot: [], labour: [], rnl: [], shifts: 0 };
    bucket[name].shifts += 1;

    const d = normalisePct(r.dot_pct);
    const l = normalisePct(r.labour_pct);
    if (d != null) bucket[name].dot.push(d);
    if (l != null) bucket[name].labour.push(l);
    if (r.rnl_minutes != null) bucket[name].rnl.push(r.rnl_minutes);
  }

  const avgInner = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const out: RankedItem[] = Object.entries(bucket).map(([name, v]) => ({
    name,
    avgDOT: avgInner(v.dot),
    avgLabour: avgInner(v.labour),
    avgRnlMinutes: avgInner(v.rnl),
    shifts: v.shifts,
  }));

  out.sort((a, b) => {
    if (b.avgDOT !== a.avgDOT) return b.avgDOT - a.avgDOT;
    if (a.avgLabour !== b.avgLabour) return a.avgLabour - b.avgLabour;
    return a.avgRnlMinutes - b.avgRnlMinutes;
  });

  return out;
};



type CostTotals = { sales: number; labour: number; ideal: number; actual: number };

const accumulateCostTotals = (rows: CostControlRow[]) => {
  const byStore: Record<string, CostTotals> = {};
  const area: CostTotals = { sales: 0, labour: 0, ideal: 0, actual: 0 };

  for (const row of rows) {
    const store = String(row.store || "").trim();
    if (!store) continue;
    if (!byStore[store]) byStore[store] = { sales: 0, labour: 0, ideal: 0, actual: 0 };

    const sales = Number(row.sales_gbp);
    const labour = Number(row.labour_cost_gbp);
    const ideal = Number(row.ideal_food_cost_gbp);
    const actual = Number(row.actual_food_cost_gbp);

    if (Number.isFinite(sales)) {
      byStore[store].sales += sales;
      area.sales += sales;
    }
    if (Number.isFinite(labour)) {
      byStore[store].labour += labour;
      area.labour += labour;
    }
    if (Number.isFinite(ideal)) {
      byStore[store].ideal += ideal;
      area.ideal += ideal;
    }
    if (Number.isFinite(actual)) {
      byStore[store].actual += actual;
      area.actual += actual;
    }
  }

  return { byStore, area };
};

const totalsToRatios = (totals: CostTotals) => ({
  labourPct01: totals.sales > 0 ? totals.labour / totals.sales : null,
  foodVarPct01: totals.sales > 0 ? (totals.actual - totals.ideal) / totals.sales : null,
});

export default function DailyUpdateClient({ exportMode = false }: { exportMode?: boolean } = {}) {
  const router = useRouter();

  const [targetDate, setTargetDate] = useState<string>("");
  const [weekStart, setWeekStart] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [areaMessage, setAreaMessage] = useState<string>("");
  const [storeInputs, setStoreInputs] = useState<StoreInputRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [serviceRows, setServiceRows] = useState<ServiceShiftRow[]>([]);
  const [sdlwServiceRows, setSdlwServiceRows] = useState<ServiceShiftRow[]>([]);
  const [costRows, setCostRows] = useState<CostControlRow[]>([]);
  const [sdlwCostRows, setSdlwCostRows] = useState<CostControlRow[]>([]);
  const [osaRows, setOsaRows] = useState<OsaInternalRow[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [svcRows, setSvcRows] = useState<ServiceRowMini[]>([]);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);
  const [osaWinner, setOsaWinner] = useState<OsaWinner | null>(null);
  const [osaHighlightError, setOsaHighlightError] = useState<string | null>(null);
  const [costWinner, setCostWinner] = useState<CostWinner | null>(null);
  const [costHighlightError, setCostHighlightError] = useState<string | null>(null);

  // NEW: screenshot-friendly toggle (keeps tiles compact like Service Dashboard)
  const [showDetails, setShowDetails] = useState(exportMode);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const previousBusinessDay = getPreviousBusinessDayUk();
        const sdlwDate = addDaysIsoUk(previousBusinessDay, -7);
        const wkStart = getWeekStartUK(previousBusinessDay);

        setTargetDate(previousBusinessDay);
        setWeekStart(wkStart);

        const [
          areaMessageRes,
          inputsRes,
          tasksRes,
          serviceRes,
          sdlwServiceRes,
          costRes,
          sdlwCostRes,
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
            .from("service_shifts")
            .select("shift_date,store,dot_pct,labour_pct,extreme_over_40,rnl_minutes,additional_hours")
            .eq("shift_date", sdlwDate),
          supabase
            .from("cost_control_entries")
            .select("shift_date,store,sales_gbp,labour_cost_gbp,ideal_food_cost_gbp,actual_food_cost_gbp")
            .eq("shift_date", previousBusinessDay),
          supabase
            .from("cost_control_entries")
            .select("shift_date,store,sales_gbp,labour_cost_gbp,ideal_food_cost_gbp,actual_food_cost_gbp")
            .eq("shift_date", sdlwDate),
          supabase
            .from("osa_internal_results")
            .select("shift_date,store,points_lost")
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
          sdlwServiceRes.error,
          costRes.error,
          sdlwCostRes.error,
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
        setSdlwServiceRows((sdlwServiceRes.data || []) as ServiceShiftRow[]);
        setCostRows((costRes.data || []) as CostControlRow[]);
        setSdlwCostRows((sdlwCostRes.data || []) as CostControlRow[]);
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

  useEffect(() => {
    const loadHighlights = async () => {
      try {
        setHighlightsError(null);

        const now = new Date();
        const day = now.getDay();
        const mondayOffset = day === 0 ? 6 : day - 1;

        const weekStartLocal = new Date(now);
        weekStartLocal.setDate(now.getDate() - mondayOffset);
        weekStartLocal.setHours(0, 0, 0, 0);

        const weekStartStr = weekStartLocal.toISOString().slice(0, 10);

        const { data, error: queryError } = await supabase
          .from("service_shifts")
          .select("store, dot_pct, labour_pct, rnl_minutes, manager, created_at, shift_date")
          .gte("shift_date", weekStartStr)
          .order("shift_date", { ascending: false });

        if (queryError) throw queryError;
        setSvcRows((data || []) as ServiceRowMini[]);
      } catch (e: any) {
        setHighlightsError(e?.message || "Could not load highlights");
        setSvcRows([]);
      }
    };

    loadHighlights();
  }, []);

  useEffect(() => {
    const loadBestOsaPerformer = async () => {
      try {
        setOsaHighlightError(null);

        const now = new Date();
        const day = now.getDay();
        const mondayOffset = day === 0 ? 6 : day - 1;
        const weekStartLocal = new Date(now);
        weekStartLocal.setDate(now.getDate() - mondayOffset);
        weekStartLocal.setHours(0, 0, 0, 0);
        const weekStartStr = weekStartLocal.toISOString().slice(0, 10);

        const { data, error: queryError } = await supabase
          .from("osa_internal_results")
          .select("shift_date, team_member_name, points_lost")
          .gte("shift_date", weekStartStr);

        if (queryError) throw queryError;

        const bucket: Record<string, { total: number; count: number }> = {};

        for (const row of (data || []) as OsaInternalHighlightRow[]) {
          const name = (row.team_member_name || "").trim() || "Unknown";
          const pointsLost = Number(row.points_lost);
          if (!Number.isFinite(pointsLost)) continue;

          if (!bucket[name]) bucket[name] = { total: 0, count: 0 };
          bucket[name].total += pointsLost;
          bucket[name].count += 1;
        }

        const ranked = Object.entries(bucket)
          .filter(([, v]) => v.count > 0)
          .map(([name, v]) => ({ name, avgPointsLost: v.total / v.count }))
          .sort((a, b) => a.avgPointsLost - b.avgPointsLost);

        setOsaWinner(
          ranked[0] ? { name: ranked[0].name, avgPointsLost: ranked[0].avgPointsLost } : { name: "No data", avgPointsLost: null }
        );
      } catch (e: any) {
        setOsaHighlightError(e?.message || "Could not load OSA highlight");
        setOsaWinner(null);
      }
    };

    loadBestOsaPerformer();
  }, []);

  useEffect(() => {
    const loadCostHighlights = async () => {
      try {
        setCostHighlightError(null);

        const now = new Date();
        const day = now.getDay();
        const mondayOffset = day === 0 ? 6 : day - 1;

        const weekStartLocal = new Date(now);
        weekStartLocal.setDate(now.getDate() - mondayOffset);
        weekStartLocal.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStartLocal);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const weekStartStr = weekStartLocal.toISOString().slice(0, 10);
        const weekEndStr = weekEnd.toISOString().slice(0, 10);

        const { data, error: queryError } = await supabase
          .from("cost_control_entries")
          .select("store, shift_date, sales_gbp, labour_cost_gbp, ideal_food_cost_gbp, actual_food_cost_gbp")
          .gte("shift_date", weekStartStr)
          .lt("shift_date", weekEndStr);

        if (queryError) throw queryError;

        const bucket: Record<string, { sales: number; labour: number; idealFood: number; actualFood: number }> = {};

        for (const row of (data || []) as CostControlRow[]) {
          const name = (row.store || "").trim() || "Unknown";
          if (!bucket[name]) bucket[name] = { sales: 0, labour: 0, idealFood: 0, actualFood: 0 };

          const sales = Number(row.sales_gbp);
          const labour = Number(row.labour_cost_gbp);
          const idealFood = Number(row.ideal_food_cost_gbp);
          const actualFood = Number(row.actual_food_cost_gbp);

          if (Number.isFinite(sales)) bucket[name].sales += sales;
          if (Number.isFinite(labour)) bucket[name].labour += labour;
          if (Number.isFinite(idealFood)) bucket[name].idealFood += idealFood;
          if (Number.isFinite(actualFood)) bucket[name].actualFood += actualFood;
        }

        const ranked = Object.entries(bucket).map(([name, totals]) => {
          const foodVarPctSales = totals.sales > 0 ? (totals.actualFood - totals.idealFood) / totals.sales : null;

          return {
            name,
            sumSales: totals.sales,
            foodVarPctSales,
            foodVarDelta: foodVarPctSales == null ? Number.POSITIVE_INFINITY : Math.abs(foodVarPctSales),
          };
        });

        const foodRanked = [...ranked].sort((a, b) => {
          if (a.foodVarDelta !== b.foodVarDelta) return a.foodVarDelta - b.foodVarDelta;
          return b.sumSales - a.sumSales;
        });

        setCostWinner({
          foodName: foodRanked[0]?.name || "No data",
          foodVarPctSales: foodRanked[0]?.foodVarPctSales ?? null,
        });
      } catch (e: any) {
        setCostHighlightError(e?.message || "Could not load cost highlights");
        setCostWinner(null);
      }
    };

    loadCostHighlights();
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

  const sdlwServiceByStore = useMemo(() => {
    const m = new Map<string, ServiceShiftRow[]>();
    for (const row of sdlwServiceRows) m.set(row.store, [...(m.get(row.store) || []), row]);
    return m;
  }, [sdlwServiceRows]);

  const sdlwCostRatiosByStore = useMemo(() => {
    const { byStore } = accumulateCostTotals(sdlwCostRows);
    const m = new Map<string, { labourPct01: number | null; foodVarPct01: number | null }>();
    for (const [store, totals] of Object.entries(byStore)) m.set(store, totalsToRatios(totals));
    return m;
  }, [sdlwCostRows]);

  const storeCards = useMemo(() => {
    return stores.map((store) => {
      const cost = costRows.filter((row) => row.store === store);
      const service = serviceRows.filter((row) => row.store === store);
      const sdlwService = sdlwServiceByStore.get(store) || [];
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

      const sdlwDotPct01 = avg(sdlwService.map((row) => normalisePct01(row.dot_pct)).filter((v): v is number => v != null));
      const sdlwExtremesPct01 = avg(sdlwService.map((row) => normalisePct01(row.extreme_over_40)).filter((v): v is number => v != null));
      const sdlwRnlMinutes = avg(sdlwService.map((row) => row.rnl_minutes).filter((v): v is number => v != null));
      const sdlwCostRatios = sdlwCostRatiosByStore.get(store) || { labourPct01: null, foodVarPct01: null };

      const targets = getTargetsForStore(store, inputs);

      const missedCalls01 = to01From100(inputs?.missed_calls_wtd ?? null);
      const gps01 = to01From100(inputs?.gps_tracked_wtd ?? null);
      const aof01 = to01From100(inputs?.aof_wtd ?? null);

      return {
        store,
        additionalHours,
        cost: { labourPct01, foodVarPct01 },
        service: { dotPct01, extremesPct01, rnlMinutes },
        sdlw: {
          dotPct01: sdlwDotPct01,
          labourPct01: sdlwCostRatios.labourPct01,
          rnlMinutes: sdlwRnlMinutes,
          extremesPct01: sdlwExtremesPct01,
          foodVarPct01: sdlwCostRatios.foodVarPct01,
        },
        inputs,
        tasks: storeTasks,
        targets,
        osaWtdCount: osaCounts.byStore.get(store) || 0,
        daily: { missedCalls01, gps01, aof01 },
      };
    });
  }, [
    stores,
    costRows,
    serviceRows,
    sdlwServiceByStore,
    sdlwCostRatiosByStore,
    inputsByStore,
    tasksByStore,
    osaCounts.byStore,
  ]);

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

  const areaOsaAvgPointsLostWtd = useMemo(() => {
    const points = osaRows.map((r) => r.points_lost).filter((v): v is number => v != null && Number.isFinite(v));
    return avg(points);
  }, [osaRows]);

  const keySignals = useMemo(() => {
    const signalPriority: Record<SignalCategory, number> = {
      OSA: 1,
      Labour: 2,
      Food: 3,
      Service: 4,
    };

    const preferredOrder = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"];
    const orderedStores = preferredOrder.filter((store) => stores.includes(store));

    const storeSignals = orderedStores.map((store) => {
      const card = storeCards.find((c) => c.store === store);
      if (!card) return { store, label: "Service" as SignalCategory, status: "na" as MetricStatus };

      const dotStatus = statusHigherBetter(card.service.dotPct01, card.targets.dotMin01);
      const extremesStatus = statusLowerBetter(card.service.extremesPct01, card.targets.extremesMax01);
      const rnlStatus = statusLowerBetter(card.service.rnlMinutes, card.targets.rnlMaxMins, 0.1);
      const foodStatus = statusAbsLowerBetter(card.cost.foodVarPct01, card.targets.foodVarAbsMax01);
      const labourStatus = statusLowerBetter(card.cost.labourPct01, card.targets.labourMax01);
      const addHoursStatus: MetricStatus =
        card.additionalHours == null || !Number.isFinite(card.additionalHours)
          ? "na"
          : card.additionalHours <= 0
            ? "good"
            : card.additionalHours <= 1
              ? "ok"
              : "bad";
      const osaStatus: MetricStatus = card.osaWtdCount <= 0 ? "good" : card.osaWtdCount <= 1 ? "ok" : "bad";

      if (extremesStatus === "bad" || rnlStatus === "bad" || dotStatus === "bad") {
        return { store, label: "Service" as SignalCategory, status: "bad" as MetricStatus };
      }
      if (foodStatus === "bad") return { store, label: "Food" as SignalCategory, status: "bad" as MetricStatus };
      if (labourStatus === "bad" || addHoursStatus === "bad") {
        return { store, label: "Labour" as SignalCategory, status: "bad" as MetricStatus };
      }
      if (osaStatus === "bad") return { store, label: "OSA" as SignalCategory, status: "bad" as MetricStatus };
      return { store, label: "Service" as SignalCategory, status: "na" as MetricStatus };
    });

    const areaSignal =
      [...storeSignals].sort((a, b) => signalPriority[b.label] - signalPriority[a.label])[0] ||
      ({ store: "Area", label: "Service", status: "na" } as const);

    return { areaSignal, storeSignals };
  }, [storeCards, stores]);

  const topManager = useMemo(() => {
    const rankedManagers = computeRanked(svcRows, "manager");
    return rankedManagers[0] || null;
  }, [svcRows]);


  const rankedStoreCards = useMemo(() => {
    return [...storeCards].sort((a, b) => {
      const aDot = a.service.dotPct01 ?? -1;
      const bDot = b.service.dotPct01 ?? -1;
      if (bDot !== aDot) return bDot - aDot;
      const aLab = a.cost.labourPct01 ?? Number.POSITIVE_INFINITY;
      const bLab = b.cost.labourPct01 ?? Number.POSITIVE_INFINITY;
      return aLab - bLab;
    });
  }, [storeCards]);

  const bestShiftSnapshot = useMemo(() => {
    const ranked = [...storeCards].sort((a, b) => {
      const aFoodAbs = a.cost.foodVarPct01 == null ? Number.POSITIVE_INFINITY : Math.abs(a.cost.foodVarPct01);
      const bFoodAbs = b.cost.foodVarPct01 == null ? Number.POSITIVE_INFINITY : Math.abs(b.cost.foodVarPct01);
      const comparisons: Array<[number, number, boolean]> = [
        [a.service.dotPct01 ?? -1, b.service.dotPct01 ?? -1, true],
        [a.cost.labourPct01 ?? Number.POSITIVE_INFINITY, b.cost.labourPct01 ?? Number.POSITIVE_INFINITY, false],
        [aFoodAbs, bFoodAbs, false],
        [a.service.rnlMinutes ?? Number.POSITIVE_INFINITY, b.service.rnlMinutes ?? Number.POSITIVE_INFINITY, false],
        [a.service.extremesPct01 ?? Number.POSITIVE_INFINITY, b.service.extremesPct01 ?? Number.POSITIVE_INFINITY, false],
      ];
      for (const [av, bv, higherBetter] of comparisons) {
        if (av !== bv) return higherBetter ? bv - av : av - bv;
      }
      return a.store.localeCompare(b.store);
    });
    return ranked[0] || null;
  }, [storeCards]);

  const toggleTask = async (task: TaskRow) => {
    const willComplete = !task.is_complete;
    const completedAt = willComplete ? new Date().toISOString() : null;

    setTasks((prev) =>
      prev.map((row) => (row.id === task.id ? { ...row, is_complete: willComplete, completed_at: completedAt } : row))
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
    areaOsaAvgPointsLostWtd == null || !Number.isFinite(areaOsaAvgPointsLostWtd)
      ? "na"
      : areaOsaAvgPointsLostWtd <= 15
        ? "good"
        : areaOsaAvgPointsLostWtd <= 20
          ? "ok"
          : "bad";

  // Slack text (still generated, but not displayed)
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
    lines.push(`• Add. hours: ${statusEmoji(areaAddHoursStatus)} ${fmtNum2(areaRollup.additionalHours)} (actual vs rota)`);
    lines.push(`• OSA Avg Points Lost WTD: ${statusEmoji(areaOsaStatus)} ${fmtNum1(areaOsaAvgPointsLostWtd)}`);
    lines.push("");

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
      if (openTasks.length) {
        lines.push(`   _Open tasks (${openTasks.length}):_ ${openTasks.map((t) => t.task).join(" • ")}`);
      }
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
    areaOsaAvgPointsLostWtd,
    storeCards,
  ]);

  const copyForSlack = async () => {
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
    <main className={`wrap ${exportMode ? "exportMode" : ""}`}>
      <div className={`banner ${exportMode ? "" : "print-hidden"}`}>
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <div className="shell">
        {!exportMode ? (<div className="topbar print-hidden">
          <button className="navbtn" onClick={() => router.back()} type="button">
            ← Back
          </button>

          <div className="topbar-spacer" />

          <button className="navbtn" onClick={copyForSlack} type="button" title="Copies a Slack-formatted summary">
            {copyState === "copied" ? "✅ Copied" : copyState === "error" ? "⚠️ Copy failed" : "📋 Copy for Slack"}
          </button>

          <button
            className="navbtn"
            onClick={() => setShowDetails((v) => !v)}
            type="button"
            title="Toggle details (targets, notes, tasks)"
          >
            {showDetails ? "🧾 Hide details" : "🧾 Show details"}
          </button>

          <button className="navbtn solid" onClick={() => router.push("/")} type="button">
            🏠 Home
          </button>

          <button
            className="navbtn solid"
            onClick={() => window.open("/dashboard/daily-update/export", "_blank", "noopener,noreferrer")}
            type="button"
          >
            📄 Export PDF
          </button>
        </div>) : null}

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

          <div className="areaOverview">
            <span className="areaOverviewLabel">Area Overview</span>
            <div className="kpi-mini">
              <span className="kpi-chip">
                <b>OSA Avg Points Lost WTD</b>{" "}
                <span className={pillClassFromStatus(areaOsaStatus)} style={{ minWidth: 54 }}>
                  {fmtNum1(areaOsaAvgPointsLostWtd)}
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
          </div>
        </header>

        {error ? (
          <div className="alert">
            <b>Error:</b> {error}
          </div>
        ) : loading ? (
          <div className="alert muted">Loading daily update…</div>
        ) : null}

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

        {!loading && !error ? (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>Key Signals</h2>
                <p>Compact risk summary.</p>
              </div>
            </div>
            <div className="signalsCompact">
              <p className="signalsLine subtitle">
                Area Signal: <span className={pillClassFromStatus(keySignals.areaSignal.status)}>{keySignals.areaSignal.label}</span>
              </p>
              <p className="signalsLine subtitle signalsStoresLine">
                Stores:
                {keySignals.storeSignals.map((signal, index) => (
                  <React.Fragment key={signal.store}>
                    {index > 0 ? <span className="signalsSeparator">•</span> : null}
                    <span className="signalsStoreName">{signal.store}</span>
                    <span className={pillClassFromStatus(signal.status)}>{signal.label}</span>
                  </React.Fragment>
                ))}
              </p>
            </div>
          </section>
        ) : null}

        {!loading && !error ? (
          <section className="section highlights">
            <div className="highlights-head">
              <h2>Highlights</h2>
              <p></p>
            </div>

            {highlightsError && (
              <div className="highlight-card warning" style={{ marginBottom: 12 }}>
                <div className="highlight-top">
                  <span className="highlight-title">⚠️ Highlights</span>
                </div>
                <div className="highlight-body">Could not load highlights: {highlightsError}</div>
              </div>
            )}

            <div className="highlights-grid">
              <div className="highlight-card">
                <div className="highlight-top">
                  <span className="highlight-title">🥇 Top Manager </span>
                  <span className="highlight-pill">WTD</span>
                </div>
                <div className="highlight-main">
                  <div className="highlight-name">{topManager && !highlightsError ? topManager.name : "No data"}</div>
                  <div className="highlight-metrics">
                    <span>
                      DOT: <b>{topManager && !highlightsError ? formatPct(topManager.avgDOT, 0) : "—"}</b>
                    </span>
                    <span>
                      Labour: <b>{topManager && !highlightsError ? formatPct(topManager.avgLabour, 1) : "—"}</b>
                    </span>
                    <span>
                      Shifts: <b>{topManager && !highlightsError ? topManager.shifts : "—"}</b>
                    </span>
                  </div>
                </div>
              </div>

              <div className={`highlight-card${osaHighlightError ? " warning" : ""}`}>
                <div className="highlight-top">
                  <span className="highlight-title">🛡️ Best OSA Performance </span>
                  <span className="highlight-pill">WTD</span>
                </div>
                <div className="highlight-main">
                  <div className="highlight-name">{osaHighlightError ? "Error" : osaWinner?.name || "No data"}</div>
                  <div className="highlight-metrics">
                    {osaHighlightError ? (
                      <span>
                        Could not load OSA highlight: <b>{osaHighlightError}</b>
                      </span>
                    ) : (
                      <span>
                        Avg points lost: <b>{formatAvgPointsLost(osaWinner?.avgPointsLost ?? null)}</b>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={`highlight-card${costHighlightError ? " warning" : ""}`}>
                <div className="highlight-top">
                  <span className="highlight-title">🍕 Top Store Food </span>
                  <span className="highlight-pill">WTD</span>
                </div>
                <div className="highlight-main">
                  <div className="highlight-name">{costHighlightError ? "Error" : costWinner?.foodName || "No data"}</div>
                  <div className="highlight-metrics">
                    {costHighlightError ? (
                      <span>
                        Could not load food highlight: <b>{costHighlightError}</b>
                      </span>
                    ) : (
                      <span>
                        Variance: <b>{formatPct(costWinner?.foodVarPctSales ?? null, 2)}</b>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!loading && !error && bestShiftSnapshot ? (
          <section className="section bestSnapshot">
            <div className="section-head">
              <div>
                <h2>Best Shift Snapshot (Yesterday)</h2>
                <p>{bestShiftSnapshot.store}</p>
              </div>
            </div>
            <div className="snapshotPills">
              <span className="pill">DOT {fmtPct2(bestShiftSnapshot.service.dotPct01)}</span>
              <span className="pill">Labour {fmtPct2(bestShiftSnapshot.cost.labourPct01)}</span>
              <span className="pill">Food Var {fmtPct2(bestShiftSnapshot.cost.foodVarPct01)}</span>
              <span className="pill">R&L {fmtMins2(bestShiftSnapshot.service.rnlMinutes)}</span>
              <span className="pill">Extremes {fmtPct2(bestShiftSnapshot.service.extremesPct01)}</span>
            </div>
          </section>
        ) : null}

        {/* Store cards */}
        {!loading && !error ? (
          <section className={`section ${exportMode ? "storeSection" : ""}`}>
            <div className="section-head">
              <div>
                <h2>Stores</h2>
                <p></p>
              </div>
              <div className="kpi-mini">
                <span className="kpi-chip">
                  <b>{stores.length}</b> stores
                </span>
              </div>
            </div>

            <div className="storeGrid">
              {rankedStoreCards.map((card) => {
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

                  const osaStatus: MetricStatus = card.osaWtdCount <= 0 ? "good" : card.osaWtdCount <= 1 ? "ok" : "bad";

                  return (
                    <article key={card.store} className="storeCard">
                      <div className="storeTop">
                        <div className="storeTitleRow">
                          <div className="storeName">{card.store}</div>
                          <div className="storePills">
                            <span className="storeChip">
                              <span className="storeChipLabel">OSA WTD</span>
                              <span className={pillClassFromStatus(osaStatus)} style={{ minWidth: 52 }}>
                                {card.osaWtdCount}
                              </span>
                            </span>

                            {/* Keep AOF visible without bloating the grid */}
                            <span className="storeChip">
                              <span className="storeChipLabel">AOF (WTD)</span>
                              <span className={pillClassFromStatus(aofStatus)} style={{ minWidth: 84 }}>
                                {fmtPct2(card.daily.aof01)}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Service-dashboard style: 2 columns x 3 rows */}
                      <div className="rowHint">Daily snapshot</div>
                      <div className="metricsList">
                        {/* Column/row order chosen to read cleanly in screenshots */}
                        <div className="metricRow">
                          <div className="rowText">
                            <div className="rowLabel">DOT (Daily)</div>
                            <div className="rowHint">≥ {(card.targets.dotMin01 * 100).toFixed(0)}%</div>
                          </div>
                          <div className="metricValueWrap">
                          <span className={pillClassFromStatus(dotStatus)}>{fmtPct2(card.service.dotPct01)}</span>
                          <div className="sdlwLine">{buildSdlwLine(card.service.dotPct01, card.sdlw.dotPct01, "pct")}</div>
                        </div>
                        </div>

                        <div className="metricRow">
                          <div className="rowText">
                            <div className="rowLabel">Labour (Daily)</div>
                            <div className="rowHint">≤ {(card.targets.labourMax01 * 100).toFixed(0)}%</div>
                          </div>
                          <div className="metricValueWrap">
                          <span className={pillClassFromStatus(labourStatus)}>{fmtPct2(card.cost.labourPct01)}</span>
                          <div className="sdlwLine">{buildSdlwLine(card.cost.labourPct01, card.sdlw.labourPct01, "pct")}</div>
                        </div>
                        </div>

                        <div className="metricRow">
                          <div className="rowText">
                            <div className="rowLabel">R&amp;L (Daily)</div>
                            <div className="rowHint">≤ {card.targets.rnlMaxMins.toFixed(0)}m</div>
                          </div>
                          <div className="metricValueWrap">
                          <span className={pillClassFromStatus(rnlStatus)}>{fmtMins2(card.service.rnlMinutes)}</span>
                          <div className="sdlwLine">{buildSdlwLine(card.service.rnlMinutes, card.sdlw.rnlMinutes, "mins")}</div>
                        </div>
                        </div>

                        <div className="metricRow">
                          <div className="rowText">
                            <div className="rowLabel">Extremes &gt;40 (Daily)</div>
                            <div className="rowHint">≤ {(card.targets.extremesMax01 * 100).toFixed(0)}%</div>
                          </div>
                          <div className="metricValueWrap">
                          <span className={pillClassFromStatus(extremesStatus)}>{fmtPct2(card.service.extremesPct01)}</span>
                          <div className="sdlwLine">{buildSdlwLine(card.service.extremesPct01, card.sdlw.extremesPct01, "pct")}</div>
                        </div>
                        </div>

                        <div className="metricRow">
                          <div className="rowText">
                            <div className="rowLabel">Additional hours (Daily)</div>
                            <div className="rowHint">Actual vs rota</div>
                          </div>
                          <span className={pillClassFromStatus(addHoursStatus)}>{fmtNum2(card.additionalHours)}</span>
                        </div>

                        <div className="metricRow">
                          <div className="rowText">
                            <div className="rowLabel">Food variance (Daily)</div>
                            <div className="rowHint">Abs ≤ {(card.targets.foodVarAbsMax01 * 100).toFixed(2)}%</div>
                          </div>
                          <div className="metricValueWrap">
                          <span className={pillClassFromStatus(foodVarStatus)}>{fmtPct2(card.cost.foodVarPct01)}</span>
                          <div className="sdlwLine">{buildSdlwLine(card.cost.foodVarPct01, card.sdlw.foodVarPct01, "pct")}</div>
                        </div>
                        </div>
                      </div>

                      {/* Compact “inputs” row (optional – keeps screenshot clean) */}
                      <div className="rowHint">WTD inputs</div>
                      <div className="inputsRow">
                        <div className="inputChip">
                          <span className="inputLabel">Missed calls (WTD)</span>
                          <span className={pillClassFromStatus(missedStatus)}>{fmtPct2(card.daily.missedCalls01)}</span>
                        </div>
                        <div className="inputChip">
                          <span className="inputLabel">GPS tracked (WTD)</span>
                          <span className={pillClassFromStatus(gpsStatus)}>{fmtPct2(card.daily.gps01)}</span>
                        </div>
                      </div>

                      {/* Details: hidden by default for screenshot parity with Service Dashboard */}
                      <div className={`details ${showDetails ? "show" : ""}`}>
                        <div className="detailsGrid">
                          <div className="panel">
                            <div className="panelHead">
                              <div className="panelTitle">Service losing targets</div>
                              <div className="panelHint">Daily targets to hit or beat</div>
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
                                      <input type="checkbox" checked={task.is_complete} onChange={() => toggleTask(task)} />
                                      <span className={task.is_complete ? "taskDone" : ""}>{task.task}</span>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
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

        .topbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
          flex-wrap: wrap;
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
          white-space: nowrap;
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

        .areaOverview {
          margin-top: 12px;
          display: inline-flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
        }

        .areaOverviewLabel {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.06);
          border: 1px solid rgba(15, 23, 42, 0.1);
          color: #0f172a;
          white-space: nowrap;
        }

        .kpi-mini {
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

        .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 72px;
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(2, 6, 23, 0.04);
          color: rgba(15, 23, 42, 0.8);
          white-space: nowrap;
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

        .highlights {
          margin-top: 16px;
          text-align: left;
        }

        .highlights-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }

        .highlights-head h2 {
          font-size: 15px;
          font-weight: 900;
          margin: 0;
          color: #0f172a;
        }

        .highlights-head p {
          margin: 0;
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
        }

        .highlights-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .highlight-card {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 16px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          padding: 12px 14px;
        }

        .highlight-card.warning {
          border-color: rgba(239, 68, 68, 0.22);
          background: rgba(254, 242, 242, 0.85);
        }

        .highlight-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .highlight-title {
          font-size: 12px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .highlight-pill {
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.1);
          border: 1px solid rgba(0, 100, 145, 0.16);
          color: #004b75;
          white-space: nowrap;
        }

        .highlight-main {
          min-width: 0;
        }

        .highlight-name {
          font-size: 16px;
          font-weight: 900;
          color: #0f172a;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .highlight-metrics {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 13px;
          color: #334155;
          font-weight: 700;
        }

        .highlight-body {
          font-size: 13px;
          color: #334155;
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
          margin-bottom: 10px;
        }

        .storeTitleRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .storeName {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: -0.01em;
        }

        .storePills {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
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

        /* 2 columns x 3 rows (6 rows total) like Service Dashboard */
        .metricsList {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .metricRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(248, 250, 252, 0.7);
          padding: 10px 10px;
        }

        .rowText {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .rowLabel {
          font-size: 12px;
          font-weight: 900;
          color: rgba(15, 23, 42, 0.86);
          letter-spacing: 0.01em;
        }

        .rowHint {
          font-size: 12px;
          font-weight: 800;
          color: rgba(100, 116, 139, 0.98);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .metricValueWrap {
          display: grid;
          justify-items: end;
          gap: 2px;
        }

        .sdlwLine {
          font-size: 11px;
          font-weight: 800;
          color: rgba(100, 116, 139, 0.95);
          line-height: 1.15;
        }

        .bridgeGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .bridgeCard {
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(248, 250, 252, 0.8);
          padding: 10px;
        }

        .bridgeTitle { font-weight: 900; margin-bottom: 8px; }
        .bridgeCols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .bridgeColTitle { font-size: 11px; font-weight: 900; text-transform: uppercase; color: rgba(100,116,139,0.95); margin-bottom: 6px; }
        .bridgePills { display: grid; gap: 6px; }
        .snapshotPills { display: flex; flex-wrap: wrap; gap: 8px; }

        .inputsRow {
          margin-top: 10px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .inputChip {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.85);
          padding: 10px 10px;
        }

        .inputLabel {
          font-size: 12px;
          font-weight: 900;
          color: rgba(15, 23, 42, 0.78);
          letter-spacing: 0.01em;
        }

        .details {
          display: none;
          margin-top: 10px;
        }

        .details.show {
          display: block;
        }

        .detailsGrid {
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


        .signalsCompact {
          display: grid;
          gap: 6px;
        }

        .signalsLine {
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .signalsStoresLine {
          gap: 6px;
        }

        .signalsStoreName {
          font-weight: 800;
          color: rgba(15, 23, 42, 0.82);
          margin-left: 4px;
        }

        .signalsSeparator {
          color: rgba(100, 116, 139, 0.95);
          font-weight: 900;
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
          .highlights-grid {
            grid-template-columns: 1fr;
          }
          .kvGrid {
            grid-template-columns: 1fr;
          }
          .metricsList {
            grid-template-columns: 1fr;
          }
          .inputsRow {
            grid-template-columns: 1fr;
          }
          .bridgeGrid,
          .bridgeCols {
            grid-template-columns: 1fr;
          }
          .storePills {
            justify-content: flex-start;
          }
        }

        @media print {
          .print-hidden,
          .exportMode .topbar {
            display: none !important;
          }
          .wrap:not(.exportMode) .banner {
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
          .metricRow,
          .inputChip {
            box-shadow: none !important;
            break-inside: avoid;
          }
          .exportMode .storeSection {
            page-break-before: always;
          }
          .exportMode .storeGrid {
            grid-template-columns: 1fr !important;
          }
          .storeCard {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .exportMode .storeCard:nth-child(2n + 1) {
            page-break-before: always;
          }
          .exportMode .storeCard:first-child {
            page-break-before: auto;
          }
          .exportMode,
          .exportMode * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Print should include details even if hidden on screen */
          .details {
            display: block !important;
          }
        }
      `}</style>
    </main>
  );
}
