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

  // IMPORTANT: if your column is manager_name instead of manager, rename here + in select().
  manager: string | null;

  dot_pct: number | null;
  extreme_over_40: number | null;
  rnl_minutes: number | null;
  additional_hours: number | null;
};

type CostControlRow = {
  // you confirmed this exists
  manager_profile_id: string | null;

  // also exists in your schema
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
  store: string;
  linkedProfileId: string | null;

  service: number | null;
  cost: number | null;
  osa: number | null;
  mpi: number | null;

  counts: {
    service: number;
    cost: number;
    osa: number;
  };
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
  // accept 82 or 0.82
  return value > 1 ? value / 100 : value;
};

const normaliseMinutes = (value: number | null): number | null => {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const minutes = value > 60 && value <= 3600 ? value / 60 : value;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 120) return null;
  return minutes;
};

const keyFromNameStore = (name: string, store: string) =>
  `${name.trim().toLowerCase()}::${store.trim().toLowerCase()}`;

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

/* -------------------- Scoring (matches your visual rules) -------------------- */

const scoreBand = (value: number, bands: Array<{ test: (v: number) => boolean; score: number }>) => {
  for (const b of bands) if (b.test(value)) return b.score;
  return 0;
};

const scoreService100 = (dotAvg01: number | null, extremesAvg01: number | null, rnlAvgMin: number | null, addHoursAvg: number | null) => {
  // If no service data at all, return null
  if (dotAvg01 == null && extremesAvg01 == null && rnlAvgMin == null && addHoursAvg == null) return null;

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

  // weights: DOT 40%, Extremes 30%, R&L 20%, AddHours 10%
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
  const hasAny = service != null || cost != null || osa != null;
  if (!hasAny) return null;
  return Math.round((service ?? 0) * 0.5 + (cost ?? 0) * 0.3 + (osa ?? 0) * 0.2);
};

/* -------------------- UI helpers -------------------- */

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
    // 1) Build profile lookups + excluded roles
    const excludedRoles = new Set(["Area Manager", "OEC"]);

    const profileById = new Map<string, ProfileRow>();
    const profileByNameStore = new Map<string, ProfileRow>();

    for (const p of profiles) {
      profileById.set(p.id, p);
      const name = (p.display_name || "").trim();
      const store = (p.store || "").trim();
      if (name && store) profileByNameStore.set(keyFromNameStore(name, store), p);
    }

    const isExcludedProfile = (p: ProfileRow | undefined | null) => {
      if (!p) return false;
      const role = (p.job_role || "").trim();
      return excludedRoles.has(role);
    };

    // 2) Buckets for ALL “manager identities”
    type Bucket = {
      key: string;
      manager: string;
      store: string;
      linkedProfileId: string | null;

      serviceRows: ServiceShiftRow[];
      costRows: CostControlRow[];
      osaRows: OsaRow[];
    };

    const buckets = new Map<string, Bucket>();

    const ensureBucket = (key: string, manager: string, store: string, linkedProfileId: string | null) => {
      const existing = buckets.get(key);
      if (existing) return existing;
      const b: Bucket = {
        key,
        manager,
        store,
        linkedProfileId,
        serviceRows: [],
        costRows: [],
        osaRows: [],
      };
      buckets.set(key, b);
      return b;
    };

    // 3) Add buckets from PROFILES first (linked identities)
    for (const p of profiles) {
      if (isExcludedProfile(p)) continue;

      const name = (p.display_name || "").trim();
      const store = (p.store || "-").trim() || "-";
      if (!name) continue;

      const key = `profile::${p.id}`;
      ensureBucket(key, name, store, p.id);
    }

    // 4) Feed SERVICE rows:
    // - if manager_profile_id exists and matches a profile bucket, use it
    // - else fallback to manager name + store
    for (const r of serviceRows) {
      const store = (r.store || "").trim();
      const mgrName = (r.manager || "").trim();

      if (r.manager_profile_id && profileById.has(r.manager_profile_id)) {
        const p = profileById.get(r.manager_profile_id)!;
        if (isExcludedProfile(p)) continue;
        const b = ensureBucket(`profile::${p.id}`, (p.display_name || mgrName || "Unknown").trim(), (p.store || store || "-").trim() || "-", p.id);
        b.serviceRows.push(r);
        continue;
      }

      // fallback identity (unlinked)
      if (mgrName && store) {
        const possibleProfile = profileByNameStore.get(keyFromNameStore(mgrName, store));
        if (isExcludedProfile(possibleProfile)) continue;

        const b = ensureBucket(`name::${keyFromNameStore(mgrName, store)}`, mgrName, store, possibleProfile?.id ?? null);
        b.serviceRows.push(r);
      }
    }

    // 5) Feed COST rows:
    // - use manager_profile_id when valid
    // - else fallback manager_name + store
    for (const r of costRows) {
      const store = (r.store || "").trim();
      const mgrName = (r.manager_name || "").trim();

      if (r.manager_profile_id && profileById.has(r.manager_profile_id)) {
        const p = profileById.get(r.manager_profile_id)!;
        if (isExcludedProfile(p)) continue;

        const b = ensureBucket(`profile::${p.id}`, (p.display_name || mgrName || "Unknown").trim(), (p.store || store || "-").trim() || "-", p.id);
        b.costRows.push(r);
        continue;
      }

      if (mgrName && store) {
        const possibleProfile = profileByNameStore.get(keyFromNameStore(mgrName, store));
        if (isExcludedProfile(possibleProfile)) continue;

        const b = ensureBucket(`name::${keyFromNameStore(mgrName, store)}`, mgrName, store, possibleProfile?.id ?? null);
        b.costRows.push(r);
      }
    }

    // 6) Feed OSA rows (best-effort):
    // We can only confidently attach OSA to a profile if team_member_profile_id matches a profile.
    // If it's actually “manager being assessed”, this will work for linked accounts.
    for (const r of osaRows) {
      if (!r.team_member_profile_id) continue;
      const p = profileById.get(r.team_member_profile_id);
      if (!p) continue;
      if (isExcludedProfile(p)) continue;

      const b = ensureBucket(`profile::${p.id}`, (p.display_name || "Unknown").trim(), (p.store || "-").trim() || "-", p.id);
      b.osaRows.push(r);
    }

    // 7) Convert buckets -> leaderboard rows with scoring
    const out: LeaderRow[] = [];

    for (const b of buckets.values()) {
      // Exclude anyone with NO service AND NO cost (your requirement)
      const hasService = b.serviceRows.length > 0;
      const hasCost = b.costRows.length > 0;
      if (!hasService && !hasCost) continue;

      // SERVICE averages
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

      // COST averages (sales-weighted)
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

      // OSA averages (profile-only unless your table provides manager_name/store)
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

      out.push({
        key: b.key,
        manager: b.manager || "Unknown",
        store: b.store || "-",
        linkedProfileId: b.linkedProfileId,

        service: serviceScore,
        cost: costScore,
        osa: osaScore,
        mpi,

        counts: {
          service: b.serviceRows.length,
          cost: b.costRows.length,
          osa: b.osaRows.length,
        },
      });
    }

    out.sort((a, b) => (b.mpi ?? -1) - (a.mpi ?? -1) || (b.service ?? -1) - (a.service ?? -1));
    return out;
  }, [profiles, serviceRows, costRows, osaRows]);

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
          <button className="navbtn solid" type="button" onClick={() => router.push("/")}>
            🏠 Home
          </button>
        </div>

        <header className="header">
          <h1>Manager Performance Index (YTD)</h1>
          <p className="subtitle">
            Year-to-date leaderboard from <b>Service</b>, <b>Cost Controls</b> and <b>Internal OSA</b>.
            <span className="badge">
              YTD ({yearStartIso} → {todayIso})
            </span>
          </p>
        </header>

        {loading ? <div className="alert">Loading MPI data…</div> : null}
        {error ? <div className="alert error">Failed to load: {error}</div> : null}

        {!loading && !error ? (
          <>
            <section className="section">
              <div className="section-head">
                <h2>Leaderboard</h2>
                <p>
                  Included: approved profiles (excluding Area Manager/OEC) + unlinked managers
                  (name+store) with at least one Service or Cost entry.
                </p>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Manager</th>
                      <th>Store</th>
                      <th>MPI</th>
                      <th>Service</th>
                      <th>Cost</th>
                      <th>OSA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((row, idx) => (
                      <tr key={row.key}>
                        <td style={{ fontWeight: 900 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 900 }}>
                          {row.manager}
                          {row.linkedProfileId ? <span className="mini"> • linked</span> : <span className="mini"> • unlinked</span>}
                        </td>
                        <td>{row.store}</td>

                        <td>
                          {row.mpi == null ? (
                            <span className="pill">—</span>
                          ) : (
                            <span className={pillClass(row.mpi)}>{row.mpi}</span>
                          )}
                        </td>

                        <td>
                          {row.service == null ? (
                            <span className="pill">—</span>
                          ) : (
                            <span className={pillClass(row.service)}>{row.service}</span>
                          )}
                        </td>

                        <td>
                          {row.cost == null ? (
                            <span className="pill">—</span>
                          ) : (
                            <span className={pillClass(row.cost)}>{row.cost}</span>
                          )}
                        </td>

                        <td>
                          {row.osa == null ? (
                            <span className="pill">—</span>
                          ) : (
                            <span className={pillClass(row.osa)}>{row.osa}</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {ranked.length === 0 ? (
                      <tr>
                        <td className="empty" colSpan={7}>
                          No managers found with Service/Cost entries in this YTD range.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="section">
              <div className="section-head">
                <h2>How the points work (simple + visual)</h2>
                <p>Everything is scored out of 100, then combined into MPI.</p>
              </div>

              <div className="card-grid">
                <div className="card">
                  <h3>🏁 MPI Total</h3>
                  <p className="muted">Weighted total</p>
                  <ul className="list">
                    <li><span className="pct">50%</span> Service</li>
                    <li><span className="pct">30%</span> Cost Controls</li>
                    <li><span className="pct">20%</span> Internal OSA</li>
                  </ul>
                  <p className="hint">
                    Fastest way to move MPI: improve <b>Service</b> (it’s half the score).
                  </p>
                </div>

                <div className="card">
                  <h3>🚗 Service (0–100)</h3>
                  <ul className="list">
                    <li><span className="pct">40%</span> DOT% (≥80=100, ≥75=80, ≥70=60)</li>
                    <li><span className="pct">30%</span> Extremes &gt;40 (≤3%=100, ≤5%=80, ≤8%=60)</li>
                    <li><span className="pct">20%</span> R&amp;L mins (≤10=100, ≤15=80, ≤20=60)</li>
                    <li><span className="pct">10%</span> Add. hours (≤1=100, ≤2.5=80, ≤4=60)</li>
                  </ul>
                </div>

                <div className="card">
                  <h3>💷 Cost + ⭐ Internal OSA</h3>

                  <p style={{ margin: "10px 0 6px", fontWeight: 900 }}>Cost Controls (0–100)</p>
                  <ul className="list">
                    <li><span className="pct">60%</span> Labour% (≤22=100, ≤24=80, ≤26=60)</li>
                    <li><span className="pct">40%</span> Food variance% (abs) (≤0.5=100, ≤1.0=80, ≤1.5=60)</li>
                  </ul>

                  <p className="muted" style={{ marginTop: 10 }}>
                    Labour% = <b>labour_cost_gbp ÷ sales_gbp × 100</b><br />
                    Food variance% = <b>(actual − ideal) ÷ sales_gbp × 100</b><br />
                    Averages are <b>sales-weighted</b>.
                  </p>

                  <p style={{ margin: "12px 0 6px", fontWeight: 900 }}>Internal OSA (0–100)</p>
                  <ul className="list">
                    <li><span className="pct">50%</span> Stars (5=100, 4=80, 3=60, &lt;3=0)</li>
                    <li><span className="pct">50%</span> Avg points lost (≤10=100, ≤20=80, ≤30=60, &gt;30=0)</li>
                  </ul>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>

      <footer className="footer">
        <p>© 2026 Mourne-oids | Domino’s Pizza | Racz Group</p>
      </footer>

      <style jsx>{`
        .wrap {
          min-height: 100dvh;
          background: radial-gradient(circle at top, rgba(0, 100, 145, 0.08), transparent 45%),
            linear-gradient(180deg, #e3edf4 0%, #f2f5f9 30%, #f2f5f9 100%);
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
        .topbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .topbar-spacer {
          flex: 1;
        }
        .navbtn {
          border-radius: 14px;
          border: 2px solid #006491;
          background: #fff;
          color: #006491;
          font-weight: 900;
          font-size: 14px;
          padding: 8px 12px;
          cursor: pointer;
          box-shadow: 0 6px 14px rgba(0, 100, 145, 0.12);
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
          font-weight: 900;
          margin: 0;
        }
        .subtitle {
          margin: 6px 0 0;
          color: #64748b;
          font-weight: 700;
          font-size: 0.95rem;
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.1);
          border: 1px solid rgba(0, 100, 145, 0.18);
          color: #004b75;
          font-weight: 900;
          font-size: 12px;
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
          background: rgba(254, 242, 242, 0.9);
          border-color: rgba(239, 68, 68, 0.25);
          color: #7f1d1d;
        }

        .section {
          margin-top: 18px;
        }
        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .section-head h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
        }
        .section-head p {
          margin: 0;
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
          max-width: 680px;
        }

        .table-wrap {
          overflow-x: auto;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
        }
        .table {
          width: 100%;
          border-collapse: collapse;
        }
        .table th,
        .table td {
          padding: 12px;
          text-align: left;
          font-size: 13px;
        }
        .table th {
          background: rgba(0, 100, 145, 0.08);
          font-weight: 900;
        }
        .table tr + tr td {
          border-top: 1px solid rgba(15, 23, 42, 0.06);
        }
        .table td:nth-child(n + 4) {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .empty {
          text-align: left !important;
          color: #475569;
          font-weight: 800;
        }
        .mini {
          font-size: 12px;
          font-weight: 800;
          color: #64748b;
        }

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

        .card-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .card {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 18px;
          border: 1px solid rgba(0, 100, 145, 0.14);
          box-shadow: 0 12px 28px rgba(2, 6, 23, 0.05);
          padding: 12px 14px;
        }
        .card h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
        }
        .muted {
          margin: 6px 0 0;
          color: #64748b;
          font-weight: 700;
          font-size: 12px;
        }
        .list {
          margin: 10px 0 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 8px;
          color: #334155;
          font-weight: 800;
          font-size: 13px;
        }
        .pct {
          display: inline-flex;
          min-width: 52px;
          justify-content: center;
          align-items: center;
          height: 24px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.1);
          border: 1px solid rgba(0, 100, 145, 0.18);
          color: #004b75;
          font-weight: 900;
          font-size: 12px;
          margin-right: 10px;
        }
        .hint {
          margin: 10px 0 0;
          color: #475569;
          font-weight: 800;
          font-size: 12px;
        }

        .footer {
          text-align: center;
          margin-top: 18px;
          color: #94a3b8;
          font-size: 0.8rem;
        }

        @media (max-width: 980px) {
          .section-head {
            flex-direction: column;
            align-items: flex-start;
          }
          .card-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 700px) {
          .shell {
            width: min(1100px, 96vw);
            padding: 14px;
          }
        }
      `}</style>
    </main>
  );
}
