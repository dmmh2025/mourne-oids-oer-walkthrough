"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

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

const DEFAULT_STORES = ["Ballynahinch", "Downpatrick", "Newcastle", "Kilkeel"];

type StoreInputRow = {
  date: string; // date
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

type AreaMsgRow = {
  date: string;
  message: string | null;
};

type TaskRow = {
  id: string;
  date: string;
  store: string;
  task: string;
  is_complete: boolean;
  created_at: string | null;
  completed_at: string | null;
};

function numOrNull(v: string): number | null {
  if (v == null) return null;
  const t = String(v).trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function clampPct0to100(n: number | null): number | null {
  if (n == null) return null;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

export default function DailyUpdateAdminPanel() {
  const todayUK = useMemo(() => toISODateUK(new Date()), []);
  const [date] = useState<string>(todayUK);

  // stores list (dynamic, falls back)
  const [stores, setStores] = useState<string[]>(DEFAULT_STORES);

  // loading flags
  const [loading, setLoading] = useState(true);
  const [savingMsg, setSavingMsg] = useState(false);
  const [savingInputs, setSavingInputs] = useState<Record<string, boolean>>({});
  const [savingTask, setSavingTask] = useState<Record<string, boolean>>({});

  // messages + inputs state
  const [areaMessage, setAreaMessage] = useState<string>("");
  const [storeInputs, setStoreInputs] = useState<Record<string, StoreInputRow>>(
    {}
  );

  // tasks state
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [newTaskText, setNewTaskText] = useState<Record<string, string>>({});

  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const ensureStoreRow = (store: string): StoreInputRow => ({
    date,
    store,
    missed_calls_wtd: null,
    gps_tracked_wtd: null,
    aof_wtd: null,
    target_load_time_mins: null,
    target_rack_time_mins: null,
    target_adt_mins: null,
    target_extremes_over40_pct: null,
    notes: null,
  });

  // Pull stores from recent tables to allow future area changes
  const loadStores = async () => {
    if (!supabase) return DEFAULT_STORES;

    const uniq = new Set<string>();

    // 1) from service_shifts (most reliable "stores that exist")
    try {
      const { data } = await supabase
        .from("service_shifts")
        .select("store")
        .order("shift_date", { ascending: false })
        .limit(2000);

      (data || []).forEach((r: any) => {
        const s = String(r?.store || "").trim();
        if (s) uniq.add(s);
      });
    } catch {}

    // 2) from cost_control_entries
    try {
      const { data } = await supabase
        .from("cost_control_entries")
        .select("store")
        .order("shift_date", { ascending: false })
        .limit(2000);

      (data || []).forEach((r: any) => {
        const s = String(r?.store || "").trim();
        if (s) uniq.add(s);
      });
    } catch {}

    // 3) from daily_update_store_inputs
    try {
      const { data } = await supabase
        .from("daily_update_store_inputs")
        .select("store")
        .order("date", { ascending: false })
        .limit(500);

      (data || []).forEach((r: any) => {
        const s = String(r?.store || "").trim();
        if (s) uniq.add(s);
      });
    } catch {}

    const arr = Array.from(uniq);
    // If nothing found, fall back to known list
    return arr.length ? arr.sort((a, b) => a.localeCompare(b)) : DEFAULT_STORES;
  };

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    setStatusMsg(null);

    const storeList = await loadStores();
    setStores(storeList);

    // Load area message
    const { data: msgData, error: msgErr } = await supabase
      .from("daily_update_area_message")
      .select("date,message")
      .eq("date", date)
      .maybeSingle();

    if (msgErr) {
      setStatusMsg("❌ Could not load area message: " + msgErr.message);
    } else {
      setAreaMessage(String(msgData?.message || ""));
    }

    // Load store inputs for today
    const { data: inputsData, error: inputsErr } = await supabase
      .from("daily_update_store_inputs")
      .select(
        "date,store,missed_calls_wtd,gps_tracked_wtd,aof_wtd,target_load_time_mins,target_rack_time_mins,target_adt_mins,target_extremes_over40_pct,notes"
      )
      .eq("date", date);

    if (inputsErr) {
      setStatusMsg("❌ Could not load store inputs: " + inputsErr.message);
    }

    const nextInputs: Record<string, StoreInputRow> = {};
    for (const s of storeList) nextInputs[s] = ensureStoreRow(s);

    (inputsData || []).forEach((r: any) => {
      const store = String(r?.store || "").trim();
      if (!store) return;
      nextInputs[store] = {
        date: String(r.date),
        store,
        missed_calls_wtd: r.missed_calls_wtd ?? null,
        gps_tracked_wtd: r.gps_tracked_wtd ?? null,
        aof_wtd: r.aof_wtd ?? null,
        target_load_time_mins: r.target_load_time_mins ?? null,
        target_rack_time_mins: r.target_rack_time_mins ?? null,
        target_adt_mins: r.target_adt_mins ?? null,
        target_extremes_over40_pct: r.target_extremes_over40_pct ?? null,
        notes: r.notes ?? null,
      };
    });

    setStoreInputs(nextInputs);

    // Load tasks for today
    const { data: taskData, error: taskErr } = await supabase
      .from("daily_update_store_tasks")
      .select("id,date,store,task,is_complete,created_at,completed_at")
      .eq("date", date)
      .order("created_at", { ascending: true });

    if (taskErr) {
      setStatusMsg("❌ Could not load tasks: " + taskErr.message);
      setTasks([]);
    } else {
      setTasks((taskData || []) as TaskRow[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const saveAreaMessage = async () => {
    if (!supabase) return;
    setSavingMsg(true);
    setStatusMsg(null);

    const payload: AreaMsgRow = {
      date,
      message: areaMessage.trim() ? areaMessage.trim() : null,
    };

    const { error } = await supabase
      .from("daily_update_area_message")
      .upsert(payload, { onConflict: "date" });

    if (error) setStatusMsg("❌ Save failed: " + error.message);
    else setStatusMsg("✅ Area message saved.");

    setSavingMsg(false);
  };

  const saveStoreInput = async (store: string) => {
    if (!supabase) return;
    setSavingInputs((p) => ({ ...p, [store]: true }));
    setStatusMsg(null);

    const r = storeInputs[store] ?? ensureStoreRow(store);

    const payload: StoreInputRow = {
      date,
      store,
      missed_calls_wtd: r.missed_calls_wtd,
      gps_tracked_wtd: clampPct0to100(r.gps_tracked_wtd),
      aof_wtd: clampPct0to100(r.aof_wtd),
      target_load_time_mins: r.target_load_time_mins,
      target_rack_time_mins: r.target_rack_time_mins,
      target_adt_mins: r.target_adt_mins,
      target_extremes_over40_pct: clampPct0to100(r.target_extremes_over40_pct),
      notes: r.notes ? String(r.notes) : null,
    };

    const { error } = await supabase
      .from("daily_update_store_inputs")
      .upsert(payload, { onConflict: "date,store" });

    if (error) setStatusMsg(`❌ ${store}: save failed — ${error.message}`);
    else setStatusMsg(`✅ ${store}: inputs saved.`);

    setSavingInputs((p) => ({ ...p, [store]: false }));
  };

  const setField = (store: string, patch: Partial<StoreInputRow>) => {
    setStoreInputs((prev) => ({
      ...prev,
      [store]: { ...(prev[store] ?? ensureStoreRow(store)), ...patch },
    }));
  };

  const addTask = async (store: string) => {
    if (!supabase) return;
    const text = (newTaskText[store] || "").trim();
    if (!text) return;

    setSavingTask((p) => ({ ...p, [store]: true }));
    setStatusMsg(null);

    const { data, error } = await supabase
      .from("daily_update_store_tasks")
      .insert([
        {
          date,
          store,
          task: text,
          is_complete: false,
        },
      ])
      .select("id,date,store,task,is_complete,created_at,completed_at");

    if (error) {
      setStatusMsg(`❌ ${store}: task add failed — ${error.message}`);
    } else {
      setTasks((prev) => [...prev, ...((data || []) as TaskRow[])]);
      setNewTaskText((p) => ({ ...p, [store]: "" }));
      setStatusMsg(`✅ ${store}: task added.`);
    }

    setSavingTask((p) => ({ ...p, [store]: false }));
  };

  const toggleTask = async (task: TaskRow) => {
    if (!supabase) return;
    setStatusMsg(null);

    const nextComplete = !task.is_complete;
    const { data, error } = await supabase
      .from("daily_update_store_tasks")
      .update({
        is_complete: nextComplete,
        completed_at: nextComplete ? new Date().toISOString() : null,
      })
      .eq("id", task.id)
      .select("id,date,store,task,is_complete,created_at,completed_at");

    if (error) {
      setStatusMsg("❌ Task update failed: " + error.message);
      return;
    }

    const updated = (data && data[0]) as TaskRow | undefined;
    if (updated) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    }
  };

  const storeTasks = (store: string) =>
    tasks.filter((t) => t.store === store).sort((a, b) => {
      // incomplete first
      if (a.is_complete !== b.is_complete) return a.is_complete ? 1 : -1;
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    });

  return (
    <>
      <section className="card">
        <div className="headRow">
          <h2>Daily Update Inputs</h2>
          <span className="pill">Date (UK): {date}</span>
        </div>
        <p className="muted">
          This panel feeds the Daily Update page. Stores auto-discover from your
          existing data, so the area can change without code changes.
        </p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className="form-row">
              <label>Key message for the day (Area)</label>
              <textarea
                value={areaMessage}
                onChange={(e) => setAreaMessage(e.target.value)}
                rows={3}
                placeholder="e.g. Food focus today: cheese control + counts accuracy. Push DOT & keep add hours at zero."
              />
            </div>
            <button className="upload-btn" onClick={saveAreaMessage} disabled={savingMsg}>
              {savingMsg ? "Saving…" : "Save area message"}
            </button>

            {statusMsg && <p className="muted" style={{ marginTop: 10 }}>{statusMsg}</p>}
          </>
        )}
      </section>

      {!loading &&
        stores.map((store) => {
          const r = storeInputs[store] ?? ensureStoreRow(store);
          const stTasks = storeTasks(store);
          return (
            <section key={store} className="card">
              <div className="headRow">
                <h2>{store}</h2>
                <button
                  className="smallBtn"
                  onClick={() => saveStoreInput(store)}
                  disabled={!!savingInputs[store]}
                >
                  {savingInputs[store] ? "Saving…" : "Save store inputs"}
                </button>
              </div>

              <div className="grid">
                <div>
                  <label>Missed calls (WTD)</label>
                  <input
                    type="number"
                    value={r.missed_calls_wtd ?? ""}
                    onChange={(e) =>
                      setField(store, { missed_calls_wtd: numOrNull(e.target.value) })
                    }
                    placeholder="0"
                  />
                </div>

                <div>
                  <label>GPS tracked (WTD %) </label>
                  <input
                    type="number"
                    value={r.gps_tracked_wtd ?? ""}
                    onChange={(e) =>
                      setField(store, { gps_tracked_wtd: numOrNull(e.target.value) })
                    }
                    placeholder="95"
                  />
                </div>

                <div>
                  <label>AOF (WTD %) </label>
                  <input
                    type="number"
                    value={r.aof_wtd ?? ""}
                    onChange={(e) =>
                      setField(store, { aof_wtd: numOrNull(e.target.value) })
                    }
                    placeholder="62"
                  />
                </div>

                <div>
                  <label>Target Load Time (mins)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={r.target_load_time_mins ?? ""}
                    onChange={(e) =>
                      setField(store, { target_load_time_mins: numOrNull(e.target.value) })
                    }
                    placeholder="10"
                  />
                </div>

                <div>
                  <label>Target Rack Time (mins)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={r.target_rack_time_mins ?? ""}
                    onChange={(e) =>
                      setField(store, { target_rack_time_mins: numOrNull(e.target.value) })
                    }
                    placeholder="10"
                  />
                </div>

                <div>
                  <label>Target ADT (mins)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={r.target_adt_mins ?? ""}
                    onChange={(e) =>
                      setField(store, { target_adt_mins: numOrNull(e.target.value) })
                    }
                    placeholder="24"
                  />
                </div>

                <div>
                  <label>Target Extremes &gt;40 (pct, 0–100)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={r.target_extremes_over40_pct ?? ""}
                    onChange={(e) =>
                      setField(store, {
                        target_extremes_over40_pct: numOrNull(e.target.value),
                      })
                    }
                    placeholder="3"
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label>Notes (optional)</label>
                  <input
                    type="text"
                    value={r.notes ?? ""}
                    onChange={(e) => setField(store, { notes: e.target.value })}
                    placeholder="Anything worth calling out for today…"
                  />
                </div>
              </div>

              <div className="taskBlock">
                <div className="taskHead">
                  <h3>Outstanding tasks</h3>
                </div>

                <div className="taskAdd">
                  <input
                    type="text"
                    value={newTaskText[store] ?? ""}
                    onChange={(e) =>
                      setNewTaskText((p) => ({ ...p, [store]: e.target.value }))
                    }
                    placeholder="Add a task (e.g. ‘Re-train stretch on portioning’)…"
                  />
                  <button
                    className="smallBtn"
                    onClick={() => addTask(store)}
                    disabled={!!savingTask[store] || !(newTaskText[store] || "").trim()}
                  >
                    {savingTask[store] ? "Adding…" : "Add"}
                  </button>
                </div>

                {stTasks.length === 0 ? (
                  <p className="muted" style={{ marginTop: 8 }}>
                    No tasks logged for today.
                  </p>
                ) : (
                  <ul className="taskList">
                    {stTasks.map((t) => (
                      <li key={t.id} className={t.is_complete ? "done" : ""}>
                        <label className="taskRow">
                          <input
                            type="checkbox"
                            checked={t.is_complete}
                            onChange={() => toggleTask(t)}
                          />
                          <span>{t.task}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })}

      <style jsx>{`
        .headRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .pill {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(241, 245, 249, 0.9);
          color: #334155;
          white-space: nowrap;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin-top: 10px;
        }
        .smallBtn {
          background: transparent;
          border: 1px solid #006491;
          color: #006491;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .smallBtn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .taskBlock {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
        }
        .taskHead h3 {
          margin: 0;
          font-size: 14px;
        }
        .taskAdd {
          margin-top: 8px;
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .taskAdd input {
          flex: 1;
        }
        .taskList {
          list-style: none;
          padding: 0;
          margin: 10px 0 0;
          display: grid;
          gap: 8px;
        }
        .taskRow {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          font-weight: 700;
          color: #0f172a;
        }
        .taskList li {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 12px;
          background: #f8fafc;
        }
        .taskList li.done {
          opacity: 0.75;
        }
        .taskList li.done span {
          text-decoration: line-through;
        }
      `}</style>
    </>
  );
}
