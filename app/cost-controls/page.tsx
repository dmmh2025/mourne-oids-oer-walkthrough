"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

// ✅ Removed "today" (current day is never complete)
type RangeMode = "previous_day" | "this_week" | "this_month" | "custom";

type CostRow = {
  id: string;
  store: string;
  shift_date: string; // YYYY-MM-DD
  manager_name: string;

  // Stored in Supabase as £ values (not displayed)
  sales_gbp: number;
  labour_cost_gbp: number;
  ideal_food_cost_gbp: number;
  actual_food_cost_gbp: number;

  created_at?: string | null;
};

function isYYYYMMDD(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function toYYYYMMDDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function startOfTodayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfThisWeekLocal() {
  const d = startOfTodayLocal();
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfNextWeekLocal() {
  const d = startOfThisWeekLocal();
  d.setDate(d.getDate() + 7);
  return d;
}

function startOfThisMonthLocal() {
  const d = startOfTodayLocal();
  d.setDate(1);
  return d;
}

function startOfNextMonthLocal() {
  const d = startOfThisMonthLocal();
  d.setMonth(d.getMonth() + 1);
  return d;
}

function fmtShortDate(yyyyMMdd: string) {
  if (!isYYYYMMDD(yyyyMMdd)) return yyyyMMdd;
  const d = new Date(yyyyMMdd + "T00:00:00");
  if (isNaN(d.getTime())) return yyyyMMdd;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// expects decimal form (0.25 = 25%)
function fmtPct(n: number, dp = 2) {
  if (!isFinite(n)) return "—";
  return (n * 100).toFixed(dp) + "%";
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cryptoRandomFallback() {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return crypto.randomUUID();
  } catch {}
  return String(Date.now()) + "_" + Math.random().toString(16).slice(2);
}

function normaliseRow(r: any): CostRow {
  const id = String(r.id ?? r.uuid ?? cryptoRandomFallback());
  const store =
    String(r.store ?? r.store_name ?? r.shop ?? "").trim() || "Unknown";
  const shift_date = String(
    r.shift_date ?? r.date ?? r.shiftDay ?? r.shift_day ?? ""
  ).slice(0, 10);
  const manager_name =
    String(
      r.manager_name ?? r.manager ?? r.shift_manager ?? r.user ?? "Unknown"
    ).trim() || "Unknown";

  const sales_gbp = num(r.sales_gbp ?? r.sales ?? r.net_sales ?? 0);
  const labour_cost_gbp = num(
    r.labour_cost_gbp ?? r.labour_gbp ?? r.labour_cost ?? r.labour ?? 0
  );
  const ideal_food_cost_gbp = num(
    r.ideal_food_cost_gbp ?? r.ideal_food ?? r.ideal_food_gbp ?? 0
  );
  const actual_food_cost_gbp = num(
    r.actual_food_cost_gbp ?? r.actual_food ?? r.actual_food_gbp ?? 0
  );

  const created_at = r.created_at ? String(r.created_at) : null;

  return {
    id,
    store,
    shift_date,
    manager_name,
    sales_gbp,
    labour_cost_gbp,
    ideal_food_cost_gbp,
    actual_food_cost_gbp,
    created_at,
  };
}

type Agg = {
  name: string; // store or manager
  days: number;

  // Internal sums for correct weighting (NOT displayed)
  sales: number;
  labour: number;
  idealFood: number;
  actualFood: number;

  // Displayed metrics
  labourPct: number; // labour / sales
  foodVarPctSales: number; // (actual - ideal) / sales

  // Ranking metrics
  labourDelta: number; // amount ABOVE target (0 if <= target). Lower is better.
  foodVarDelta: number; // distance to 0 (absolute). Lower is better.
};

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

// Targets
const LABOUR_TARGET = 0.25; // 25%
const FOODVAR_MIN = -0.0025; // -0.25%
const FOODVAR_MAX = 0.0025; // +0.25%

export default function CostControlsPage() {
  const router = useRouter();

  // Default to previous_day (today is never complete)
  const [rangeMode, setRangeMode] = useState<RangeMode>("previous_day");
  const [customFrom, setCustomFrom] = useState<string>(() =>
    toYYYYMMDDLocal(startOfTodayLocal())
  );
  const [customTo, setCustomTo] = useState<string>(() =>
    toYYYYMMDDLocal(startOfTodayLocal())
  );

  const rangeWindow = useMemo(() => {
    if (rangeMode === "previous_day") {
      const d = startOfTodayLocal();
      d.setDate(d.getDate() - 1);
      const from = toYYYYMMDDLocal(d);
      const toD = new Date(d);
      toD.setDate(toD.getDate() + 1);
      const to = toYYYYMMDDLocal(toD);
      return { from, to, label: "Previous day" };
    }

    if (rangeMode === "this_week") {
      const fromD = startOfThisWeekLocal();
      const toD = startOfNextWeekLocal();
      return {
        from: toYYYYMMDDLocal(fromD),
        to: toYYYYMMDDLocal(toD),
        label: `This week (${fmtShortDate(
          toYYYYMMDDLocal(fromD)
        )} → ${fmtShortDate(
          toYYYYMMDDLocal(new Date(toD.getTime() - 1))
        )})`,
      };
    }

    if (rangeMode === "this_month") {
      const fromD = startOfThisMonthLocal();
      const toD = startOfNextMonthLocal();
      return {
        from: toYYYYMMDDLocal(fromD),
        to: toYYYYMMDDLocal(toD),
        label: `This month (${fromD.toLocaleString("en-GB", {
          month: "long",
        })})`,
      };
    }

    // custom
    const safeFrom = customFrom;
    const safeTo = customTo;
    const toD = new Date(safeTo + "T00:00:00");
    toD.setDate(toD.getDate() + 1);
    const to = toYYYYMMDDLocal(toD);
    return {
      from: safeFrom,
      to,
      label: `Custom (${fmtShortDate(safeFrom)} → ${fmtShortDate(safeTo)})`,
    };
  }, [rangeMode, customFrom, customTo]);

  const [rows, setRows] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      if (!supabase) throw new Error("Supabase client not available");

      const { data, error } = await supabase
        .from("cost_control_entries")
        .select("*")
        .gte("shift_date", rangeWindow.from)
        .lt("shift_date", rangeWindow.to)
        .order("shift_date", { ascending: false });

      if (error) {
        throw new Error(
          [
            error.message,
            error.code ? `code: ${error.code}` : null,
            // @ts-ignore
            error.details ? `details: ${error.details}` : null,
            // @ts-ignore
            error.hint ? `hint: ${error.hint}` : null,
          ]
            .filter(Boolean)
            .join(" | ")
        );
      }

      const normalised = (data || []).map(normaliseRow);

      const missingShiftDate = normalised.some(
        (r) => !r.shift_date || r.shift_date.length < 10
      );
      if (missingShiftDate) {
        setErr(
          "Loaded rows, but some entries are missing a valid shift_date. Check table column names/types (expected shift_date as YYYY-MM-DD)."
        );
      }

      setRows(normalised);
    } catch (e: any) {
      setErr(e?.message || "Failed to load cost control entries");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeWindow.from, rangeWindow.to]);

  const storeAgg = useMemo(() => aggregate(rows, "store"), [rows]);
  const mgrAgg = useMemo(() => aggregate(rows, "manager_name"), [rows]);

  // Highlights: labour (unchanged)
  const topStoreLabour = useMemo(() => {
    if (!storeAgg.length) return null;

    const sorted = storeAgg.slice().sort((a, b) => {
      const aOver = a.labourPct > LABOUR_TARGET ? 1 : 0;
      const bOver = b.labourPct > LABOUR_TARGET ? 1 : 0;
      if (aOver !== bOver) return aOver - bOver;

      if (a.labourPct !== b.labourPct) return a.labourPct - b.labourPct;

      return b.sales - a.sales;
    });

    return sorted[0] || null;
  }, [storeAgg]);

  // Highlights: food (closest to 0 wins)
  const topStoreFood = useMemo(() => {
    if (!storeAgg.length) return null;

    const sorted = storeAgg.slice().sort((a, b) => {
      const aAbs = Math.abs(a.foodVarPctSales);
      const bAbs = Math.abs(b.foodVarPctSales);
      if (aAbs !== bAbs) return aAbs - bAbs;
      return b.sales - a.sales;
    });

    return sorted[0] || null;
  }, [storeAgg]);

  return (
    <main className="wrap">
      <div className="banner">
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
        />
      </div>

      <div className="shell">
        <div className="topbar">
          <button className="navbtn" type="button" onClick={() => router.back()}>
            ← Back
          </button>
          <div className="topbar-spacer" />
          <button
            className="navbtn solid"
            type="button"
            onClick={() => router.push("/")}
          >
            🏠 Home
          </button>
        </div>

        <header className="header">
          <h1>Cost Controls</h1>
          <p className="subtitle">
            Ranked by targets — Labour <b>≤ {fmtPct(LABOUR_TARGET, 0)}</b> (lower
            is better) and Food Variance band{" "}
            <b>
              {fmtPct(FOODVAR_MIN, 2)} → {fmtPct(FOODVAR_MAX, 2)}
            </b>{" "}
            • period: <b>{rangeWindow.label}</b>
          </p>
        </header>

        <section className="rangeCard" aria-label="Date range">
          <div className="chips">
            <button
              type="button"
              className={`chip ${rangeMode === "previous_day" ? "active" : ""}`}
              onClick={() => setRangeMode("previous_day")}
            >
              Previous day
            </button>
            <button
              type="button"
              className={`chip ${rangeMode === "this_week" ? "active" : ""}`}
              onClick={() => setRangeMode("this_week")}
            >
              This week
            </button>
            <button
              type="button"
              className={`chip ${rangeMode === "this_month" ? "active" : ""}`}
              onClick={() => setRangeMode("this_month")}
            >
              This month
            </button>
            <button
              type="button"
              className={`chip ${rangeMode === "custom" ? "active" : ""}`}
              onClick={() => setRangeMode("custom")}
            >
              Custom
            </button>
          </div>

          {rangeMode === "custom" && (
            <div className="customDates">
              <label className="field">
                <span>From</span>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </label>
              <label className="field">
                <span>To</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </label>
              <button className="navbtn" type="button" onClick={load}>
                Ap
