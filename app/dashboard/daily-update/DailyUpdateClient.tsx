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

const fmtPct2 = (v01: number | null) => (v01 == null ? "—" : `${(v01 * 100).toFixed(2)}%`);
const fmtNum2 = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${Number(v).toFixed(2)}`);
const fmtMins2 = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${Number(v).toFixed(2)}m`);

const avg = (arr: number[]) => (arr.length ? arr.reduce((acc, val) => acc + val, 0) / arr.length : null);
const sum = (arr: number[]) => arr.reduce((acc, val) => acc + val, 0);

type Targets = {
  dotMin01: number;
  labourMax01: number;
  rnlMaxMins: number;
  extremesMax01: number;
  foodVarAbsMax01: number;
};

const DEFAULT_TARGETS: Record<string, Targets> = {
  Downpatrick: { dotMin01: 0.82, labourMax01: 0.25, rnlMaxMins: 9, extremesMax01: 0.03, foodVarAbsMax01: 0.003 },
  Kilkeel: { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 8, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
  Newcastle: { dotMin01: 0.78, labourMax01: 0.25, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
  Ballynahinch: { dotMin01: 0.78, labourMax01: 0.28, rnlMaxMins: 9, extremesMax01: 0.04, foodVarAbsMax01: 0.003 },
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
          supabase
            .from("cost_control_entries")
            .select("store,shift_date")
            .order("shift_date", { ascending: false })
            .limit(500),
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

      const dotPct01 = avg(service.map((row) => normalisePct01(row.dot_pct)).filter((v): v is number => v != null));
      const extremesPct01 = avg(
        service.map((row) => normalisePct01(row.extreme_over_40)).filter((v): v is number => v != null)
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

  const StatusDot = ({ status }: { status: MetricStatus }) => (
    <span className={`dot dot-${status}`} aria-hidden="true" />
  );

  const StatTile = (props: { label: string; valueText: string; status: MetricStatus }) => (
    <div className={`tile tile-${props.status}`}>
      <div className="tileHead">
        <div className="tileLabel">{props.label}</div>
        <StatusDot status={props.status} />
      </div>
      <div className="tileValue">{props.valueText}</div>
    </div>
  );

  const Card = (props: { title: string; icon?: string; tone?: "slate" | "blue" | "purple"; children: React.ReactNode }) => {
    return (
      <section className={`card tone-${props.tone || "slate"}`}>
        <header className="cardHead">
          <div className="cardTitleRow">
            {props.icon ? <span className="cardIcon" aria-hidden="true">{props.icon}</span> : null}
            <h3 className="cardTitle">{props.title}</h3>
          </div>
        </header>
        <div className="cardBody">{props.children}</div>
      </section>
    );
  };

  const AreaKpi = (props: { icon: string; label: string; value: string }) => (
    <div className="areaKpi">
      <div className="areaKpiTop">
        <span className="areaKpiIcon" aria-hidden="true">{props.icon}</span>
        <span className="areaKpiLabel">{props.label}</span>
      </div>
      <div className="areaKpiValue">{props.value}</div>
    </div>
  );

  return (
    <main className="page">
      <div className="banner">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <div className="container">
        {/* OSA-like top actions */}
        <div className="actions print-hidden">
          <button className="btn" type="button" onClick={() => router.back()}>
            ← Back
          </button>
          <div className="spacer" />
          <button className="btn" type="button" onClick={() => router.push("/")}>
            🏠 Home
          </button>
          <button className="btn btnSolid" type="button" onClick={() => window.print()}>
            📄 Export PDF
          </button>
        </div>

        {/* Hub-style header block */}
        <header className="hubHeader">
          <h1>Mourne-oids Hub</h1>
          <p className="hubTagline">“Climbing New Peaks, One Shift at a Time.” ⛰️</p>
          <div className="hubMeta">
            <span className="metaPill">Daily Update</span>
            <span className="metaText">Previous business day: <strong>{targetDate || "Loading…"}</strong></span>
            {weekStart ? <span className="metaText">WTD from <strong>{weekStart}</strong></span> : null}
          </div>
        </header>

        {/* Area overview */}
        <section className="area">
          <div className="areaGrid">
            <AreaKpi icon="🧑‍🤝‍🧑" label="Area Labour" value={fmtPct2(areaRollup.labourPct01)} />
            <AreaKpi icon="🍕" label="Area Food" value={fmtPct2(areaRollup.foodVarPct01)} />
            <AreaKpi icon="⏱️" label="Area Add. Hours" value={fmtNum2(areaRollup.additionalHours)} />
            <AreaKpi icon="✅" label="Area OSA" value={String(osaCounts.total)} />
          </div>

          <div className="osaRow">
            <div className="osaLabel">OSA breakdown</div>
            <div className="osaChips">
              {stores.map((store) => (
                <span key={store} className="chip">
                  {store}: <strong>{String(osaCounts.byStore.get(store) || 0)}</strong>
                </span>
              ))}
              {!stores.length && <span className="chip">No stores loaded</span>}
            </div>
          </div>
        </section>

        {areaMessage ? (
          <section className="notice">
            <div className="noticeHead">
              <h2>Area Message</h2>
              <span className="pill">Action focus</span>
            </div>
            <p>{areaMessage}</p>
          </section>
        ) : null}

        {loading && <div className="state">Loading daily update…</div>}
        {error && <div className="state stateError">Error: {error}</div>}

        {!loading && !error ? (
          <section className="stores">
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
                <article key={card.store} className="store">
                  <div className="storeTop">
                    <div className="storeTitle">
                      <h2>{card.store}</h2>
                      <div className="storeBadges">
                        <span className="badge badgePurple">OSA WTD: {card.osaWtdCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="modules">
                    <div className="moduleSpan2">
                      <Card title="Service" icon="🚗" tone="slate">
                        <div className="tiles2x2">
                          <StatTile label="DOT" valueText={fmtPct2(card.service.dotPct01)} status={dotStatus} />
                          <StatTile label="R&L" valueText={fmtMins2(card.service.rnlMinutes)} status={rnlStatus} />
                          <StatTile label="Extremes >40" valueText={fmtPct2(card.service.extremesPct01)} status={extremesStatus} />
                          <StatTile label="Add. Hours" valueText={fmtNum2(card.additionalHours)} status={addHoursStatus} />
                        </div>
                      </Card>
                    </div>

                    <Card title="Cost Controls" icon="💷" tone="blue">
                      <div className="tiles1col">
                        <StatTile label="Labour" valueText={fmtPct2(card.cost.labourPct01)} status={labourStatus} />
                        <StatTile label="Food" valueText={fmtPct2(card.cost.foodVarPct01)} status={foodVarStatus} />
                      </div>
                    </Card>

                    <Card title="Others WTD" icon="🧾" tone="purple">
                      <div className="tiles1col">
                        <StatTile label="Missed Calls" valueText={fmtPct2(card.daily.missedCalls01)} status={missedStatus} />
                        <StatTile label="GPS Tracked" valueText={fmtPct2(card.daily.gps01)} status={gpsStatus} />
                        <StatTile label="AOF" valueText={fmtPct2(card.daily.aof01)} status={aofStatus} />
                      </div>
                    </Card>
                  </div>

                  <section className="subCard">
                    <div className="subHead">
                      <h3>Notes</h3>
                      <span className="pill pillSlate">From store</span>
                    </div>
                    <p className="subText">{card.inputs?.notes?.trim() || "—"}</p>
                  </section>

                  <section className="subCard">
                    <div className="subHead">
                      <h3>Service Losing Targets</h3>
                      <span className="pill pillSlate">Input</span>
                    </div>
                    <div className="targets">
                      <div className="kv"><span>Load (mins)</span><strong>{fmtNum2(card.inputs?.target_load_time_mins ?? null)}</strong></div>
                      <div className="kv"><span>Rack (mins)</span><strong>{fmtNum2(card.inputs?.target_rack_time_mins ?? null)}</strong></div>
                      <div className="kv"><span>ADT (mins)</span><strong>{fmtNum2(card.inputs?.target_adt_mins ?? null)}</strong></div>
                      <div className="kv">
                        <span>Extremes %</span>
                        <strong>
                          {card.inputs?.target_extremes_over40_pct == null
                            ? "—"
                            : `${Number(card.inputs.target_extremes_over40_pct).toFixed(2)}%`}
                        </strong>
                      </div>
                    </div>
                  </section>

                  <section className="subCard">
                    <div className="subHead">
                      <h3>Tasks</h3>
                      <span className="pill pillPurple">To action</span>
                    </div>

                    {card.tasks.length === 0 ? (
                      <p className="muted">No tasks for this store on {targetDate}.</p>
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
                  </section>
                </article>
              );
            })}
          </section>
        ) : null}

        <footer className="footer">
          © {new Date().getFullYear()} Mourne-oids | Domino’s Pizza | Racz Group
        </footer>
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
          --blue: #006491;
          --purple: #7c3aed;
          --radius: 18px;
        }

        .page {
          min-height: 100dvh;
          background:
            radial-gradient(900px 420px at 50% 0%, rgba(0, 100, 145, 0.10), transparent 60%),
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
          margin: 16px auto 0;
        }

        .actions {
          display: flex;
          gap: 10px;
          align-items: center;
          margin: 10px 0 12px;
        }
        .spacer { flex: 1; }

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
        .btn:hover { transform: translateY(-1px); }
        .btnSolid {
          border-color: rgba(0, 100, 145, 0.20);
          background: linear-gradient(180deg, rgba(0, 100, 145, 0.95), rgba(0, 100, 145, 0.85));
          color: #fff;
        }

        .hubHeader {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          padding: 14px 16px;
        }
        .hubHeader h1 {
          margin: 0;
          font-size: clamp(1.6rem, 2.2vw, 2rem);
          letter-spacing: 0.2px;
        }
        .hubTagline {
          margin: 6px 0 10px;
          color: rgba(15, 23, 42, 0.78);
          font-weight: 800;
        }
        .hubMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }
        .metaPill {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(0, 100, 145, 0.18);
          background: rgba(0, 100, 145, 0.08);
          color: rgba(15, 23, 42, 0.92);
          font-weight: 950;
          font-size: 12px;
        }
        .metaText {
          color: rgba(15, 23, 42, 0.72);
          font-weight: 800;
          font-size: 13px;
        }
        .metaText strong { color: rgba(15, 23, 42, 0.92); }

        .area {
          margin-top: 12px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          padding: 12px;
        }
        .areaGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .areaKpi {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(15, 23, 42, 0.10);
          border-radius: 16px;
          padding: 10px 12px;
        }
        .areaKpiTop {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(15, 23, 42, 0.72);
        }
        .areaKpiIcon { font-size: 14px; }
        .areaKpiLabel {
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.35px;
          text-transform: uppercase;
        }
        .areaKpiValue {
          margin-top: 8px;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 0.2px;
          color: rgba(11, 79, 112, 0.95);
          font-variant-numeric: tabular-nums;
        }

        .osaRow {
          margin-top: 10px;
          border-top: 1px solid rgba(15, 23, 42, 0.07);
          padding-top: 10px;
        }
        .osaLabel {
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.35px;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.60);
          margin-bottom: 8px;
        }
        .osaChips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chip {
          border-radius: 999px;
          padding: 6px 10px;
          background: rgba(15, 23, 42, 0.05);
          border: 1px solid rgba(15, 23, 42, 0.08);
          font-size: 12px;
          font-weight: 850;
          color: rgba(15, 23, 42, 0.75);
        }

        .notice {
          margin-top: 12px;
          background: rgba(0, 100, 145, 0.08);
          border: 1px solid rgba(0, 100, 145, 0.16);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          padding: 12px 14px;
        }
        .noticeHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }
        .notice h2 { margin: 0; font-size: 15px; }
        .pill {
          font-size: 12px;
          font-weight: 950;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(0, 100, 145, 0.18);
          background: rgba(255, 255, 255, 0.55);
          color: rgba(15, 23, 42, 0.86);
          white-space: nowrap;
        }
        .notice p {
          margin: 0;
          white-space: pre-wrap;
          font-weight: 850;
          color: rgba(15, 23, 42, 0.76);
          line-height: 1.35;
        }

        .state {
          margin-top: 12px;
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

        .stores {
          margin-top: 12px;
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .store {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          padding: 12px;
        }

        .storeTop { margin-bottom: 10px; }
        .storeTitle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .storeTitle h2 {
          margin: 0;
          font-size: 18px;
          letter-spacing: 0.2px;
        }
        .storeBadges { display: flex; gap: 8px; flex-wrap: wrap; }

        .badge {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 950;
          white-space: nowrap;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(15, 23, 42, 0.05);
          color: rgba(15, 23, 42, 0.78);
        }
        .badgePurple {
          border-color: rgba(124, 58, 237, 0.18);
          background: rgba(124, 58, 237, 0.10);
          color: rgba(76, 29, 149, 0.95);
        }

        .modules {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          align-items: start;
        }
        .moduleSpan2 { grid-column: span 2; }

        .card {
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(15, 23, 42, 0.10);
          overflow: hidden;
        }
        .cardHead {
          padding: 9px 10px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }
        .tone-blue .cardHead {
          background: linear-gradient(90deg, rgba(0, 100, 145, 0.12), rgba(0, 100, 145, 0.02));
        }
        .tone-purple .cardHead {
          background: linear-gradient(90deg, rgba(124, 58, 237, 0.12), rgba(124, 58, 237, 0.02));
        }
        .tone-slate .cardHead {
          background: linear-gradient(90deg, rgba(15, 23, 42, 0.10), rgba(15, 23, 42, 0.02));
        }

        .cardTitleRow {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cardIcon { font-size: 14px; }
        .cardTitle {
          margin: 0;
          font-size: 12px;
          font-weight: 1000;
          letter-spacing: 0.35px;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.86);
        }
        .cardBody { padding: 10px; }

        .tiles2x2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .tiles1col {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .tile {
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(255, 255, 255, 0.98);
          padding: 10px 10px;
        }
        .tileHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .tileLabel {
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.35px;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.65);
        }
        .tileValue {
          margin-top: 8px;
          font-size: 20px;
          font-weight: 950;
          letter-spacing: 0.2px;
          color: rgba(15, 23, 42, 0.92);
          font-variant-numeric: tabular-nums;
        }
        .moduleSpan2 .tileValue { font-size: 22px; }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          display: inline-block;
          flex-shrink: 0;
        }
        .dot-good { background: rgba(34, 197, 94, 0.85); border-color: rgba(34, 197, 94, 0.40); }
        .dot-ok { background: rgba(245, 158, 11, 0.85); border-color: rgba(245, 158, 11, 0.40); }
        .dot-bad { background: rgba(239, 68, 68, 0.85); border-color: rgba(239, 68, 68, 0.40); }
        .dot-na { background: rgba(148, 163, 184, 0.75); border-color: rgba(148, 163, 184, 0.40); }

        /* subtle status wash (OSA-like: minimal) */
        .tile-good { background: linear-gradient(180deg, rgba(220, 252, 231, 0.25), rgba(255, 255, 255, 0.92)); }
        .tile-ok { background: linear-gradient(180deg, rgba(255, 237, 213, 0.22), rgba(255, 255, 255, 0.92)); }
        .tile-bad { background: linear-gradient(180deg, rgba(254, 226, 226, 0.22), rgba(255, 255, 255, 0.92)); }
        .tile-na { background: rgba(255, 255, 255, 0.95); }

        .subCard {
          margin-top: 10px;
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(15, 23, 42, 0.10);
          border-radius: 16px;
          padding: 10px 12px;
        }
        .subHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }
        .subHead h3 {
          margin: 0;
          font-size: 12px;
          font-weight: 1000;
          letter-spacing: 0.35px;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.70);
        }
        .pillSlate {
          border-color: rgba(15, 23, 42, 0.12);
          background: rgba(15, 23, 42, 0.05);
        }
        .pillPurple {
          border-color: rgba(124, 58, 237, 0.18);
          background: rgba(124, 58, 237, 0.10);
        }
        .subText {
          margin: 0;
          white-space: pre-wrap;
          color: rgba(15, 23, 42, 0.78);
          font-weight: 800;
          line-height: 1.35;
        }

        .targets {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .kv {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(248, 250, 252, 0.85);
          padding: 9px 10px;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.72);
          font-weight: 800;
        }
        .kv strong {
          font-variant-numeric: tabular-nums;
          font-weight: 950;
          color: rgba(15, 23, 42, 0.90);
          white-space: nowrap;
        }

        .muted {
          margin: 0;
          color: rgba(100, 116, 139, 0.95);
          font-weight: 850;
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
          align-items: center;
          gap: 10px;
          font-weight: 850;
          color: rgba(15, 23, 42, 0.80);
        }
        .taskDone {
          text-decoration: line-through;
          color: rgba(100, 116, 139, 0.95);
        }

        .footer {
          margin-top: 14px;
          text-align: center;
          color: rgba(100, 116, 139, 0.9);
          font-weight: 800;
          font-size: 12px;
        }

        @media (max-width: 980px) {
          .stores { grid-template-columns: 1fr; }
          .areaGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .modules { grid-template-columns: 1fr; }
          .moduleSpan2 { grid-column: span 1; }
          .tiles2x2 { grid-template-columns: 1fr; }
          .targets { grid-template-columns: 1fr; }
        }

        @media print {
          .print-hidden,
          .banner { display: none !important; }
          .page { background: #fff; padding: 0; }
          .container { width: 100%; margin: 0; }
          .hubHeader, .area, .notice, .store, .card, .subCard {
            box-shadow: none !important;
            break-inside: avoid;
          }
        }
      `}</style>
    </main>
  );
}
