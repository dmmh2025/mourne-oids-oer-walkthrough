"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// create a client directly (same as test page)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ShiftRow = {
  id: string;
  shift_date: string;          // "2025-10-30"
  day_name: string | null;
  store: string;
  forecast_sales: number | null;
  actual_sales: number | null;
  labour_pct: number | null;
  additional_hours: number | null;
  opening_manager: string | null;
  closing_manager: string | null;
  instores_scheduled: number | null;
  instores_actual: number | null;
  drivers_scheduled: number | null;
  drivers_actual: number | null;
  dot_pct: number | null;
  extremes_pct: number | null;
  sbr_pct: number | null;
  rnl_mins: number | null;
  food_var_pct: number | null;
};

const STORES = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"];

export default function ServiceDashboardPage() {
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // later we can add filters here
  const [selectedStore, setSelectedStore] = useState<"all" | string>("all");

  useEffect(() => {
    const load = async () => {
      // for now: grab last 60 days so we can do trends
      const { data, error } = await supabase
        .from("service_shifts")
        .select("*")
        .gte("shift_date", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .order("shift_date", { ascending: false });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setRows((data || []) as ShiftRow[]);
      }
      setLoading(false);
    };

    load();
  }, []);

  // apply store filter (for when we add buttons)
  const filteredRows = useMemo(() => {
    if (selectedStore === "all") return rows;
    return rows.filter((r) => r.store === selectedStore);
  }, [rows, selectedStore]);

  // ===== KPI CALCS =====
  const kpis = useMemo(() => {
    if (filteredRows.length === 0) {
      return {
        totalActual: 0,
        totalForecast: 0,
        variancePct: 0,
        avgLabour: 0,
        avgDOT: 0,
        avgRnL: 0,
      };
    }

    let totalActual = 0;
    let totalForecast = 0;
    const labourVals: number[] = [];
    const dotVals: number[] = [];
    const rnlVals: number[] = [];

    for (const row of filteredRows) {
      if (row.actual_sales != null) totalActual += row.actual_sales;
      if (row.forecast_sales != null) totalForecast += row.forecast_sales;
      if (row.labour_pct != null) labourVals.push(row.labour_pct);
      if (row.dot_pct != null) dotVals.push(row.dot_pct);
      if (row.rnl_mins != null) rnlVals.push(row.rnl_mins);
    }

    const variancePct =
      totalForecast && totalForecast !== 0
        ? (totalActual - totalForecast) / totalForecast
        : 0;

    const avgLabour =
      labourVals.length > 0
        ? labourVals.reduce((a, b) => a + b, 0) / labourVals.length
        : 0;

    const avgDOT =
      dotVals.length > 0
        ? dotVals.reduce((a, b) => a + b, 0) / dotVals.length
        : 0;

    const avgRnL =
      rnlVals.length > 0
        ? rnlVals.reduce((a, b) => a + b, 0) / rnlVals.length
        : 0;

    return {
      totalActual,
      totalForecast,
      variancePct,
      avgLabour,
      avgDOT,
      avgRnL,
    };
  }, [filteredRows]);

  // ===== STORE BREAKDOWN =====
  const storeData = useMemo(() => {
    // group rows by store
    const map: Record<string, ShiftRow[]> = {};
    for (const row of filteredRows) {
      if (!map[row.store]) map[row.store] = [];
      map[row.store].push(row);
    }

    // compute stats for each store
    const out = STORES.map((storeName) => {
      const storeRows = map[storeName] || [];
      if (storeRows.length === 0) {
        return {
          store: storeName,
          totalActual: 0,
          totalForecast: 0,
          variancePct: 0,
          avgLabour: 0,
          avgDOT: 0,
          avgSBR: 0,
          avgRnL: 0,
        };
      }

      let totalActual = 0;
      let totalForecast = 0;
      const labourVals: number[] = [];
      const dotVals: number[] = [];
      const sbrVals: number[] = [];
      const rnlVals: number[] = [];

      for (const r of storeRows) {
        if (r.actual_sales != null) totalActual += r.actual_sales;
        if (r.forecast_sales != null) totalForecast += r.forecast_sales;
        if (r.labour_pct != null) labourVals.push(r.labour_pct);
        if (r.dot_pct != null) dotVals.push(r.dot_pct);
        if (r.sbr_pct != null) sbrVals.push(r.sbr_pct);
        if (r.rnl_mins != null) rnlVals.push(r.rnl_mins);
      }

      const variancePct =
        totalForecast && totalForecast !== 0
          ? (totalActual - totalForecast) / totalForecast
          : 0;

      const avgLabour =
        labourVals.length > 0
          ? labourVals.reduce((a, b) => a + b, 0) / labourVals.length
          : 0;

      const avgDOT =
        dotVals.length > 0
          ? dotVals.reduce((a, b) => a + b, 0) / dotVals.length
          : 0;

      const avgSBR =
        sbrVals.length > 0
          ? sbrVals.reduce((a, b) => a + b, 0) / sbrVals.length
          : 0;

      const avgRnL =
        rnlVals.length > 0
          ? rnlVals.reduce((a, b) => a + b, 0) / rnlVals.length
          : 0;

      return {
        store: storeName,
        totalActual,
        totalForecast,
        variancePct,
        avgLabour,
        avgDOT,
        avgSBR,
        avgRnL,
      };
    });

    // sort by DOT desc, then labour asc (your rule)
    out.sort((a, b) => {
      if (b.avgDOT !== a.avgDOT) return b.avgDOT - a.avgDOT;
      return a.avgLabour - b.avgLabour;
    });

    return out;
  }, [filteredRows]);

  // ===== MANAGER LEADERBOARD =====
  const managerData = useMemo(() => {
    const map: Record<
      string,
      {
        shifts: number;
        totalSales: number;
        labour: number[];
        dot: number[];
        sbr: number[];
        rnl: number[];
      }
    > = {};

    for (const row of filteredRows) {
      const name = row.closing_manager || "Unknown";
      if (!map[name]) {
        map[name] = {
          shifts: 0,
          totalSales: 0,
          labour: [],
          dot: [],
          sbr: [],
          rnl: [],
        };
      }
      map[name].shifts += 1;
      if (row.actual_sales != null) map[name].totalSales += row.actual_sales;
      if (row.labour_pct != null) map[name].labour.push(row.labour_pct);
      if (row.dot_pct != null) map[name].dot.push(row.dot_pct);
      if (row.sbr_pct != null) map[name].sbr.push(row.sbr_pct);
      if (row.rnl_mins != null) map[name].rnl.push(row.rnl_mins);
    }

    // turn into array
    const out = Object.entries(map).map(([name, vals]) => {
      const avg = (arr: number[]) =>
        arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      return {
        name,
        shifts: vals.shifts,
        totalSales: vals.totalSales,
        avgLabour: avg(vals.labour),
        avgDOT: avg(vals.dot),
        avgSBR: avg(vals.sbr),
        avgRnL: avg(vals.rnl),
      };
    });

    // sort: best DOT first
    out.sort((a, b) => b.avgDOT - a.avgDOT);

    return out;
  }, [filteredRows]);

  // ===== RENDER =====

  if (loading) {
    return <div className="p-6">Loading Mourne-oids dashboard…</div>;
  }

  if (errorMsg) {
    return (
      <div className="p-6 text-red-500">
        Error loading service data: {errorMsg}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mourne-oids Service Dashboard</h1>
          <p className="text-gray-500 text-sm">
            Live data from Supabase → service_shifts
          </p>
        </div>

        {/* Store filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedStore("all")}
            className={`px-3 py-1 rounded ${
              selectedStore === "all"
                ? "bg-[#006491] text-white"
                : "bg-gray-200"
            }`}
          >
            All stores
          </button>
          {STORES.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStore(s)}
              className={`px-3 py-1 rounded ${
                selectedStore === s ? "bg-[#006491] text-white" : "bg-gray-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          title="Area Sales (£)"
          value={
            "£" + kpis.totalActual.toLocaleString(undefined, { maximumFractionDigits: 0 })
          }
          subtitle={
            kpis.totalForecast
              ? `vs £${kpis.totalForecast.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })} forecast`
              : "No forecast"
          }
        />
        <KpiCard
          title="Variance %"
          value={(kpis.variancePct * 100).toFixed(1) + "%"}
          tone={
            kpis.variancePct >= 0
              ? "green"
              : kpis.variancePct >= -0.05
              ? "amber"
              : "red"
          }
        />
        <KpiCard
          title="Avg Labour %"
          value={(kpis.avgLabour * 100).toFixed(1) + "%"}
          tone={
            kpis.avgLabour <= 0.25
              ? "green"
              : kpis.avgLabour <= 0.28
              ? "amber"
              : "red"
          }
        />
        <KpiCard
          title="Avg DOT %"
          value={(kpis.avgDOT * 100).toFixed(0) + "%"}
          tone={
            kpis.avgDOT >= 0.8
              ? "green"
              : kpis.avgDOT >= 0.75
              ? "amber"
              : "red"
          }
        />
      </div>

      {/* Store Overview */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Store performance</h2>
        <div className="grid grid-cols-4 gap-4">
          {storeData.map((store) => (
            <div key={store.store} className="border rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">{store.store}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    store.avgDOT >= 0.8
                      ? "bg-green-100 text-green-700"
                      : store.avgDOT >= 0.75
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {Math.round(store.avgDOT * 100)}% DOT
                </span>
              </div>
              <p className="text-sm mb-1">
                Sales: £{store.totalActual.toLocaleString()}
              </p>
              <p className="text-sm mb-1">
                Vs fcst:{" "}
                {store.totalForecast
                  ? "£" + store.totalForecast.toLocaleString()
                  : "—"}
              </p>
              <p
                className={`text-sm mb-1 ${
                  store.variancePct >= 0
                    ? "text-green-600"
                    : store.variancePct >= -0.05
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                Var: {(store.variancePct * 100).toFixed(1)}%
              </p>
              <p className="text-sm">
                Labour: {(store.avgLabour * 100).toFixed(1)}%
              </p>
              <p className="text-sm">
                SBR: {(store.avgSBR * 100).toFixed(0)}%
              </p>
              <p className="text-sm">R&L: {store.avgRnL.toFixed(1)}m</p>
            </div>
          ))}
        </div>
      </div>

      {/* Manager Leaderboard */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Manager / Closing leaderboard</h2>
        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">Manager</th>
                <th className="px-3 py-2 text-left">Shifts</th>
                <th className="px-3 py-2 text-left">Total Sales</th>
                <th className="px-3 py-2 text-left">Avg Labour</th>
                <th className="px-3 py-2 text-left">Avg DOT</th>
                <th className="px-3 py-2 text-left">Avg SBR</th>
                <th className="px-3 py-2 text-left">Avg R&L</th>
              </tr>
            </thead>
            <tbody>
              {managerData.map((mgr) => (
                <tr key={mgr.name}>
                  <td className="px-3 py-2">{mgr.name}</td>
                  <td className="px-3 py-2">{mgr.shifts}</td>
                  <td className="px-3 py-2">
                    £{mgr.totalSales.toLocaleString()}
                  </td>
                  <td
                    className={`px-3 py-2 ${
                      mgr.avgLabour <= 0.25
                        ? "text-green-600"
                        : mgr.avgLabour <= 0.28
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {(mgr.avgLabour * 100).toFixed(1)}%
                  </td>
                  <td
                    className={`px-3 py-2 ${
                      mgr.avgDOT >= 0.8
                        ? "text-green-600"
                        : mgr.avgDOT >= 0.75
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {(mgr.avgDOT * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2">
                    {(mgr.avgSBR * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2">
                    {mgr.avgRnL.toFixed(1)}m
                  </td>
                </tr>
              ))}
              {managerData.length === 0 && (
                <tr>
                  <td className="px-3 py-2" colSpan={7}>
                    No manager data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// simple KPI component
function KpiCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle?: string;
  tone?: "green" | "amber" | "red";
}) {
  const toneClasses =
    tone === "green"
      ? "border-green-200 bg-green-50"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : tone === "red"
      ? "border-red-200 bg-red-50"
      : "border-gray-200 bg-white";
  return (
    <div className={`border rounded-lg p-4 ${toneClasses}`}>
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
        {title}
      </p>
      <p className="text-2xl font-bold mb-1">{value}</p>
      {subtitle ? <p className="text-xs text-gray-500">{subtitle}</p> : null}
    </div>
  );
}
