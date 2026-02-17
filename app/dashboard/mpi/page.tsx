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
  manager: string | null; // manager name text column
  dot_pct: number | null;
  extreme_over_40: number | null;
  rnl_minutes: number | null;
  additional_hours: number | null;
};

type CostControlRow = {
  manager_profile_id: string | null;
  manager_name: string | null; // manager name text column
  store: string | null;
  shift_date: string;

  sales_gbp: number | null;
  labour_cost_gbp: number | null;
  ideal_food_cost_gbp: number | null;
  actual_food_cost_gbp: number | null;
};

type OsaRow = {
  team_member_profile_id: string | null;
  team_member_name: string | null; // ✅ matches your schema
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
  isUnlinked: boolean;
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

        // ✅ now includes team_member_name
        supabase
          .from("osa_internal_results")
          .select("team_member_profile_id,team_member_name,store,shift_date,stars,points_lost")
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

    // Only auto-resolve to a profile when the name is unique among non-excluded profiles.
    const resolveToProfileIdByName = (rawName: string): string | null => {
      const name = rawName.trim();
      if (!name) return null;
      const nameKey = keyFromName(name);
      const candidates = (profilesByName.get(nameKey) || []).filter((p) => !isExcludedProfile(p));
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
      isUnlinked: boolean;
    };

    const buckets = new Map<string, Bucket>();

    const ensureBucket = (
      key: string,
      manager: string,
      linkedProfileId: string | null,
      isUnlinked: boolean
    ) => {
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
        isUnlinked,
      };
      buckets.set(key, b);
      return b;
    };

    // Create buckets for approved profiles (excluding roles)
    for (const p of profiles) {
      if (isExcludedProfile(p)) continue;
      const name = (p.display_name || "").trim();
      if (!name) continue;
      ensureBucket(`profile::${p.id}`, name, p.id, false);
    }

    // SERVICE: attach by profile_id else by name
    for (const r of serviceRows) {
      const store = (r.store || "").trim();
      const mgrName = (r.manager || "").trim();

      if (r.manager_profile_id && profileById.has(r.manager_profile_id)) {
        const p = profileById.get(r.manager_profile_id)!;
        if (isExcludedProfile(p)) continue;

        const b = ensureBucket(
          `profile::${p.id}`,
          (p.display_name || mgrName || "Unknown").trim(),
          p.id,
          false
        );
        b.serviceRows.push(r);
        if (store) b.stores.add(store);
        continue;
      }

      if (mgrName) {
        const resolvedProfileId = resolveToProfileIdByName(mgrName);
        if (resolvedProfileId) {
          const p = profileById.get(resolvedProfileId);
          if (p && !isExcludedProfile(p)) {
            const b = ensureBucket(
              `profile::${resolvedProfileId}`,
              (p.display_name || mgrName).trim(),
              resolvedProfileId,
              false
            );
            b.serviceRows.push(r);
            if (store) b.stores.add(store);
            continue;
          }
        }

        const nameKey = keyFromName(mgrName);
        const b = ensureBucket(`name::${nameKey}`, mgrName, null, true);
        b.serviceRows.push(r);
        if (store) b.stores.add(store);
      }
    }

    // COST: attach by profile_id else by name
    for (const r of costRows) {
      const store = (r.store || "").trim();
      const mgrName = (r.manager_name || "").trim();

      if (r.manager_profile_id && profileById.has(r.manager_profile_id)) {
        const p = profileById.get(r.manager_profile_id)!;
        if (isExcludedProfile(p)) continue;

        const b = ensureBucket(
          `profile::${p.id}`,
          (p.display_name || mgrName || "Unknown").trim(),
          p.id,
          false
        );
        b.costRows.push(r);
        if (store) b.stores.add(store);
        continue;
      }

      if (mgrName) {
        const resolvedProfileId = resolveToProfileIdByName(mgrName);
        if (resolvedProfileId) {
          const p = profileById.get(resolvedProfileId);
          if (p && !isExcludedProfile(p)) {
            const b = ensureBucket(
              `profile::${resolvedProfileId}`,
              (p.display_name || mgrName).trim(),
              resolvedProfileId,
              false
            );
            b.costRows.push(r);
            if (store) b.stores.add(store);
            continue;
          }
        }

        const nameKey = keyFromName(mgrName);
        const b = ensureBucket(`name::${nameKey}`, mgrName, null, true);
        b.costRows.push(r);
        if (store) b.stores.add(store);
      }
    }

    // ✅ OSA: attach by profile_id OR by team_member_name (for unlinked)
    for (const r of osaRows) {
      const store = (r.store || "").trim();

      if (r.team_member_profile_id && profileById.has(r.team_member_profile_id)) {
        const p = profileById.get(r.team_member_profile_id)!;
        if (isExcludedProfile(p)) continue;

        const b = ensureBucket(
          `profile::${p.id}`,
          (p.display_name || r.team_member_name || "Unknown").trim(),
          p.id,
          false
        );
        b.osaRows.push(r);
        if (store) b.stores.add(store);
        continue;
      }

      const name = (r.team_member_name || "").trim();
      if (!name) continue;

      const resolvedProfileId = resolveToProfileIdByName(name);
      if (resolvedProfileId) {
        const p = profileById.get(resolvedProfileId);
        if (p && !isExcludedProfile(p)) {
          const b = ensureBucket(
            `profile::${resolvedProfileId}`,
            (p.display_name || name).trim(),
            resolvedProfileId,
            false
          );
          b.osaRows.push(r);
          if (store) b.stores.add(store);
          continue;
        }
      }

      const nameKey = keyFromName(name);
      const b = ensureBucket(`name::${nameKey}`, name, null, true);
      b.osaRows.push(r);
      if (store) b.stores.add(store);
    }

    const out: LeaderRow[] = [];

    for (const b of buckets.values()) {
      const hasService = b.serviceRows.length > 0;
      const hasCost = b.costRows.length > 0;

      // Exclude anyone who does not have a service OR cost entry
      if (!hasService && !hasCost) continue;

      // SERVICE
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

      // COST (sales-weighted)
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

      const labourAvg =
        labourWeightSum > 0 ? labourWeightedTotal / labourWeightSum : avg(labourFallback);
      const foodVarAvg =
        foodWeightSum > 0 ? foodWeightedTotal / foodWeightSum : avg(foodFallback);

      const costScore = scoreCost100(labourAvg, foodVarAvg);

      // OSA (now supports name-linked rows)
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
          stores.length <= 2
            ? `Multi-store (${shown})`
            : `Multi-store (${shown} +${stores.length - 2})`;
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
        isUnlinked: b.isUnlinked,
      });
    }

    out.sort(
      (a, b) => (b.mpi ?? -1) - (a.mpi ?? -1) || (b.service ?? -1) - (a.service ?? -1)
    );
    return out;
  }, [profiles, serviceRows, costRows, osaRows]);

  return (
    <main className="wrap">
      <div className="banner">
        <img src="/mourneoids_forms_header_1600x400.png" alt="Mourne-oids Header Banner" />
      </div>

      <div className="shell">
        <div className="topbar">
          <button className="navbtn" type="button" onClick={() => router.back()}>
            ← Back
          </button>
          <div className="topbar-spacer" />
          <button className="navbtn solid" type="button" onClick={() => router.push("/")}>
            🏠 Home
          </button>
        </div>

        <header className="header">
          <h1>Manager Performance Index (YTD)</h1>
          <p className="subtitle">
            Year-to-date leaderboard from <b>Service</b>, <b>Cost Controls</b> and <b>Internal OSA</b>.
            <span className="badge">YTD: {yearStartIso} → {todayIso}</span>
          </p>
        </header>

        {loading && <div className="alert">Loading Mourne-oids MPI…</div>}
        {error && <div className="alert error">Error: {error}</div>}

        {!loading && !error ? (
          <>
            <section className="section">
              <div className="section-head">
                <h2>Leaderboard</h2>
                <p>MPI = 50% Service + 30% Cost + 20% OSA</p>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Manager</th>
                      <th style={{ textAlign: "right" }}>MPI</th>
                      <th style={{ textAlign: "right" }}>Service</th>
                      <th style={{ textAlign: "right" }}>Cost</th>
                      <th style={{ textAlign: "right" }}>OSA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((r, idx) => (
                      <tr key={r.key}>
                        <td style={{ fontWeight: 900 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 900 }}>
                          {r.manager}
                          {r.isUnlinked ? (
                            <span
                              className="tiny-note"
                              title="This manager has no linked profile yet. Data is matched by name."
                            >
                              {" "}
                              (unlinked)
                            </span>
                          ) : null}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {r.mpi == null ? (
                            <span className="pill">—</span>
                          ) : (
                            <span className={pillClass(r.mpi)}>{r.mpi}</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {r.service == null ? (
                            <span className="pill">—</span>
                          ) : (
                            <span className={pillClass(r.service)}>{r.service}</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {r.cost == null ? (
                            <span className="pill">—</span>
                          ) : (
                            <span className={pillClass(r.cost)}>{r.cost}</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {r.osa == null ? (
                            <span className="pill">—</span>
                          ) : (
                            <span className={pillClass(r.osa)}>{r.osa}</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {ranked.length === 0 ? (
                      <tr>
                        <td className="empty" colSpan={6}>
                          No managers found with Service or Cost entries in this YTD range.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="section">
              <div className="section-head">
                <h2>How scoring works</h2>
                <p>Simple “do this to improve” rules</p>
              </div>

              <div className="cards">
                <div className="card">
                  <div className="card-title">MPI (Total)</div>
                  <div className="card-body">
                    <p><b>50%</b> Service + <b>30%</b> Cost Controls + <b>20%</b> Internal OSA</p>
                    <p className="muted">Raise the biggest lever first: Service.</p>
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">Service (0–100)</div>
                  <div className="card-body">
                    <p><b>DOT (40%)</b>: 80%+ = 100, 75%+ = 80, 70%+ = 60</p>
                    <p><b>Extremes &gt;40 (30%)</b>: ≤3% = 100, ≤5% = 80, ≤8% = 60</p>
                    <p><b>R&amp;L mins (20%)</b>: ≤10 = 100, ≤15 = 80, ≤20 = 60</p>
                    <p><b>Additional hours (10%)</b>: ≤1 = 100, ≤2.5 = 80, ≤4 = 60</p>
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">Cost Controls (0–100)</div>
                  <div className="card-body">
                    <p><b>Labour (60%)</b>: ≤22% = 100, ≤24% = 80, ≤26% = 60</p>
                    <p><b>Food variance (40%)</b> (absolute): ≤0.5 = 100, ≤1.0 = 80, ≤1.5 = 60</p>
                    <p className="muted">Calculated from £ fields and sales-weighted across the year.</p>
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">Internal OSA (0–100)</div>
                  <div className="card-body">
                    <p><b>50%</b> Stars + <b>50%</b> Points Lost</p>
                    <p><b>Stars</b>: 5★=100, 4★=80, 3★=60, &lt;3★=0</p>
                    <p><b>Points lost</b>: ≤10=100, ≤20=80, ≤30=60, &gt;30=0</p>
                    <p className="muted">OSA can now score unlinked managers via <code>team_member_name</code>.</p>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>

      <footer className="footer">
        <p>© 2025 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>

      <style jsx>{`
        .wrap {
          min-height: 100dvh;
          background: radial-gradient(circle at top, rgba(0,100,145,0.08), transparent 45%),
            linear-gradient(180deg,#e3edf4 0%,#f2f5f9 30%,#f2f5f9 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          color: #0f172a;
          padding-bottom: 40px;
        }
        .banner {
          display: flex;
          justify-content: center;
          align-items: center;
          background: #fff;
          border-bottom: 3px solid #006491;
          box-shadow: 0 12px 35px rgba(2, 6, 23, 0.08);
          width: 100%;
        }
        .banner img {
          max-width: min(1160px, 92%);
          height: auto;
          display: block;
        }
        .shell {
          width: min(1100px, 94vw);
          margin-top: 18px;
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: saturate(160%) blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 1.5rem;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.05);
          padding: 18px 22px 26px;
        }
        .topbar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
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
          box-shadow: 0 6px 14px rgba(0,100,145,0.12);
        }
        .navbtn.solid { background: #006491; color: #fff; }
        .header { text-align: center; margin-bottom: 12px; }
        .header h1 { font-size: clamp(2rem, 3vw, 2.3rem); font-weight: 900; margin: 0; }
        .subtitle { margin: 6px 0 0; color: #64748b; font-weight: 700; font-size: 0.95rem; }
        .badge {
          display: inline-flex;
          align-items: center;
          height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(0,100,145,0.1);
          border: 1px solid rgba(0,100,145,0.18);
          color: #004b75;
          font-weight: 800;
          font-size: 12px;
          margin-left: 8px;
          white-space: nowrap;
        }
        .alert {
          margin-top: 12px;
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(15, 23, 42, 0.1);
          color: #334155;
        }
        .alert.error {
          background: rgba(254,242,242,0.9);
          border-color: rgba(239,68,68,0.25);
          color: #7f1d1d;
        }
        .section { margin-top: 18px; }
        .section-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; margin-bottom: 10px; }
        .section-head h2 { margin: 0; font-size: 15px; font-weight: 900; }
        .section-head p { margin: 0; font-size: 12px; color: #64748b; font-weight: 700; }
        .table-wrap {
          overflow-x: auto;
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,0.08);
          background: rgba(255,255,255,0.9);
          box-shadow: 0 12px 28px rgba(2,6,23,0.05);
        }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { padding: 12px; text-align: left; font-size: 13px; }
        .table th { background: rgba(0,100,145,0.08); font-weight: 900; }
        .table tr + tr td { border-top: 1px solid rgba(15,23,42,0.06); }
        .table td.empty { text-align: left !important; color: #475569; font-weight: 800; padding: 16px; }
        .pill {
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(241,245,249,.9);
          color: #334155;
          white-space: nowrap;
          display: inline-block;
        }
        .pill.green { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.25); color: #166534; }
        .pill.amber { background: rgba(245,158,11,0.14); border-color: rgba(245,158,11,0.28); color: #92400e; }
        .pill.red { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.26); color: #991b1b; }
        .tiny-note { font-size: 12px; font-weight: 800; color: #64748b; }
        .cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .card {
          background: rgba(255,255,255,0.92);
          border-radius: 18px;
          border: 1px solid rgba(0,100,145,0.14);
          box-shadow: 0 12px 28px rgba(2,6,23,0.05);
          padding: 12px 14px;
        }
        .card-title { font-weight: 900; font-size: 14px; margin-bottom: 6px; }
        .card-body p { margin: 6px 0; color: #334155; font-weight: 700; font-size: 13px; }
        .muted { color: #64748b !important; font-weight: 700; }
        .footer { text-align: center; margin-top: 18px; color: #94a3b8; font-size: 0.8rem; }
        @media (max-width: 980px) { .section-head { flex-direction: column; align-items: flex-start; } .cards { grid-template-columns: 1fr; } }
        @media (max-width: 700px) { .shell { width: min(1100px, 96vw); padding: 14px; } }
      `}</style>
    </main>
  );
}
