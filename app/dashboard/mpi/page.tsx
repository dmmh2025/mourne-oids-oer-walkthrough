"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ProfileRow = {
  id: string;
  display_name: string | null;
  store: string | null;
  job_role: string | null;
  approved: boolean | null;
};

type ServiceShiftRow = {
  manager_profile_id: string | null;
  shift_date: string;
  store: string | null;

  // If your column is manager_name instead of manager, rename here + in select().
  manager: string | null;

  dot_pct: number | null;
  extreme_over_40: number | null;
  rnl_minutes: number | null;
  additional_hours: number | null;
};

type CostControlRow = {
  manager_profile_id: string | null;

  manager_name: string | null;
  store: string | null;
  shift_date: string;

  sales_gbp: number | null;
  labour_cost_gbp: number | null;
  ideal_food_cost_gbp: number | null;
  actual_food_cost_gbp: number | null;
};

type OsaRow = {
  team_member_profile_id: string | null;
  store: string | null;
  shift_date: string;
  stars: number | null;
  points_lost: number | null;
};

type LeaderRow = {
  key: string;
  manager: string;
  storeLabel: string;
  linkedProfileId: string | null;

  service: number | null;
  cost: number | null;
  osa: number | null;
  mpi: number | null;

  stores: string[];
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

const startOfYearUKISO = () => {
  const todayUk = toISODateUK(new Date());
  const [year] = todayUk.split("-").map(Number);
  return `${year || new Date().getFullYear()}-01-01`;
};

const isFiniteNumber = (n: any): n is number =>
  typeof n === "number" && Number.isFinite(n);

const avg = (values: number[]) =>
  values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : null;

const normalisePct01 = (value: number | null): number | null => {
  if (value == null || !Number.isFinite(value)) return null;
  return value > 1 ? value / 100 : value;
};

const normaliseMinutes = (value: number | null): number | null => {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const minutes = value > 60 && value <= 3600 ? value / 60 : value;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) return null;
  return minutes;
};

const keyFromName = (name: string) => name.trim().toLowerCase();

const safeDiv = (num: number, den: number) => {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
};

const deriveLabourPct = (row: CostControlRow): number | null => {
  const sales = isFiniteNumber(row.sales_gbp) ? row.sales_gbp : null;
  const labour = isFiniteNumber(row.labour_cost_gbp) ? row.labour_cost_gbp : null;
  if (sales == null || labour == null) return null;
  const pct = safeDiv(labour, sales);
  return pct == null ? null : pct * 100;
};

const deriveFoodVariancePct = (row: CostControlRow): number | null => {
  const sales = isFiniteNumber(row.sales_gbp) ? row.sales_gbp : null;
  const ideal = isFiniteNumber(row.ideal_food_cost_gbp) ? row.ideal_food_cost_gbp : null;
  const actual = isFiniteNumber(row.actual_food_cost_gbp) ? row.actual_food_cost_gbp : null;
  if (sales == null || ideal == null || actual == null) return null;

  const variancePct = safeDiv(actual - ideal, sales);
  return variancePct == null ? null : variancePct * 100;
};

const weightFromSales = (row: CostControlRow): number | null => {
  const w = isFiniteNumber(row.sales_gbp) ? row.sales_gbp : null;
  return w != null && w > 0 ? w : null;
};

/* -------------------- Scoring -------------------- */

const scoreBand = (
  value: number,
  bands: Array<{ test: (v: number) => boolean; score: number }>
) => {
  for (const b of bands) if (b.test(value)) return b.score;
  return 0;
};

const scoreService100 = (
  dotAvg01: number | null,
  extremesAvg01: number | null,
  rnlAvgMin: number | null,
  addHoursAvg: number | null
) => {
  if (dotAvg01 == null && extremesAvg01 == null && rnlAvgMin == null && addHoursAvg == null)
    return null;

  const dotScore =
    dotAvg01 == null
      ? 0
      : scoreBand(dotAvg01, [
          { test: (v) => v >= 0.8, score: 100 },
          { test: (v) => v >= 0.75, score: 80 },
          { test: (v) => v >= 0.7, score: 60 },
        ]);

  const extremesScore =
    extremesAvg01 == null
      ? 0
      : scoreBand(extremesAvg01, [
          { test: (v) => v <= 0.03, score: 100 },
          { test: (v) => v <= 0.05, score: 80 },
          { test: (v) => v <= 0.08, score: 60 },
        ]);

  const rnlScore =
    rnlAvgMin == null
      ? 0
      : scoreBand(rnlAvgMin, [
          { test: (v) => v <= 10, score: 100 },
          { test: (v) => v <= 15, score: 80 },
          { test: (v) => v <= 20, score: 60 },
        ]);

  const addHoursScore =
    addHoursAvg == null
      ? 0
      : scoreBand(addHoursAvg, [
          { test: (v) => v <= 1, score: 100 },
          { test: (v) => v <= 2.5, score: 80 },
          { test: (v) => v <= 4, score: 60 },
        ]);

  return Math.round(dotScore * 0.4 + extremesScore * 0.3 + rnlScore * 0.2 + addHoursScore * 0.1);
};

const scoreCost100 = (labourPctAvg: number | null, foodVarPctAvg: number | null) => {
  if (labourPctAvg == null && foodVarPctAvg == null) return null;

  const labourScore =
    labourPctAvg == null
      ? 0
      : scoreBand(labourPctAvg, [
          { test: (v) => v <= 22, score: 100 },
          { test: (v) => v <= 24, score: 80 },
          { test: (v) => v <= 26, score: 60 },
        ]);

  const foodScore =
    foodVarPctAvg == null
      ? 0
      : scoreBand(Math.abs(foodVarPctAvg), [
          { test: (v) => v <= 0.5, score: 100 },
          { test: (v) => v <= 1.0, score: 80 },
          { test: (v) => v <= 1.5, score: 60 },
        ]);

  return Math.round(labourScore * 0.6 + foodScore * 0.4);
};

const scoreOsa100 = (starsAvg: number | null, pointsLostAvg: number | null) => {
  if (starsAvg == null && pointsLostAvg == null) return null;

  const starsScore =
    starsAvg == null
      ? 0
      : scoreBand(Math.round(starsAvg), [
          { test: (v) => v >= 5, score: 100 },
          { test: (v) => v >= 4, score: 80 },
          { test: (v) => v >= 3, score: 60 },
        ]);

  const pointsScore =
    pointsLostAvg == null
      ? 0
      : scoreBand(pointsLostAvg, [
          { test: (v) => v <= 10, score: 100 },
          { test: (v) => v <= 20, score: 80 },
          { test: (v) => v <= 30, score: 60 },
        ]);

  return Math.round(starsScore * 0.5 + pointsScore * 0.5);
};

const scoreMpi = (service: number | null, cost: number | null, osa: number | null) => {
  if (service == null && cost == null && osa == null) return null;
  return Math.round((service ?? 0) * 0.5 + (cost ?? 0) * 0.3 + (osa ?? 0) * 0.2);
};

const pillClass = (score: number) => {
  if (score >= 80) return "pill green";
  if (score >= 60) return "pill amber";
  return "pill red";
};

export default function ManagerPerformanceIndexPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [serviceRows, setServiceRows] = useState<ServiceShiftRow[]>([]);
  const [costRows, setCostRows] = useState<CostControlRow[]>([]);
  const [osaRows, setOsaRows] = useState<OsaRow[]>([]);

  const todayIso = useMemo(() => toISODateUK(new Date()), []);
  const yearStartIso = useMemo(() => startOfYearUKISO(), []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const [profilesRes, serviceRes, costRes, osaRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,display_name,store,job_role,approved")
          .eq("approved", true)
          .not("display_name", "is", null),

        supabase
          .from("service_shifts")
          .select(
            "manager_profile_id,shift_date,store,manager,dot_pct,extreme_over_40,rnl_minutes,additional_hours"
          )
          .gte("shift_date", yearStartIso)
          .lte("shift_date", todayIso),

        supabase
          .from("cost_control_entries")
          .select(
            "manager_profile_id,manager_name,store,shift_date,sales_gbp,labour_cost_gbp,ideal_food_cost_gbp,actual_food_cost_gbp"
          )
          .gte("shift_date", yearStartIso)
          .lte("shift_date", todayIso),

        supabase
          .from("osa_internal_results")
          .select("team_member_profile_id,store,shift_date,stars,points_lost")
          .gte("shift_date", yearStartIso)
          .lte("shift_date", todayIso),
      ]);

      const firstError =
        profilesRes.error || serviceRes.error || costRes.error || osaRes.error;

      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setProfiles((profilesRes.data || []) as ProfileRow[]);
      setServiceRows((serviceRes.data || []) as ServiceShiftRow[]);
      setCostRows((costRes.data || []) as CostControlRow[]);
      setOsaRows((osaRes.data || []) as OsaRow[]);
      setLoading(false);
    };

    load();
  }, [todayIso, yearStartIso]);

  const ranked = useMemo<LeaderRow[]>(() => {
    const excludedRoles = new Set(["Area Manager", "OEC"]);

    const profileById = new Map<string, ProfileRow>();
    const profilesByName = new Map<string, ProfileRow[]>();

    for (const p of profiles) {
      profileById.set(p.id, p);
      const name = (p.display_name || "").trim();
      if (!name) continue;
      const k = keyFromName(name);
      const arr = profilesByName.get(k) || [];
      arr.push(p);
      profilesByName.set(k, arr);
    }

    const isExcludedProfile = (p: ProfileRow | undefined | null) => {
      if (!p) return false;
      return excludedRoles.has((p.job_role || "").trim());
    };

    const resolveToProfileIdByName = (rawName: string): string | null => {
      const name = rawName.trim();
      if (!name) return null;
      const nameKey = keyFromName(name);
      const candidates = (profilesByName.get(nameKey) || []).filter((p) => !isExcludedProfile(p));
      // If exactly one match, treat as that profile
      return candidates.length === 1 ? candidates[0].id : null;
    };

    type Bucket = {
      key: string;
      manager: string;
      linkedProfileId: string | null;

      serviceRows: ServiceShiftRow[];
      costRows: CostControlRow[];
      osaRows: OsaRow[];

      stores: Set<string>;
    };

    const buckets = new Map<string, Bucket>();

    const ensureBucket = (key: string, manager: string, linkedProfileId: string | null) => {
      const existing = buckets.get(key);
      if (existing) return existing;
      const b: Bucket = {
        key,
        manager,
        linkedProfileId,
        serviceRows: [],
        costRows: [],
        osaRows: [],
        stores: new Set<string>(),
      };
      buckets.set(key, b);
      return b;
    };

    // Create buckets for linked profiles (excluding roles)
    for (const p of profiles) {
      if (isExcludedProfile(p)) continue;
      const name = (p.display_name || "").trim();
      if (!name) continue;
      ensureBucket(`profile::${p.id}`, name, p.id);
    }

    // SERVICE rows -> profile bucket if possible, else name bucket
    for (const r of serviceRows) {
      const store = (r.store || "").trim();
      const mgrName = (r.manager || "").trim();

      if (r.manager_profile_id && profileById.has(r.manager_profile_id)) {
        const p = profileById.get(r.manager_profile_id)!;
        if (isExcludedProfile(p)) continue;

        const b = ensureBucket(`profile::${p.id}`, (p.display_name || mgrName || "Unknown").trim(), p.id);
        b.serviceRows.push(r);
        if (store) b.stores.add(store);
        continue;
      }

      if (mgrName) {
        const resolvedProfileId = resolveToProfileIdByName(mgrName);
        if (resolvedProfileId) {
          const p = profileById.get(resolvedProfileId);
          if (p && !isExcludedProfile(p)) {
            const b = ensureBucket(`profile::${resolvedProfileId}`, (p.display_name || mgrName).trim(), resolvedProfileId);
            b.serviceRows.push(r);
            if (store) b.stores.add(store);
            continue;
          }
        }

        // fall back to name bucket
        const nameKey = keyFromName(mgrName);
        const b = ensureBucket(`name::${nameKey}`, mgrName, null);
        b.serviceRows.push(r);
        if (store) b.stores.add(store);
      }
    }

    // COST rows -> profile bucket if possible, else name bucket
    for (const r of costRows) {
      const store = (r.store || "").trim();
      const mgrName = (r.manager_name || "").trim();

      if (r.manager_profile_id && profileById.has(r.manager_profile_id)) {
        const p = profileById.get(r.manager_profile_id)!;
        if (isExcludedProfile(p)) continue;

        const b = ensureBucket(`profile::${p.id}`, (p.display_name || mgrName || "Unknown").trim(), p.id);
        b.costRows.push(r);
        if (store) b.stores.add(store);
        continue;
      }

      if (mgrName) {
        const resolvedProfileId = resolveToProfileIdByName(mgrName);
        if (resolvedProfileId) {
          const p = profileById.get(resolvedProfileId);
          if (p && !isExcludedProfile(p)) {
            const b = ensureBucket(`profile::${resolvedProfileId}`, (p.display_name || mgrName).trim(), resolvedProfileId);
            b.costRows.push(r);
            if (store) b.stores.add(store);
            continue;
          }
        }

        // fall back to name bucket
        const nameKey = keyFromName(mgrName);
        const b = ensureBucket(`name::${nameKey}`, mgrName, null);
        b.costRows.push(r);
        if (store) b.stores.add(store);
      }
    }

    // OSA rows: only attach by profile id (unlinked accounts cannot be scored for OSA)
    for (const r of osaRows) {
      if (!r.team_member_profile_id) continue;
      const p = profileById.get(r.team_member_profile_id);
      if (!p || isExcludedProfile(p)) continue;

      const b = ensureBucket(`profile::${p.id}`, (p.display_name || "Unknown").trim(), p.id);
      b.osaRows.push(r);
      const store = (r.store || "").trim();
      if (store) b.stores.add(store);
    }

    const out: LeaderRow[] = [];

    for (const b of buckets.values()) {
      const hasService = b.serviceRows.length > 0;
      const hasCost = b.costRows.length > 0;

      // Exclude anyone who does not have a service OR cost entry
      if (!hasService && !hasCost) continue;

      const dotAvg = avg(
        b.serviceRows
          .map((r) => normalisePct01(r.dot_pct))
          .filter((v): v is number => v != null)
      );
      const extremesAvg = avg(
        b.serviceRows
          .map((r) => normalisePct01(r.extreme_over_40))
          .filter((v): v is number => v != null)
      );
      const rnlAvg = avg(
        b.serviceRows
          .map((r) => normaliseMinutes(r.rnl_minutes))
          .filter((v): v is number => v != null)
      );
      const addHoursAvg = avg(
        b.serviceRows
          .map((r) => (isFiniteNumber(r.additional_hours) ? r.additional_hours : null))
          .filter((v): v is number => v != null)
      );

      const serviceScore = scoreService100(dotAvg, extremesAvg, rnlAvg, addHoursAvg);

      let labourWeightedTotal = 0;
      let labourWeightSum = 0;
      const labourFallback: number[] = [];

      let foodWeightedTotal = 0;
      let foodWeightSum = 0;
      const foodFallback: number[] = [];

      for (const row of b.costRows) {
        const w = weightFromSales(row);

        const labourPct = deriveLabourPct(row);
        if (labourPct != null) {
          if (w != null) {
            labourWeightedTotal += labourPct * w;
            labourWeightSum += w;
          }
          labourFallback.push(labourPct);
        }

        const foodVarPct = deriveFoodVariancePct(row);
        if (foodVarPct != null) {
          if (w != null) {
            foodWeightedTotal += foodVarPct * w;
            foodWeightSum += w;
          }
          foodFallback.push(foodVarPct);
        }
      }

      const labourAvg = labourWeightSum > 0 ? labourWeightedTotal / labourWeightSum : avg(labourFallback);
      const foodVarAvg = foodWeightSum > 0 ? foodWeightedTotal / foodWeightSum : avg(foodFallback);

      const costScore = scoreCost100(labourAvg, foodVarAvg);

      const starsAvg = avg(
        b.osaRows
          .map((r) => (isFiniteNumber(r.stars) ? r.stars : null))
          .filter((v): v is number => v != null)
      );
      const pointsLostAvg = avg(
        b.osaRows
          .map((r) => (isFiniteNumber(r.points_lost) ? r.points_lost : null))
          .filter((v): v is number => v != null)
      );

      const osaScore = scoreOsa100(starsAvg, pointsLostAvg);
      const mpi = scoreMpi(serviceScore, costScore, osaScore);

      const stores = Array.from(b.stores).sort((a, c) => a.localeCompare(c));
      let storeLabel = "-";
      if (stores.length === 1) storeLabel = stores[0];
      else if (stores.length > 1) {
        const shown = stores.slice(0, 2).join(", ");
        storeLabel =
          stores.length <= 2 ? `Multi-store (${shown})` : `Multi-store (${shown} +${stores.length - 2})`;
      }

      out.push({
        key: b.key,
        manager: b.manager || "Unknown",
        storeLabel,
        linkedProfileId: b.linkedProfileId,
        service: serviceScore,
        cost: costScore,
        osa: osaScore,
        mpi,
        stores,
      });
    }

    out.sort((a, b) => (b.mpi ?? -1) - (a.mpi ?? -1) || (b.service ?? -1) - (a.service ?? -1));
    return out;
  }, [profiles, serviceRows, costRows, osaRows]);

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <button onClick={() => router.back()}>← Back</button>
        <button onClick={() => router.push("/")}>🏠 Home</button>
      </div>

      <h1 style={{ margin: 0 }}>Manager Performance Index (YTD)</h1>
      <p style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
        YTD ({yearStartIso} → {todayIso})
      </p>

      {loading ? <p>Loading…</p> : null}
      {error ? <p style={{ color: "#b91c1c", fontWeight: 800 }}>Failed to load: {error}</p> : null}

      {!loading && !error ? (
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 10 }}>Rank</th>
                <th style={{ textAlign: "left", padding: 10 }}>Manager</th>
                <th style={{ textAlign: "left", padding: 10 }}>Store(s)</th>
                <th style={{ textAlign: "right", padding: 10 }}>MPI</th>
                <th style={{ textAlign: "right", padding: 10 }}>Service</th>
                <th style={{ textAlign: "right", padding: 10 }}>Cost</th>
                <th style={{ textAlign: "right", padding: 10 }}>OSA</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, idx) => (
                <tr key={r.key} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ padding: 10, fontWeight: 900 }}>{idx + 1}</td>
                  <td style={{ padding: 10, fontWeight: 900 }}>{r.manager}</td>
                  <td style={{ padding: 10 }}>{r.storeLabel}</td>

                  <td style={{ padding: 10, textAlign: "right" }}>
                    {r.mpi == null ? "—" : <span className={pillClass(r.mpi)}>{r.mpi}</span>}
                  </td>
                  <td style={{ padding: 10, textAlign: "right" }}>
                    {r.service == null ? "—" : <span className={pillClass(r.service)}>{r.service}</span>}
                  </td>
                  <td style={{ padding: 10, textAlign: "right" }}>
                    {r.cost == null ? "—" : <span className={pillClass(r.cost)}>{r.cost}</span>}
                  </td>
                  <td style={{ padding: 10, textAlign: "right" }}>
                    {r.osa == null ? "—" : <span className={pillClass(r.osa)}>{r.osa}</span>}
                  </td>
                </tr>
              ))}

              {ranked.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 12, color: "#64748b", fontWeight: 800 }}>
                    No managers found with Service/Cost entries in this YTD range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      <style jsx>{`
        .pill {
          display: inline-block;
          min-width: 46px;
          text-align: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 900;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #0f172a;
          white-space: nowrap;
        }
        .pill.green {
          background: #e8f7ec;
          border-color: #bbf7d0;
          color: #166534;
        }
        .pill.amber {
          background: #fef3c7;
          border-color: #fde68a;
          color: #92400e;
        }
        .pill.red {
          background: #fee2e2;
          border-color: #fecaca;
          color: #991b1b;
        }
      `}</style>
    </main>
  );
}
