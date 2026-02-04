"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

export default function CostControlsUploadPanel() {
  const [date, setDate] = useState("");
  const [store, setStore] = useState("Downpatrick");
  const [manager, setManager] = useState("");
  const [labourPct, setLabourPct] = useState("");
  const [foodVarPct, setFoodVarPct] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!supabase) return;

    setMsg(null);

    if (!date || !store || !manager) {
      setMsg("Please complete Date, Store and Manager.");
      return;
    }

    setSaving(true);

    const payload = {
      shift_date: date,
      store,
      manager: manager.trim(),
      labour_pct: labourPct ? Number(labourPct) : null,
      food_variance_pct: foodVarPct ? Number(foodVarPct) : null,
    };

    const { error } = await supabase
      .from("cost_control_entries")
      .insert([payload]);

    if (error) {
      setMsg("❌ Upload failed: " + error.message);
      setSaving(false);
      return;
    }

    setMsg("✅ Cost control data saved.");
    setDate("");
    setManager("");
    setLabourPct("");
    setFoodVarPct("");
    setSaving(false);
  };

  return (
    <section className="card">
      <h2>Cost Controls — Daily Entry</h2>
      <p className="muted">
        Enter daily labour and food variance. Data will be averaged and ranked
        in the Cost Controls dashboard.
      </p>

      <div className="form-2col">
        <div>
          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label>Store</label>
          <select value={store} onChange={(e) => setStore(e.target.value)}>
            <option>Downpatrick</option>
            <option>Kilkeel</option>
            <option>Newcastle</option>
            <option>Ballynahinch</option>
          </select>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label>Manager on shift</label>
          <input
            type="text"
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            placeholder="e.g. Stuart Graham"
          />
        </div>

        <div>
          <label>Labour %</label>
          <input
            type="number"
            step="0.1"
            value={labourPct}
            onChange={(e) => setLabourPct(e.target.value)}
            placeholder="24.5"
          />
        </div>

        <div>
          <label>Food variance %</label>
          <input
            type="number"
            step="0.01"
            value={foodVarPct}
            onChange={(e) => setFoodVarPct(e.target.value)}
            placeholder="0.85"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="upload-btn"
      >
        {saving ? "Saving…" : "Save cost controls"}
      </button>

      {msg && (
        <p className="muted" style={{ marginTop: 10 }}>
          {msg}
        </p>
      )}
    </section>
  );
}
