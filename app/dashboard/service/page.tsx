"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// create client from public envs
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STORES = ["Downpatrick", "Kilkeel", "Newcastle", "Ballynahinch"];

type ShiftRow = {
  id: string;
  shift_date: string;
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

export default function ServiceDashboardPage() {
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<"all" | string>("all");

  useEffect(() => {
    const load = async () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const dateStr = sixtyDaysAgo.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("service_shifts")
        .select("*")
        .gte("shift_date", dateStr)
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

  // filter
  const filteredRows = useMemo(() => {
    if (selectedStore === "all") return rows;
    return rows.filter((r) => r.store === selectedStore);
  }, [rows, selectedStore]);

  // KPIs
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
    const lab: number[] = [];
    const dot: number[] = [];
    const rnl: number[] = [];

    for (const r of filteredRows) {
      if (r.actual_sales != null) totalActual += r.actual_sales;
      if (r.forecast_sales != null) totalForecast += r.forecast_sales;
      if (r.labour_pct != null) lab.push(r.labour_pct);
      if (r.dot_pct != null) dot.push(r.dot_pct);
      if (r.rnl_mins != null) rnl.push(r.rnl_mins);
    }

    const variancePct =
      totalForecast > 0 ? (totalActual - totalForecast) / totalForecast : 0;

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return {
      totalActual,
      totalForecast,
      variancePct,
      avgLabour: avg(lab),
      avgDOT: avg(dot),
      avgRnL: avg(rnl),
    };
  }, [filteredRows]);

  // stores
  const storeData = useMemo(() => {
    const out = STORES.map((storeName) => {
      const sr = filteredRows.filter((r) => r.store === storeName);
      if (sr.length === 0) {
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
      const lab: number[] = [];
      const dot: number[] = [];
      const sbr: number[] = [];
      const rnl: number[] = [];

      for (const r of sr) {
        if (r.actual_sales != null) totalActual += r.actual_sales;
        if (r.forecast_sales != null) totalForecast += r.forecast_sales;
        if (r.labour_pct != null) lab.push(r.labour_pct);
        if (r.dot_pct != null) dot.push(r.dot_pct);
        if (r.sbr_pct != null) sbr.push(r.sbr_pct);
        if (r.rnl_mins != null) rnl.push(r.rnl_mins);
      }

      const variancePct =
        totalForecast > 0 ? (totalActual - totalForecast) / totalForecast : 0;

      const avg = (arr: number[]) =>
        arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      return {
        store: storeName,
        totalActual,
        totalForecast,
        variancePct,
        avgLabour: avg(lab),
        avgDOT: avg(dot),
        avgSBR: avg(sbr),
        avgRnL: avg(rnl),
      };
    });

    // your rule: rank by DOT, then labour
    out.sort((a, b) => {
      if (b.avgDOT !== a.avgDOT) return b.avgDOT - a.avgDOT;
      return a.avgLabour - b.avgLabour;
    });

    return out;
  }, [filteredRows]);

  // managers
  const managerData = useMemo(() => {
    const bucket: Record<
      string,
      {
        shifts: number;
        sales: number;
        labour: number[];
        dot: number[];
        sbr: number[];
        rnl: number[];
      }
    > = {};

    for (const r of filteredRows) {
      const name = r.closing_manager || "Unknown";
      if (!bucket[name]) {
        bucket[name] = {
          shifts: 0,
          sales: 0,
          labour: [],
          dot: [],
          sbr: [],
          rnl: [],
        };
      }
      bucket[name].shifts += 1;
      if (r.actual_sales != null) bucket[name].sales += r.actual_sales;
      if (r.labour_pct != null) bucket[name].labour.push(r.labour_pct);
      if (r.dot_pct != null) bucket[name].dot.push(r.dot_pct);
      if (r.sbr_pct != null) bucket[name].sbr.push(r.sbr_pct);
      if (r.rnl_mins != null) bucket[name].rnl.push(r.rnl_mins);
    }

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const arr = Object.entries(bucket).map(([name, v]) => ({
      name,
      shifts: v.shifts,
      totalSales: v.sales,
      avgLabour: avg(v.labour),
      avgDOT: avg(v.dot),
      avgSBR: avg(v.sbr),
      avgRnL: avg(v.rnl),
    }));

    // best DOT first
    arr.sort((a, b) => b.avgDOT - a.avgDOT);

    return arr;
  }, [filteredRows]);

  // ----- RENDER -----

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top bar with logos */}
      <header className="bg-white border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* placeholders - replace src with your actual logo paths */}
            <div className="h-10 w-10 bg-[#E31837] rounded-sm flex items-center justify-center text-white font-bold text-xs">
              D
            </div>
            <div className="text-center">
              <h1 className="text-lg font-bold leading-tight">
                Mourne-oids Hub
              </h1>
              <p className="text-xs text-slate-500">
                Live Service & Staffing Dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 bg-slate-200 rounded" />
            <div className="h-8 w-20 bg-slate-200 rounded" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Service Dashboard</h2>
          <div className="flex gap-2">
            <FilterButton
              label="All stores"
              active={selectedStore === "all"}
              onClick={() => setSelectedStore("all")}
            />
            {STORES.map((s) => (
              <FilterButton
                key={s}
                label={s}
                active={selectedStore === s}
                onClick={() => setSelectedStore(s)}
              />
            ))}
          </div>
        </div>

        {/* Loading / error */}
        {loading && (
          <div className="bg-white border rounded-lg p-6 text-slate-500">
            Loading Mourne-oids data…
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-100 border border-red-200 rounded-lg p-4 text-red-700">
            Error: {errorMsg}
          </div>
        )}

        {!loading && !errorMsg && (
          <>
            {/* KPI Row */}
            <section className="grid gap-4 md:grid-cols-4">
              <KpiCard
                title="Area Sales (£)"
                value={
                  "£" +
                  kpis.totalActual.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })
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
            </section>

            {/* Store Overview */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Store performance</h3>
                <p className="text-xs text-slate-500">
                  Ranked by DOT, then by Labour
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                {storeData.map((st) => (
                  <div
                    key={st.store}
                    className="bg-white border rounded-lg p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{st.store}</h4>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          st.avgDOT >= 0.8
                            ? "bg-green-100 text-green-700"
                            : st.avgDOT >= 0.75
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {Math.round(st.avgDOT * 100)}% DOT
                      </span>
                    </div>
                    <p className="text-sm">
                      Sales: £{st.totalActual.toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500 mb-2">
                      Forecast:{" "}
                      {st.totalForecast
                        ? "£" + st.totalForecast.toLocaleString()
                        : "—"}
                    </p>
                    <p
                      className={`text-sm ${
                        st.variancePct >= 0
                          ? "text-green-600"
                          : st.variancePct >= -0.05
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}
                    >
                      Var: {(st.variancePct * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm">
                      Labour: {(st.avgLabour * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm">SBR: {(st.avgSBR * 100).toFixed(0)}%</p>
                    <p className="text-sm">
                      R&amp;L: {st.avgRnL.toFixed(1)}
                      m
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Manager leaderboard */}
            <section>
              <h3 className="text-lg font-semibold mb-2">
                Manager / closing leaderboard
              </h3>
              <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">Manager</th>
                      <th className="px-3 py-2 text-left">Shifts</th>
                      <th className="px-3 py-2 text-left">Total Sales</th>
                      <th className="px-3 py-2 text-left">Avg Labour</th>
                      <th className="px-3 py-2 text-left">Avg DOT</th>
                      <th className="px-3 py-2 text-left">Avg SBR</th>
                      <th className="px-3 py-2 text-left">Avg R&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerData.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-slate-500" colSpan={7}>
                          No manager data yet.
                        </td>
                      </tr>
                    )}
                    {managerData.map((mgr) => (
                      <tr key={mgr.name} className="border-b last:border-0">
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
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

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
      : "border-slate-200 bg-white";
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClasses}`}>
      <p className="text-xs font-medium uppercase text-slate-500 mb-1">
        {title}
      </p>
      <p className="text-2xl font-bold mb-1">{value}</p>
      {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-sm rounded-md border transition ${
        active
          ? "bg-[#006491] text-white border-[#006491]"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
