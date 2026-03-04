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

const AREA_TARGETS = {
  labourMax01: 0.26,
  foodVarAbsMax01: 0.003,
  addHoursOkMax: 1,
};

const normalisePct01 = (v: number | null) => {
  if (v == null || !Number.isFinite(v)) return null;
  return v > 1 ? v / 100 : v;
};

const to01From100 = (v0to100: number | null) => {
  if (v0to100 == null || !Number.isFinite(v0to100)) return null;
  return v0to100 / 100;
};

const fmtPct2 = (v: number | null) =>
  v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(2)}%`;

const fmtNum2 = (v: number | null) =>
  v == null || !Number.isFinite(v) ? "—" : `${Number(v).toFixed(2)}`;

const fmtMins2 = (v: number | null) =>
  v == null || !Number.isFinite(v) ? "—" : `${Number(v).toFixed(2)}m`;

const avg = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

const sum = (arr: number[]) =>
  arr.reduce((a, b) => a + b, 0);

type MetricStatus = "good" | "ok" | "bad" | "na";

const statusHigherBetter = (value: number | null, targetMin: number): MetricStatus => {
  if (value == null) return "na";
  if (value >= targetMin) return "good";
  if (value >= targetMin - 0.002) return "ok";
  return "bad";
};

const statusLowerBetter = (value: number | null, targetMax: number): MetricStatus => {
  if (value == null) return "na";
  if (value <= targetMax) return "good";
  if (value <= targetMax + 0.002) return "ok";
  return "bad";
};

const statusAbsLowerBetter = (value: number | null, targetAbsMax: number): MetricStatus => {
  if (value == null) return "na";
  const absVal = Math.abs(value);
  if (absVal <= targetAbsMax) return "good";
  if (absVal <= targetAbsMax + 0.002) return "ok";
  return "bad";
};

const pillClassFromStatus = (s: MetricStatus) => {
  if (s === "good") return "pill green";
  if (s === "ok") return "pill amber";
  if (s === "bad") return "pill red";
  return "pill";
};

export default function DailyUpdateClient() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<string[]>([]);
  const [storeCards, setStoreCards] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const { data: serviceRows } = await supabase
          .from("service_shifts")
          .select("*");

        const { data: costRows } = await supabase
          .from("cost_control_entries")
          .select("*");

        if (!serviceRows || !costRows) return;

        const storeSet = new Set<string>();
        serviceRows.forEach((r: any) => storeSet.add(r.store));
        costRows.forEach((r: any) => storeSet.add(r.store));

        const storeList = Array.from(storeSet).sort();
        setStores(storeList);

        const cards = storeList.map((store) => {
          const service = serviceRows.filter((r: any) => r.store === store);
          const cost = costRows.filter((r: any) => r.store === store);

          const sales = sum(cost.map((r: any) => Number(r.sales_gbp || 0)));
          const labourCost = sum(cost.map((r: any) => Number(r.labour_cost_gbp || 0)));
          const ideal = sum(cost.map((r: any) => Number(r.ideal_food_cost_gbp || 0)));
          const actual = sum(cost.map((r: any) => Number(r.actual_food_cost_gbp || 0)));

          const labourPct01 = sales > 0 ? labourCost / sales : null;
          const foodVarPct01 = sales > 0 ? (actual - ideal) / sales : null;

          const dotPct01 = avg(service.map((r: any) => normalisePct01(r.dot_pct)).filter(Boolean) as number[]);
          const extremesPct01 = avg(service.map((r: any) => normalisePct01(r.extreme_over_40)).filter(Boolean) as number[]);
          const rnlMinutes = avg(service.map((r: any) => r.rnl_minutes).filter(Boolean) as number[]);
          const additionalHours = sum(service.map((r: any) => Number(r.additional_hours || 0)));

          return {
            store,
            cost: { labourPct01, foodVarPct01 },
            service: { dotPct01, extremesPct01, rnlMinutes },
            additionalHours,
          };
        });

        setStoreCards(cards);
      } catch (e) {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <main className="wrap">
      <div className="shell">
        <div className="topbar">
          <button className="navbtn" onClick={() => router.back()}>← Back</button>
          <div className="topbar-spacer" />
          <button className="navbtn solid" onClick={() => router.push("/")}>🏠 Home</button>
          <button className="navbtn solid" onClick={() => window.print()}>📄 Export PDF</button>
        </div>

        <h1>Daily Update</h1>

        {error && <div className="alert">{error}</div>}
        {loading && <div className="alert muted">Loading…</div>}

        <div className="storeGrid dense">
          {storeCards.map((card) => {
            const dotStatus = statusHigherBetter(card.service.dotPct01, 0.78);
            const labourStatus = statusLowerBetter(card.cost.labourPct01, 0.26);
            const foodVarStatus = statusAbsLowerBetter(card.cost.foodVarPct01, 0.003);

            return (
              <article key={card.store} className="storeCard denseCard">
                <div className="storeTop">
                  <div className="storeName">{card.store}</div>
                  <div className="storeBadges">
                    <span className={pillClassFromStatus(dotStatus)}>DOT {fmtPct2(card.service.dotPct01)}</span>
                    <span className={pillClassFromStatus(labourStatus)}>Lab {fmtPct2(card.cost.labourPct01)}</span>
                  </div>
                </div>

                <div className="metricRow">
                  <span className="pill">R&L {fmtMins2(card.service.rnlMinutes)}</span>
                  <span className="pill">Ext {fmtPct2(card.service.extremesPct01)}</span>
                  <span className="pill">AddH {fmtNum2(card.additionalHours)}</span>
                  <span className={pillClassFromStatus(foodVarStatus)}>Food {fmtPct2(card.cost.foodVarPct01)}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
