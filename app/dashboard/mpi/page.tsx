"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { scoreCost, scoreOsa, scoreService } from "@/lib/mpi/scoring";

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
  dot_pct: number | null;
  extreme_over_40: number | null;
  rnl_minutes: number | null;
  additional_hours: number | null;
};

type CostControlRow = {
  manager_profile_id: string | null;
  shift_date: string;
  labour_pct: number | null;
  // support either column name (depending on your schema)
  food_variance?: number | null;
  food_variance_pct?: number | null;
  sales?: number | null;
  sales_total?: number | null;
};

type OsaRow = {
  team_member_profile_id: string | null;
  shift_date: string;
  stars: number | null;
  points_lost: number | null;
};

type LeaderRow = {
  profileId: string;
  manager: string;
  store: string;
  service: number;
  cost: number;
  osa: number;
  mpi: number;
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

const avg = (values: number[]) =>
  values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;

const normalizePct = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return null;
  return value > 1 ? value / 100 : value;
};

const normalizeRackLoadMinutes = (value: number | null) => {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const minutes = value > 60 && value <= 3600 ? value / 60 : value;
  if (!Number.isFinite(minutes)) return null;
  return minutes;
};

const pillClass = (score: number) => {
  if (score >= 80) return "pill green";
  if (score >= 60) return "pill amber";
  return "pill red";
};

export default function ManagerPerformanceIndexPage() {
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
          .select("*")
          .gte("shift_date", yearStartIso)
          .lte("shift_date", todayIso),

        supabase
          .from("osa_internal_results")
          .select("team_member_profile_id,shift_date,stars,points_lost")
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

  const leaderboard = useMemo<LeaderRow[]>(() => {
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
      if (!row.manager_profile_id) continue;
      const existing = byManagerCost.get(row.manager_profile_id) || [];
      existing.push(row);
      byManagerCost.set(row.manager_profile_id, existing);
    }

    for (const row of osaRows) {
      if (!row.team_member_profile_id) continue;
      const existing = byManagerOsa.get(row.team_member_profile_id) || [];
      existing.push(row);
      byManagerOsa.set(row.team_member_profile_id, existing);
    }

    return profiles.map((profile) => {
      const managerServiceRows = byManagerService.get(profile.id) || [];
      const managerCostRows = byManagerCost.get(profile.id) || [];
      const managerOsaRows = byManagerOsa.get(profile.id) || [];

      // ----- SERVICE -----
      const dotAvg = avg(
        managerServiceRows
          .map((r) => normalizePct(r.dot_pct))
          .filter((v): v is number => v != null)
      );
      const extremesAvg = avg(
        managerServiceRows
          .map((r) => normalizePct(r.extreme_over_40))
          .filter((v): v is number => v != null)
      );
      const rnlAvg = avg(
        managerServiceRows
          .map((r) => normalizeRackLoadMinutes(r.rnl_minutes))
          .filter((v): v is number => v != null)
      );
      const additionalHoursAvg = avg(
        managerServiceRows
          .map((r) => r.additional_hours)
          .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      );

      const serviceScore = Math.round(
        scoreService({
          dot: dotAvg,
          extremeOver40: extremesAvg,
          rnlMinutes: rnlAvg,
          additionalHours: additionalHoursAvg,
        }) ?? 0
      );

      // ----- OSA (50% stars, 50% lowest avg points lost) -----
      const starsAvg = avg(
        managerOsaRows
          .map((r) => r.stars)
          .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      );
      const pointsLostAvg = avg(
        managerOsaRows
          .map((r) => r.points_lost)
          .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      );

      const osaScore = Math.round(scoreOsa(starsAvg, pointsLostAvg) ?? 0);

      // ----- COST (sales-weighted if possible) -----
      let labourWeightedTotal = 0;
      let labourWeightSum = 0;
      const labourFallback: number[] = [];

      let foodWeightedTotal = 0;
      let foodWeightSum = 0;
      const foodFallback: number[] = [];

      for (const row of managerCostRows) {
        const salesWeightRaw =
          typeof row.sales_total === "number"
            ? row.sales_total
            : typeof row.sales === "number"
              ? row.sales
              : null;

        const hasWeight =
          typeof salesWeightRaw === "number" &&
          Number.isFinite(salesWeightRaw) &&
          salesWeightRaw > 0;

        if (typeof row.labour_pct === "number" && Number.isFinite(row.labour_pct)) {
          if (hasWeight) {
            labourWeightedTotal += row.labour_pct * salesWeightRaw;
            labourWeightSum += salesWeightRaw;
          }
          labourFallback.push(row.labour_pct);
        }

        const foodVariancePct =
          typeof row.food_variance === "number" && Number.isFinite(row.food_variance)
            ? row.food_variance
            : typeof row.food_variance_pct === "number" &&
                Number.isFinite(row.food_variance_pct)
              ? row.food_variance_pct
              : null;

        if (foodVariancePct != null) {
          if (hasWeight) {
            foodWeightedTotal += foodVariancePct * salesWeightRaw!;
            foodWeightSum += salesWeightRaw!;
          }
          foodFallback.push(foodVariancePct);
        }
      }

      const labourYtd =
        labourWeightSum > 0 ? labourWeightedTotal / labourWeightSum : avg(labourFallback);

      const foodVariancePctYtd =
        foodWeightSum > 0 ? foodWeightedTotal / foodWeightSum : avg(foodFallback);

      const costScore = Math.round(
        scoreCost({ labourPct: labourYtd, foodVariancePct: foodVariancePctYtd }) ?? 0
      );

      // ----- MPI TOTAL -----
      const mpi = Math.round(serviceScore * 0.5 + costScore * 0.3 + osaScore * 0.2);

      return {
        profileId: profile.id,
        manager: profile.display_name || "Unknown",
        store: profile.store || "-",
        service: serviceScore,
        cost: costScore,
        osa: osaScore,
        mpi,
      };
    });
  }, [costRows, osaRows, profiles, serviceRows]);

  const ranked = useMemo(
    () => [...leaderboard].sort((a, b) => b.mpi - a.mpi || b.service - a.service),
    [leaderboard]
  );

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <section style={{ padding: 16 }}>
        <header className="head">
          <div>
            <h1 style={{ margin: 0, fontSize: "1.6rem" }}>
              Manager Performance Index (YTD)
            </h1>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 600 }}>
              Year-to-date leaderboard from Service, Cost Controls and Internal OSA.
            </p>
          </div>
          <span className="badge">
            YTD only ({yearStartIso} to {todayIso})
          </span>
        </header>

        {loading ? <p>Loading MPI data…</p> : null}
        {error ? (
          <p style={{ color: "#dc2626", fontWeight: 700 }}>Failed to load: {error}</p>
        ) : null}

        {!loading && !error ? (
          <div style={{ overflowX: "auto" }}>
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
                  <tr key={row.profileId}>
                    <td style={{ fontWeight: 800 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 800 }}>{row.manager}</td>
                    <td>{row.store}</td>
                    <td>
                      <span className={pillClass(row.mpi)}>{row.mpi}</span>
                    </td>
                    <td>
                      <span className={pillClass(row.service)}>{row.service}</span>
                    </td>
                    <td>
                      <span className={pillClass(row.cost)}>{row.cost}</span>
                    </td>
                    <td>
                      <span className={pillClass(row.osa)}>{row.osa}</span>
                    </td>
                  </tr>
                ))}
                {ranked.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 14, color: "#64748b", fontWeight: 700 }}>
                      No approved profiles found (or no data in range).
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section style={{ marginTop: 16, padding: 16 }}>
        <header style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>How scoring works</h2>
        </header>

        <div style={{ display: "grid", gap: 10, color: "#334155" }}>
          <p style={{ margin: 0 }}>
            <strong>MPI total:</strong> Service 50% + Cost Controls 30% + Internal OSA 20%.
          </p>

          <p style={{ margin: 0 }}>
            <strong>Internal OSA (0–100):</strong> 50% stars and 50% points lost.
            Stars mapping: 5=100, 4=80, 3=60, below 3=0. Points lost mapping:
            ≤10=100, ≤20=80, ≤30=60, &gt;30=0.
          </p>

          <p style={{ margin: 0 }}>
            <strong>Service (0–100):</strong> DOT 40%, extremes &gt;40 30%, R&amp;L minutes 20%,
            additional hours 10%. Thresholds: DOT (≥80%=100, ≥75%=80, ≥70%=60),
            extremes &gt;40 (≤3%=100, ≤5%=80, ≤8%=60), R&amp;L (≤10=100, ≤15=80, ≤20=60),
            additional hours (≤1=100, ≤2.5=80, ≤4=60).
          </p>

          <p style={{ margin: 0 }}>
            <strong>Cost Controls (0–100):</strong> Labour score 60% + food variance score 40%.
            Labour thresholds: ≤22%=100, ≤24%=80, ≤26%=60. Food variance uses absolute value:
            ≤0.5=100, ≤1.0=80, ≤1.5=60. YTD uses sales-weighted averages when sales/sales_total
            is present; otherwise simple averages are used.
          </p>
        </div>
      </section>

      <style jsx>{`
        .head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
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

        .table {
          width: 100%;
          border-collapse: collapse;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }

        .table th,
        .table td {
          padding: 12px 12px;
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
