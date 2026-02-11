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

const toNumberOrNull = (value: string) => {
  if (value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

export default function CostControlsUploadPanel() {
  const [date, setDate] = useState("");
  const [store, setStore] = useState("Downpatrick");
  const [managerName, setManagerName] = useState("");

  const [salesGbp, setSalesGbp] = useState("");
  const [labourCostGbp, setLabourCostGbp] = useState("");
  const [idealFoodCostGbp, setIdealFoodCostGbp] = useState("");
  const [actualFoodCostGbp, setActualFoodCostGbp] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!supabase) return;

    setMsg(null);

    if (!date || !store || !managerName.trim()) {
      setMsg("Please complete Date, Store and Manager.");
      return;
    }

    setSaving(true);

    const payload = {
      shift_date: date,
      store,
      manager_name: managerName.trim(),
      sales_gbp: toNumberOrNull(salesGbp),
      labour_cost_gbp: toNumberOrNull(labourCostGbp),
      ideal_food_cost_gbp: toNumberOrNull(idealFoodCostGbp),
      actual_food_cost_gbp: toNumberOrNull(actualFoodCostGbp),
      notes: notes.trim() ? notes.trim() : null,
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
    setManagerName("");
    setSalesGbp("");
    setLabourCostGbp("");
    setIdealFoodCostGbp("");
    setActualFoodCostGbp("");
    setNotes("");
    setSaving(false);
  };

  return (
    <section className="card">
      <h2>Cost Controls — Daily Entry</h2>
      <p className="muted">
        Enter the day’s financial values (£). These feed directly into the
        Cost Controls dashboard and ranking.
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
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            placeholder="e.g. Stuart Graham"
          />
        </div>

        <div>
          <label>Sales £</label>
          <input
            type="number"
            step="0.01"
            value={salesGbp}
            onChange={(e) => setSalesGbp(e.target.value)}
            placeholder="e.g. 2450.00"
          />
        </div>

        <div>
          <label>Labour £</label>
          <input
            type="number"
            step="0.01"
            value={labourCostGbp}
            onChange={(e) => setLabourCostGbp(e.target.value)}
            placeholder="e.g. 610.00"
          />
        </div>

        <div>
          <label>Ideal Food £</label>
          <input
            type="number"
            step="0.01"
            value={idealFoodCostGbp}
            onChange={(e) => setIdealFoodCostGbp(e.target.value)}
            placeholder="e.g. 720.00"
          />
        </div>

        <div>
          <label>Actual Food £</label>
          <input
            type="number"
            step="0.01"
            value={actualFoodCostGbp}
            onChange={(e) => setActualFoodCostGbp(e.target.value)}
            placeholder="e.g. 760.00"
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label>Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. promo mix, wastage spike, stock issue"
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
