"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** ---------------- Types ---------------- */
type ProfileRow = {
  id: string;
  display_name: string | null;
  store: string | null;
  job_role: string | null;
  approved: boolean | null;
};

type ServiceShiftRow = {
  manager_profile_id: string | null;
  shift_date: string; // YYYY-MM-DD
  dot_pct: number | null; // 0..1 or 0..100
  extreme_over_40: number | null; // 0..1 or 0..100
  rnl_minutes: number | null; // minutes (or seconds sometimes)
  additional_hours: number | null;
};

type CostControlRow = {
  manager_user_id: string | null; // ✅ matches your schema
  shift_date: string; // YYYY-MM-DD

  sales_gbp: number | null;
  labour_cost_gbp: number | null;
  ideal_food_cost_gbp: number | null;
  actual_food_cost_gbp: number | null;
};

type OsaRow = {
  team_member_profile_id: string | null;
  shift_date: string; // YYYY-MM-DD
  stars: number | null; // 0..5
  points_lost: number | null; // number
};

type LeaderRow = {
  profileId: string;
  manager: string;
  store: string;
  service: number | null;
  cost: number | null;
  osa: number | null;
  mpi: number | null;
  // debug
  hasService: boolean;
  hasCost: boolean;
};

/** ---------------- Date helpers (UK) ---------------- */
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

/** ---------------- Numeric helpers ---------------- */
const isFiniteNumber = (n: any): n is number =>
  typeof n === "number" && Number.isFinite(n);

const avg = (values: number[]) =>
  values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;

const normalizePct01 = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return null;
  // supports 0..1 or 0..100
  return value > 1 ? value / 100 : value;
};

const normalizeRackLoadMinutes = (value: number | null) => {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  // supports seconds in some datasets; keep your previous logic
  const minutes = value > 60 && value <= 3600 ? value / 60 : value;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 120) return null;
  return minutes;
};

const safeDiv = (num: number, den: number) => {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
};

/** ---------------- Scoring (threshold-based, easy to understand) ----------------
 * MPI = Service 50% + Cost 30% + Internal OSA 20%
 *
 * OSA score (0-100) = 50% stars mapping + 50% points lost mapping
 * Stars mapping: 5★=100, 4★=80, 3★=60, <3★=0
 * Points lost mapping: ≤10=100, ≤20=80, ≤30=60, >30=0
 *
 * Service score (0-100) = DOT 40% + Extremes>40 30% + R&L 20% + Additional hours 10%
 * DOT mapping: ≥80%=100, ≥75%=80, ≥70%=60 else 0
 * Extremes>40 mapping: ≤3%=100, ≤5%=80, ≤8%=60 else 0
 * R&L mapping: ≤10m=100, ≤15m=80, ≤20m=60 else 0
 * Additional hours mapping: ≤1=100, ≤2.5=80, ≤4=60 else 0
 *
 * Cost score (0-100) = Labour 60% + Food variance 40%
 * Labour mapping: ≤22%=100, ≤24%=80, ≤26%=60 else 0
 * Food variance mapping (absolute %): ≤0.5=100, ≤1.0=80, ≤1.5=60 else 0
 */
const scoreStars = (starsAvg: number | null) => {
  if (starsAvg == null || !Number.isFinite(starsAvg)) return null;
  if (starsAvg >= 5) return 100;
  if (starsAvg >= 4) return 80;
  if (starsAvg >= 3) return 60;
  return 0;
};

const scorePointsLost = (pointsLostAvg: number | null) => {
  if (pointsLostAvg == null || !Number.isFinite(pointsLostAvg)) return null;
  if (pointsLostAvg <= 10) return 100;
  if (pointsLostAvg <= 20) return 80;
  if (pointsLostAvg <= 30) return 60;
  return 0;
};

const scoreDot = (dot01: number | null) => {
  if (dot01 == null || !Number.isFinite(dot01)) return null;
  if (dot01 >= 0.8) return 100;
  if (dot01 >= 0.75) return 80;
  if (dot01 >= 0.7) return 60;
  return 0;
};

const scoreExtremes = (ext01: number | null) => {
  if (ext01 == null || !Number.isFinite(ext01)) return null;
  if (ext01 <= 0.03) return 100;
  if (ext01 <= 0.05) return 80;
  if (ext01 <= 0.08) return 60;
  return 0;
};

const scoreRnl = (minutes: number | null) => {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  if (minutes <= 10) return 100;
  if (minutes <= 15) return 80;
  if (minutes <= 20) return 60;
  return 0;
};

const scoreAdditionalHours = (hours: number | null) => {
  if (hours == null || !Number.isFinite(hours)) return null;
  if (hours <= 1) return 100;
  if (hours <= 2.5) return 80;
  if (hours <= 4) return 60;
  return 0;
};

const scoreLabour = (labourPct: number | null) => {
  if (labourPct == null || !Number.isFinite(labourPct)) return null;
  if (labourPct <= 22) return 100;
  if (labourPct <= 24) return 80;
  if (labourPct <= 26) return 60;
  return 0;
};

const scoreFoodVariance = (foodVariancePct: number | null) => {
  if (foodVariancePct == null || !Number.isFinite(foodVariancePct)) return null;
  const abs = Math.abs(foodVariancePct);
  if (abs <= 0.5) return 100;
  if (abs <= 1.0) return 80;
  if (abs <= 1.5) return 60;
  return 0;
};

const weighted = (pairs: Array<{ v: number | null; w: number }>) => {
  const valid = pairs.filter((p) => p.v != null);
  if (!valid.length) return null;
  const sumW = valid.reduce((s, p) => s + p.w, 0);
  const sum = valid.reduce((s, p) => s + (p.v as number) * p.w, 0);
  return sumW ? sum / sumW : null;
};

const pillClass = (score: number) => {
  if (score >= 80) return "pill green";
  if (score >= 60) return "pill amber";
  return "pill red";
};

/** ---------------- Cost derivations (from your £ fields) ---------------- */
const deriveLabourPct = (row: CostControlRow): number | null => {
  const sales = isFiniteNumber(row.sales_gbp) ? row.sales_gbp : null;
  const labourCost = isFiniteNumber(row.labour_cost_gbp) ? row.labour_cost_gbp : null;
  if (sales == null || labourCost == null) return null;
  const pct = safeDiv(labourCost, sales);
  return pct == null ? null : pct * 100;
};

const deriveFoodVariancePct = (row: CostControlRow): number | null => {
  const sales = isFiniteNumber(row.sales_gbp) ? row.sales_gbp : null;
  const ideal = isFiniteNumber(row.ideal_food_cost_gbp) ? row.ideal_food_cost_gbp : null;
  const actual = isFiniteNumber(row.actual_food_cost_gbp) ? row.actual_food_cost_gbp : null;
  if (sales == null || ideal == null || actual == null) return null;
  const pct = safeDiv(actual - ideal, sales);
  return pct == null ? null : pct * 100;
};

const costSalesWeight = (row: CostControlRow): number | null => {
  const w = isFiniteNumber(row.sales_gbp) ? row.sales_gbp : null;
  return w != null && w > 0 ? w : null;
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
            "manager_profile_id,shift_date,dot_pct,extreme_over_40,rnl_minutes,additional_hours"
          )
          .gte("shift_date", yearStartIso)
          .lte("shift_date", todayIso),

        supabase
          .from("cost_control_entries")
          .select(
            "manager_user_id,shift_date,sales_gbp,labour_cost_gbp,ideal_food_cost_gbp,actual_food_cost_gbp"
          )
          .gte("shift_date", yearStartIso)
          .lte("shift_date", todayIso),

        supabase
          .from("osa_internal_results")
          .select("team_member_profile_id,shift_date,stars,points_lost")
          .gte("shift_date", yearStartIso)
          .lte("shift_date", todayIso),
      ]);

      const firstError = profilesRes.error || serviceRes.error || costRes.error || osaRes.error;

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

  const excludedRoles = useMemo(() => new Set(["Area Manager", "OEC"]), []);

  const leaderboard = useMemo<LeaderRow[]>(() => {
    // Group rows by manager id
    const byManagerService = new Map<string, ServiceShiftRow[]>();
    const byManagerCost = new Map<string, CostControlRow[]>();
    const byManagerOsa = new Map<string, OsaRow[]>();

    for (const row of serviceRows) {
      if (!row.manager_profile_id) continue;
      const existing = byManagerService.get(row.manager_profile_id) || [];
      existing.push(row);
      byManagerService.set(row.manager_profile_id, existing);
    }

    for (const row of costRows) {
      if (!row.manager_user_id) continue;
      const existing = byManagerCost.get(row.manager_user_id) || [];
      existing.push(row);
      byManagerCost.set(row.manager_user_id, existing);
    }

    for (const row of osaRows) {
      if (!row.team_member_profile_id) continue;
      const existing = byManagerOsa.get(row.team_member_profile_id) || [];
      existing.push(row);
      byManagerOsa.set(row.team_member_profile_id, existing);
    }

    // Build list
    const base = profiles
      .filter((p) => {
        // Remove excluded roles
        if (p.job_role && excludedRoles.has(p.job_role)) return false;
        return true;
      })
      .map((profile) => {
        const managerServiceRows = byManagerService.get(profile.id) || [];
        const managerCostRows = byManagerCost.get(profile.id) || [];
        const managerOsaRows = byManagerOsa.get(profile.id) || [];

        const hasService = managerServiceRows.length > 0;
        const hasCost = managerCostRows.length > 0;

        // ✅ New rule: exclude anyone without a Service OR Cost entry
        if (!hasService && !hasCost) {
          return null;
        }

        /** ------- SERVICE ------- */
        const dotVals = managerServiceRows
          .map((r) => normalizePct01(r.dot_pct))
          .filter((v): v is number => v != null);
        const extremesVals = managerServiceRows
          .map((r) => normalizePct01(r.extreme_over_40))
          .filter((v): v is number => v != null);
        const rnlVals = managerServiceRows
          .map((r) => normalizeRackLoadMinutes(r.rnl_minutes))
          .filter((v): v is number => v != null);
        const addHoursVals = managerServiceRows
          .map((r) => (isFiniteNumber(r.additional_hours) ? r.additional_hours : null))
          .filter((v): v is number => v != null);

        const dotAvg = dotVals.length ? avg(dotVals) : null;
        const extremesAvg = extremesVals.length ? avg(extremesVals) : null;
        const rnlAvg = rnlVals.length ? avg(rnlVals) : null;
        const addHoursAvg = addHoursVals.length ? avg(addHoursVals) : null;

        const serviceScore = weighted([
          { v: scoreDot(dotAvg), w: 0.4 },
          { v: scoreExtremes(extremesAvg), w: 0.3 },
          { v: scoreRnl(rnlAvg), w: 0.2 },
          { v: scoreAdditionalHours(addHoursAvg), w: 0.1 },
        ]);

        /** ------- OSA ------- */
        const starsVals = managerOsaRows
          .map((r) => (isFiniteNumber(r.stars) ? r.stars : null))
          .filter((v): v is number => v != null);
        const pointsLostVals = managerOsaRows
          .map((r) => (isFiniteNumber(r.points_lost) ? r.points_lost : null))
          .filter((v): v is number => v != null);

        const starsAvg = starsVals.length ? avg(starsVals) : null;
        const pointsLostAvg = pointsLostVals.length ? avg(pointsLostVals) : null;

        const osaScore = weighted([
          { v: scoreStars(starsAvg), w: 0.5 },
          { v: scorePointsLost(pointsLostAvg), w: 0.5 },
        ]);

        /** ------- COST (sales-weighted) ------- */
        let labourWeightedTotal = 0;
        let labourWeightSum = 0;
        const labourFallback: number[] = [];

        let foodWeightedTotal = 0;
        let foodWeightSum = 0;
        const foodFallback: number[] = [];

        for (const row of managerCostRows) {
          const w = costSalesWeight(row);

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

        const labourYtd =
          labourWeightSum > 0
            ? labourWeightedTotal / labourWeightSum
            : labourFallback.length
              ? avg(labourFallback)
              : null;

        const foodVariancePctYtd =
          foodWeightSum > 0
            ? foodWeightedTotal / foodWeightSum
            : foodFallback.length
              ? avg(foodFallback)
              : null;

        const costScore = weighted([
          { v: scoreLabour(labourYtd), w: 0.6 },
          { v: scoreFoodVariance(foodVariancePctYtd), w: 0.4 },
        ]);

        /** ------- MPI TOTAL ------- */
        const hasAny = serviceScore != null || costScore != null || osaScore != null;

        const mpi = hasAny
          ? Math.round((serviceScore ?? 0) * 0.5 + (costScore ?? 0) * 0.3 + (osaScore ?? 0) * 0.2)
          : null;

        return {
          profileId: profile.id,
          manager: profile.display_name || "Unknown",
          store: profile.store || "-",
          service: serviceScore != null ? Math.round(serviceScore) : null,
          cost: costScore != null ? Math.round(costScore) : null,
          osa: osaScore != null ? Math.round(osaScore) : null,
          mpi,
          hasService,
          hasCost,
        } as LeaderRow;
      })
      .filter((x): x is LeaderRow => x !== null);

    return base;
  }, [profiles, serviceRows, costRows, osaRows, excludedRoles]);

  const ranked = useMemo(
    () =>
      [...leaderboard].sort(
        (a, b) => (b.mpi ?? -1) - (a.mpi ?? -1) || (b.service ?? -1) - (a.service ?? -1)
      ),
    [leaderboard]
  );

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
            <span className="badge">YTD ({yearStartIso} → {todayIso})</span>
          </p>
        </header>

        {loading ? <div className="alert muted">Loading MPI data…</div> : null}
        {error ? (
          <div className="alert error">
            <b>Failed to load:</b> {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <section className="section">
              <div className="section-head">
                <div>
                  <h2>Leaderboard</h2>
                  <p>
                    Included: approved profiles (excluding Area Manager/OEC) with at least one <b>Service</b> or <b>Cost</b> entry.
                  </p>
                </div>
                <div className="kpi-mini">
                  <span className="kpi-chip">
                    <b>{ranked.length}</b> managers
                  </span>
                </div>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Rank</th>
                      <th>Manager</th>
                      <th style={{ width: 170 }}>Store</th>
                      <th style={{ width: 110 }}>MPI</th>
                      <th style={{ width: 110 }}>Service</th>
                      <th style={{ width: 110 }}>Cost</th>
                      <th style={{ width: 110 }}>OSA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((row, idx) => (
                      <tr key={row.profileId}>
                        <td className="rank">{idx + 1}</td>
                        <td className="name">{row.manager}</td>
                        <td className="store">{row.store}</td>

                        <td className="num">
                          {row.mpi == null ? <span className="pill">—</span> : <span className={pillClass(row.mpi)}>{row.mpi}</span>}
                        </td>
                        <td className="num">
                          {row.service == null ? <span className="pill">—</span> : <span className={pillClass(row.service)}>{row.service}</span>}
                        </td>
                        <td className="num">
                          {row.cost == null ? <span className="pill">—</span> : <span className={pillClass(row.cost)}>{row.cost}</span>}
                        </td>
                        <td className="num">
                          {row.osa == null ? <span className="pill">—</span> : <span className={pillClass(row.osa)}>{row.osa}</span>}
                        </td>
                      </tr>
                    ))}

                    {ranked.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty">
                          No eligible managers found (approved + not Area Manager/OEC + has Service or Cost data).
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="section">
              <div className="section-head">
                <div>
                  <h2>How the points work (simple + visual)</h2>
                  <p>Everything is scored out of 100, then combined into MPI.</p>
                </div>
              </div>

              <div className="cards">
                <div className="card">
                  <div className="card-title">🏁 MPI Total</div>
                  <div className="card-body">
                    <div className="rule">
                      <span className="pill neutral">50%</span> Service
                    </div>
                    <div className="rule">
                      <span className="pill neutral">30%</span> Cost Controls
                    </div>
                    <div className="rule">
                      <span className="pill neutral">20%</span> Internal OSA
                    </div>
                    <p className="hint">
                      To move MPI quickly, the biggest lever is <b>Service</b> (half the score).
                    </p>
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">🚗 Service (0–100)</div>
                  <div className="card-body">
                    <div className="rule"><span className="pill neutral">40%</span> DOT% (≥80=100, ≥75=80, ≥70=60)</div>
                    <div className="rule"><span className="pill neutral">30%</span> Extremes &gt;40 (≤3%=100, ≤5%=80, ≤8%=60)</div>
                    <div className="rule"><span className="pill neutral">20%</span> R&amp;L mins (≤10=100, ≤15=80, ≤20=60)</div>
                    <div className="rule"><span className="pill neutral">10%</span> Add. hours (≤1=100, ≤2.5=80, ≤4=60)</div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">💷 Cost + ⭐ Internal OSA</div>
                  <div className="card-body">
                    <div className="subhead">Cost Controls (0–100)</div>
                    <div className="rule"><span className="pill neutral">60%</span> Labour% (≤22=100, ≤24=80, ≤26=60)</div>
                    <div className="rule">
                      <span className="pill neutral">40%</span> Food variance% (abs) (≤0.5=100, ≤1.0=80, ≤1.5=60)
                    </div>
                    <p className="hint">
                      Labour% is calculated as <b>labour_cost_gbp ÷ sales_gbp × 100</b>. Food variance% is{" "}
                      <b>(actual_food_cost_gbp − ideal_food_cost_gbp) ÷ sales_gbp × 100</b>. Averages are sales-weighted.
                    </p>

                    <div className="subhead" style={{ marginTop: 10 }}>Internal OSA (0–100)</div>
                    <div className="rule"><span className="pill neutral">50%</span> Stars: 5★=100, 4★=80, 3★=60, &lt;3★=0</div>
                    <div className="rule"><span className="pill neutral">50%</span> Avg points lost: ≤10=100, ≤20=80, ≤30=60, &gt;30=0</div>
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
        :root {
          --text: #0f172a;
          --muted: #64748b;
          --brand: #006491;
          --shadow: 0 16px 40px rgba(0, 0, 0, 0.05);
        }

        .wrap {
          min-height: 100dvh;
          background: radial-gradient(circle at top, rgba(0, 100, 145, 0.08), transparent 45%),
            linear-gradient(180deg, #e3edf4 0%, #f2f5f9 30%, #f2f5f9 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          color: var(--text);
          padding-bottom: 40px;
        }

        .banner {
          display: flex;
          justify-content: center;
          align-items: center;
          background: #fff;
          border-bottom: 3px solid var(--brand);
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
          box-shadow: var(--shadow);
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
          border: 2px solid var(--brand);
          background: #fff;
          color: var(--brand);
          font-weight: 900;
          font-size: 14px;
          padding: 8px 12px;
          cursor: pointer;
          box-shadow: 0 6px 14px rgba(0, 100, 145, 0.12);
          transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
        }

        .navbtn:hover {
          background: var(--brand);
          color: #fff;
          transform: translateY(-1px);
        }

        .navbtn.solid {
          background: var(--brand);
          color: #fff;
        }

        .navbtn.solid:hover {
          background: #004b75;
          border-color: #004b75;
        }

        .header {
          text-align: center;
          margin-bottom: 12px;
        }

        .header h1 {
          font-size: clamp(2rem, 3vw, 2.3rem);
          font-weight: 900;
          letter-spacing: -0.015em;
          margin: 0;
        }

        .subtitle {
          margin: 8px 0 0;
          color: var(--muted);
          font-weight: 700;
          font-size: 0.95rem;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          font-weight: 900;
          font-size: 12px;
          background: rgba(0, 100, 145, 0.1);
          border: 1px solid rgba(0, 100, 145, 0.25);
          color: #004b75;
          white-space: nowrap;
        }

        .alert {
          margin-top: 14px;
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 800;
        }

        .alert.muted {
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(15, 23, 42, 0.1);
          color: #334155;
        }

        .alert.error {
          background: rgba(254, 242, 242, 0.9);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #7f1d1d;
        }

        .section {
          margin-top: 16px;
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
          margin: 4px 0 0;
          font-size: 12px;
          color: var(--muted);
          font-weight: 800;
        }

        .kpi-mini {
          display: inline-flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
        }

        .kpi-chip {
          font-size: 12px;
          font-weight: 900;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(0, 100, 145, 0.08);
          border: 1px solid rgba(0, 100, 145, 0.14);
          color: #004b75;
          white-space: nowrap;
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

        th,
        td {
          padding: 12px 12px;
          text-align: left;
          font-size: 13px;
        }

        th {
          background: rgba(0, 100, 145, 0.08);
          font-weight: 900;
          letter-spacing: 0.02em;
        }

        tr + tr td {
          border-top: 1px solid rgba(15, 23, 42, 0.06);
        }

        td.num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          font-weight: 900;
        }

        td.rank,
        td.name {
          font-weight: 900;
        }

        td.store {
          font-weight: 800;
          color: #334155;
        }

        .empty {
          padding: 14px;
          color: #64748b;
          font-weight: 800;
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

        .pill.neutral {
          background: rgba(0, 100, 145, 0.1);
          border-color: rgba(0, 100, 145, 0.2);
          color: #004b75;
        }

        .cards {
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

        .card-title {
          font-weight: 900;
          margin-bottom: 8px;
          letter-spacing: -0.01em;
        }

        .card-body {
          display: grid;
          gap: 8px;
          color: #334155;
        }

        .rule {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          font-size: 13px;
          line-height: 1.25;
        }

        .subhead {
          font-weight: 900;
          color: #0f172a;
          margin-top: 2px;
          font-size: 13px;
        }

        .hint {
          margin: 0;
          font-size: 12px;
          color: #64748b;
          font-weight: 800;
          line-height: 1.35;
        }

        .footer {
          text-align: center;
          margin-top: 18px;
          color: #94a3b8;
          font-size: 0.8rem;
        }

        @media (max-width: 980px) {
          .cards {
            grid-template-columns: 1fr;
          }
          .section-head {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
