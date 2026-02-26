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
};

type CostControlRow = {
  shift_date: string;
  store: string;
  sales_gbp: number | null;
  labour_cost_gbp: number | null;
  ideal_food_cost_gbp: number | null;
  actual_food_cost_gbp: number | null;
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

const normalisePct = (v: number | null) => {
  if (v == null || !Number.isFinite(v)) return null;
  return v > 1 ? v / 100 : v;
};

const pct0 = (v01: number | null) => (v01 == null ? "—" : `${(v01 * 100).toFixed(0)}%`);
const num0 = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${Math.round(v)}`);
const mins0 = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${Math.round(v)}m`);

const avg = (arr: number[]) =>
  arr.length ? arr.reduce((acc, val) => acc + val, 0) / arr.length : null;

const sum = (arr: number[]) => arr.reduce((acc, val) => acc + val, 0);

export default function DailyUpdatePage() {
  const router = useRouter();

  const [targetDate, setTargetDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [areaMessage, setAreaMessage] = useState<string>("");
  const [storeInputs, setStoreInputs] = useState<StoreInputRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [serviceRows, setServiceRows] = useState<ServiceShiftRow[]>([]);
  const [costRows, setCostRows] = useState<CostControlRow[]>([]);
  const [stores, setStores] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const previousBusinessDay = getPreviousBusinessDayUk();
        setTargetDate(previousBusinessDay);

        const [
          areaMessageRes,
          inputsRes,
          tasksRes,
          serviceRes,
          costRes,
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
            .select("shift_date,store,dot_pct,labour_pct,extreme_over_40,rnl_minutes")
            .eq("shift_date", previousBusinessDay),
          supabase
            .from("cost_control_entries")
            .select("shift_date,store,sales_gbp,labour_cost_gbp,ideal_food_cost_gbp,actual_food_cost_gbp")
            .eq("shift_date", previousBusinessDay),
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
    for (const row of tasks) {
      m.set(row.store, [...(m.get(row.store) || []), row]);
    }
    return m;
  }, [tasks]);

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

      const labourPct = sales > 0 ? labourCost / sales : null;
      const foodVarPct = sales > 0 ? (actualFoodCost - idealFoodCost) / sales : null;

      const dotPct = avg(service.map((row) => normalisePct(row.dot_pct)).filter((v): v is number => v != null));
      const extremesPct = avg(
        service.map((row) => normalisePct(row.extreme_over_40)).filter((v): v is number => v != null)
      );
      const rnlMinutes = avg(service.map((row) => row.rnl_minutes).filter((v): v is number => v != null));

      return {
        store,
        cost: { labourPct, foodVarPct },
        service: { dotPct, extremesPct, rnlMinutes },
        inputs,
        tasks: storeTasks,
      };
    });
  }, [stores, costRows, serviceRows, inputsByStore, tasksByStore]);

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
          <p className="subtitle">Previous business day: {targetDate || "Loading…"}</p>
        </header>

        <section className="areaStrip">
          <div className="areaKpi">
            <span className="kLabel">Area Labour</span>
            <span className="kValue">—</span>
          </div>
          <div className="areaKpi">
            <span className="kLabel">Area Food</span>
            <span className="kValue">—</span>
          </div>
          <div className="areaKpi">
            <span className="kLabel">Area Additional Hours</span>
            <span className="kValue">—</span>
          </div>
          <div className="areaKpi">
            <span className="kLabel">OSA WTD count</span>
            <span className="kValue">—</span>
          </div>
          <div className="storeOsaRow">
            {stores.map((store) => (
              <span key={store} className="chip">
                {store}: —
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
            {storeCards.map((card) => (
              <article key={card.store} className="storeCard">
                <h2 className="storeName">{card.store}</h2>

                <div className="metricGrid">
                  <div className="metricBlock">
                    <h3>Cost Controls</h3>
                    <div className="lineItem">
                      <span>Labour %</span>
                      <strong>{pct0(card.cost.labourPct)}</strong>
                    </div>
                    <div className="lineItem">
                      <span>Food variance % of sales</span>
                      <strong>{pct0(card.cost.foodVarPct)}</strong>
                    </div>
                  </div>

                  <div className="metricBlock">
                    <h3>Service</h3>
                    <div className="lineItem">
                      <span>DOT %</span>
                      <strong>{pct0(card.service.dotPct)}</strong>
                    </div>
                    <div className="lineItem">
                      <span>R&amp;L minutes</span>
                      <strong>{mins0(card.service.rnlMinutes)}</strong>
                    </div>
                    <div className="lineItem">
                      <span>Extremes &gt;40%</span>
                      <strong>{pct0(card.service.extremesPct)}</strong>
                    </div>
                  </div>

                  <div className="metricBlock">
                    <h3>OSA</h3>
                    <p className="placeholder">Summary placeholder — data to be wired later.</p>
                  </div>
                </div>

                <div className="metricGrid compact">
                  <div className="lineItem"><span>Missed Calls WTD</span><strong>{num0(card.inputs?.missed_calls_wtd ?? null)}</strong></div>
                  <div className="lineItem"><span>GPS Tracked WTD</span><strong>{num0(card.inputs?.gps_tracked_wtd ?? null)}</strong></div>
                  <div className="lineItem"><span>AOF WTD</span><strong>{num0(card.inputs?.aof_wtd ?? null)}</strong></div>
                </div>

                <section className="notes">
                  <h3>Notes</h3>
                  <p>{card.inputs?.notes?.trim() || "—"}</p>
                </section>

                <section className="targets">
                  <h3>Service Losing Targets</h3>
                  <div className="metricGrid compact">
                    <div className="lineItem"><span>Load target (mins)</span><strong>{num0(card.inputs?.target_load_time_mins ?? null)}</strong></div>
                    <div className="lineItem"><span>Rack target (mins)</span><strong>{num0(card.inputs?.target_rack_time_mins ?? null)}</strong></div>
                    <div className="lineItem"><span>ADT target (mins)</span><strong>{num0(card.inputs?.target_adt_mins ?? null)}</strong></div>
                    <div className="lineItem">
                      <span>Extremes target %</span>
                      <strong>{card.inputs?.target_extremes_over40_pct == null ? "—" : `${Math.round(card.inputs.target_extremes_over40_pct)}%`}</strong>
                    </div>
                  </div>
                </section>

                <section className="tasks">
                  <h3>Tasks</h3>
                  {card.tasks.length === 0 ? (
                    <p className="placeholder">No tasks for this store on {targetDate}.</p>
                  ) : (
                    <ul>
                      {card.tasks.map((task) => (
                        <li key={task.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={task.is_complete}
                              onChange={() => toggleTask(task)}
                            />
                            <span className={task.is_complete ? "done" : ""}>{task.task}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </article>
            ))}
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
        .topbar-spacer { flex: 1; }
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
        .subtitle { color: #64748b; font-weight: 700; margin: 4px 0 0; }
        .areaStrip {
          display: grid;
          gap: 10px;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(0, 100, 145, 0.14);
          border-radius: 16px;
          padding: 12px;
        }
        .areaKpi {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 12px;
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.9);
        }
        .kLabel { font-size: 12px; font-weight: 900; text-transform: uppercase; }
        .kValue { font-weight: 900; color: #006491; }
        .storeOsaRow { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip {
          border: 1px solid rgba(0, 100, 145, 0.16);
          border-radius: 999px;
          padding: 4px 10px;
          background: rgba(0, 100, 145, 0.08);
          font-size: 12px;
          font-weight: 800;
        }
        .message {
          margin-top: 12px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.92);
          padding: 12px;
        }
        .message h2 { margin: 0 0 6px; font-size: 16px; }
        .message p { margin: 0; white-space: pre-wrap; font-weight: 700; color: #334155; }
        .alert {
          margin-top: 12px;
          border-radius: 14px;
          padding: 12px;
          font-weight: 700;
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
        .storeName { margin: 0 0 10px; font-size: 20px; }
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
        .lineItem strong { white-space: nowrap; }
        .placeholder { margin: 0; color: #64748b; font-weight: 600; }
        .notes,
        .targets,
        .tasks {
          margin-top: 10px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 12px;
          background: #fff;
          padding: 10px;
        }
        .notes p { margin: 0; white-space: pre-wrap; font-weight: 600; color: #334155; }
        .tasks ul { margin: 0; padding-left: 0; list-style: none; display: grid; gap: 8px; }
        .tasks label { display: flex; align-items: center; gap: 8px; font-weight: 600; }
        .done { text-decoration: line-through; color: #64748b; }

        @media (max-width: 980px) {
          .storesGrid,
          .metricGrid,
          .metricGrid.compact {
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
          .storesGrid { grid-template-columns: 1fr; }
          .storeCard,
          .metricBlock,
          .notes,
          .targets,
          .tasks,
          .areaStrip,
          .message {
            break-inside: avoid;
            box-shadow: none;
          }
        }
      `}</style>
    </main>
  );
}
