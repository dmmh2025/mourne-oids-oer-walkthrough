"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/utils/supabase/client";

const supabase = getSupabaseClient();

type Profile = {
  id: string;
  email: string | null;
  job_role: string | null;
  store: string | null;
};

type MetricPair = { mtd: number | null; ytd: number | null };

type ProfilePerformance = {
  service: {
    dot: MetricPair;
    extreme: MetricPair;
    rnl: MetricPair;
    additionalHours: MetricPair;
  };
  costControl: {
    labour: MetricPair;
    foodVariance: MetricPair;
  };
  internalOsa: {
    visits: MetricPair;
    averageScore: MetricPair;
  };
  walkthrough: {
    completed: MetricPair;
    latestCompletionDate: string | null;
  };
};

const EMPTY_PERFORMANCE: ProfilePerformance = {
  service: {
    dot: { mtd: null, ytd: null },
    extreme: { mtd: null, ytd: null },
    rnl: { mtd: null, ytd: null },
    additionalHours: { mtd: 0, ytd: 0 },
  },
  costControl: {
    labour: { mtd: null, ytd: null },
    foodVariance: { mtd: null, ytd: null },
  },
  internalOsa: {
    visits: { mtd: 0, ytd: 0 },
    averageScore: { mtd: null, ytd: null },
  },
  walkthrough: {
    completed: { mtd: 0, ytd: 0 },
    latestCompletionDate: null,
  },
};

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const startOfYear = () => {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
};

const toNumber = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const getDate = (value: unknown): Date | null => {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

const toPctDisplay = (value: number | null) => {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
};

const toNumberDisplay = (value: number | null, decimals = 2) => {
  if (value == null) return "—";
  return value.toFixed(decimals);
};

const toDateDisplay = (value: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function ProfilesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [performanceByProfile, setPerformanceByProfile] = useState<
    Record<string, ProfilePerformance>
  >({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const monthStart = startOfMonth();
      const yearStart = startOfYear();
      const now = new Date();

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, job_role, store")
        .order("store", { ascending: true })
        .order("email", { ascending: true });

      if (profilesError) {
        setError(profilesError.message);
        setLoading(false);
        return;
      }

      const profileRows = (profilesData || []) as Profile[];
      const profileIds = new Set(profileRows.map((p) => p.id));

      const [serviceRes, costRes, osaRes, walkthroughRes] = await Promise.all([
        supabase
          .from("service_shifts")
          .select("*")
          .not("manager_profile_id", "is", null),
        supabase
          .from("cost_control_entries")
          .select("*")
          .not("manager_profile_id", "is", null),
        supabase
          .from("osa_internal_results")
          .select("*")
          .not("team_member_profile_id", "is", null),
        supabase
          .from("walkthrough_submissions")
          .select("*")
          .not("manager_profile_id", "is", null),
      ]);

      const perfMap: Record<string, ProfilePerformance> = {};
      for (const profile of profileRows) {
        perfMap[profile.id] = structuredClone(EMPTY_PERFORMANCE);
      }

      if (serviceRes.error || costRes.error || osaRes.error || walkthroughRes.error) {
        setError(
          serviceRes.error?.message ||
            costRes.error?.message ||
            osaRes.error?.message ||
            walkthroughRes.error?.message ||
            "Failed to load performance data"
        );
        setProfiles(profileRows);
        setPerformanceByProfile(perfMap);
        setLoading(false);
        return;
      }

      const serviceAcc: Record<
        string,
        {
          dotMtdTotal: number;
          dotMtdCount: number;
          dotYtdTotal: number;
          dotYtdCount: number;
          extremeMtdTotal: number;
          extremeMtdCount: number;
          extremeYtdTotal: number;
          extremeYtdCount: number;
          rnlMtdTotal: number;
          rnlMtdCount: number;
          rnlYtdTotal: number;
          rnlYtdCount: number;
          addHoursMtd: number;
          addHoursYtd: number;
        }
      > = {};

      for (const row of (serviceRes.data || []) as any[]) {
        const profileId = row.manager_profile_id as string | undefined;
        if (!profileId || !profileIds.has(profileId)) continue;

        const rowDate = getDate(row.shift_date);
        if (!rowDate || rowDate > now) continue;

        if (!serviceAcc[profileId]) {
          serviceAcc[profileId] = {
            dotMtdTotal: 0,
            dotMtdCount: 0,
            dotYtdTotal: 0,
            dotYtdCount: 0,
            extremeMtdTotal: 0,
            extremeMtdCount: 0,
            extremeYtdTotal: 0,
            extremeYtdCount: 0,
            rnlMtdTotal: 0,
            rnlMtdCount: 0,
            rnlYtdTotal: 0,
            rnlYtdCount: 0,
            addHoursMtd: 0,
            addHoursYtd: 0,
          };
        }

        const acc = serviceAcc[profileId];
        const dot = toNumber(row.dot_pct);
        const extreme = toNumber(row.extreme_pct ?? row.extreme_over_40);
        const rnl = toNumber(row.rnl_minutes ?? row.rn1_minutes);
        const addHours = toNumber(row.additional_hours) ?? 0;

        if (rowDate >= yearStart) {
          if (dot != null) {
            acc.dotYtdTotal += dot;
            acc.dotYtdCount += 1;
          }
          if (extreme != null) {
            acc.extremeYtdTotal += extreme;
            acc.extremeYtdCount += 1;
          }
          if (rnl != null) {
            acc.rnlYtdTotal += rnl;
            acc.rnlYtdCount += 1;
          }
          acc.addHoursYtd += addHours;
        }

        if (rowDate >= monthStart) {
          if (dot != null) {
            acc.dotMtdTotal += dot;
            acc.dotMtdCount += 1;
          }
          if (extreme != null) {
            acc.extremeMtdTotal += extreme;
            acc.extremeMtdCount += 1;
          }
          if (rnl != null) {
            acc.rnlMtdTotal += rnl;
            acc.rnlMtdCount += 1;
          }
          acc.addHoursMtd += addHours;
        }
      }

      Object.entries(serviceAcc).forEach(([profileId, acc]) => {
        perfMap[profileId].service = {
          dot: {
            mtd: acc.dotMtdCount ? acc.dotMtdTotal / acc.dotMtdCount : null,
            ytd: acc.dotYtdCount ? acc.dotYtdTotal / acc.dotYtdCount : null,
          },
          extreme: {
            mtd: acc.extremeMtdCount
              ? acc.extremeMtdTotal / acc.extremeMtdCount
              : null,
            ytd: acc.extremeYtdCount
              ? acc.extremeYtdTotal / acc.extremeYtdCount
              : null,
          },
          rnl: {
            mtd: acc.rnlMtdCount ? acc.rnlMtdTotal / acc.rnlMtdCount : null,
            ytd: acc.rnlYtdCount ? acc.rnlYtdTotal / acc.rnlYtdCount : null,
          },
          additionalHours: {
            mtd: acc.addHoursMtd,
            ytd: acc.addHoursYtd,
          },
        };
      });

      const costAcc: Record<
        string,
        {
          labourMtdWeighted: number;
          labourYtdWeighted: number;
          foodMtdWeighted: number;
          foodYtdWeighted: number;
          salesMtd: number;
          salesYtd: number;
        }
      > = {};

      for (const row of (costRes.data || []) as any[]) {
        const profileId = row.manager_profile_id as string | undefined;
        if (!profileId || !profileIds.has(profileId)) continue;

        const rowDate = getDate(row.shift_date);
        if (!rowDate || rowDate > now) continue;

        if (!costAcc[profileId]) {
          costAcc[profileId] = {
            labourMtdWeighted: 0,
            labourYtdWeighted: 0,
            foodMtdWeighted: 0,
            foodYtdWeighted: 0,
            salesMtd: 0,
            salesYtd: 0,
          };
        }

        const acc = costAcc[profileId];
        const sales = toNumber(row.sales ?? row.sales_gbp) ?? 0;
        const labour = toNumber(row.labour_pct);
        const foodVariance = toNumber(row.food_variance_pct);

        if (rowDate >= yearStart) {
          acc.salesYtd += sales;
          if (labour != null) acc.labourYtdWeighted += labour * sales;
          if (foodVariance != null) acc.foodYtdWeighted += foodVariance * sales;
        }

        if (rowDate >= monthStart) {
          acc.salesMtd += sales;
          if (labour != null) acc.labourMtdWeighted += labour * sales;
          if (foodVariance != null) acc.foodMtdWeighted += foodVariance * sales;
        }
      }

      Object.entries(costAcc).forEach(([profileId, acc]) => {
        perfMap[profileId].costControl = {
          labour: {
            mtd: acc.salesMtd > 0 ? acc.labourMtdWeighted / acc.salesMtd : null,
            ytd: acc.salesYtd > 0 ? acc.labourYtdWeighted / acc.salesYtd : null,
          },
          foodVariance: {
            mtd: acc.salesMtd > 0 ? acc.foodMtdWeighted / acc.salesMtd : null,
            ytd: acc.salesYtd > 0 ? acc.foodYtdWeighted / acc.salesYtd : null,
          },
        };
      });

      const osaAcc: Record<
        string,
        {
          visitsMtd: number;
          visitsYtd: number;
          scoreMtdTotal: number;
          scoreMtdCount: number;
          scoreYtdTotal: number;
          scoreYtdCount: number;
        }
      > = {};

      for (const row of (osaRes.data || []) as any[]) {
        const profileId = row.team_member_profile_id as string | undefined;
        if (!profileId || !profileIds.has(profileId)) continue;

        const rowDate = getDate(row.visit_date ?? row.shift_date ?? row.date);
        if (!rowDate || rowDate > now) continue;

        if (!osaAcc[profileId]) {
          osaAcc[profileId] = {
            visitsMtd: 0,
            visitsYtd: 0,
            scoreMtdTotal: 0,
            scoreMtdCount: 0,
            scoreYtdTotal: 0,
            scoreYtdCount: 0,
          };
        }

        const acc = osaAcc[profileId];
        const directScore = toNumber(row.score);
        const startingPoints = toNumber(row.starting_points);
        const pointsLost = toNumber(row.points_lost);
        const calculatedScore =
          startingPoints != null && pointsLost != null
            ? startingPoints - pointsLost
            : null;
        const score = directScore ?? calculatedScore;

        if (rowDate >= yearStart) {
          acc.visitsYtd += 1;
          if (score != null) {
            acc.scoreYtdTotal += score;
            acc.scoreYtdCount += 1;
          }
        }

        if (rowDate >= monthStart) {
          acc.visitsMtd += 1;
          if (score != null) {
            acc.scoreMtdTotal += score;
            acc.scoreMtdCount += 1;
          }
        }
      }

      Object.entries(osaAcc).forEach(([profileId, acc]) => {
        perfMap[profileId].internalOsa = {
          visits: { mtd: acc.visitsMtd, ytd: acc.visitsYtd },
          averageScore: {
            mtd: acc.scoreMtdCount ? acc.scoreMtdTotal / acc.scoreMtdCount : null,
            ytd: acc.scoreYtdCount ? acc.scoreYtdTotal / acc.scoreYtdCount : null,
          },
        };
      });

      for (const row of (walkthroughRes.data || []) as any[]) {
        const profileId = row.manager_profile_id as string | undefined;
        if (!profileId || !profileIds.has(profileId)) continue;

        const rowDate = getDate(row.submitted_at ?? row.created_at ?? row.shift_date);
        if (!rowDate || rowDate > now) continue;

        const perf = perfMap[profileId].walkthrough;
        if (rowDate >= yearStart) perf.completed.ytd = (perf.completed.ytd || 0) + 1;
        if (rowDate >= monthStart) perf.completed.mtd = (perf.completed.mtd || 0) + 1;

        if (!perf.latestCompletionDate || rowDate > new Date(perf.latestCompletionDate)) {
          perf.latestCompletionDate = rowDate.toISOString();
        }
      }

      setProfiles(profileRows);
      setPerformanceByProfile(perfMap);
      setLoading(false);
    };

    load();
  }, []);

  const sortedProfiles = useMemo(
    () =>
      [...profiles].sort((a, b) => {
        const byStore = (a.store || "").localeCompare(b.store || "");
        if (byStore !== 0) return byStore;
        return (a.email || "").localeCompare(b.email || "");
      }),
    [profiles]
  );

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
          <button className="btn btn--ghost" onClick={() => window.history.back()}>
            ← Back
          </button>
          <h1>Profiles Performance</h1>
          <a href="/" className="btn btn--brand">
            🏠 Home
          </a>
        </div>

        {loading ? <div className="card">Loading profile performance…</div> : null}
        {error ? <div className="card error">❌ {error}</div> : null}

        {!loading && !error ? (
          <section className="profiles-grid">
            {sortedProfiles.map((profile) => {
              const perf = performanceByProfile[profile.id] || EMPTY_PERFORMANCE;
              return (
                <article key={profile.id} className="card perf-card">
                  <div className="profile-head">
                    <h2>{profile.email || "No email"}</h2>
                    <p>
                      {profile.job_role || "No role"} · {profile.store || "No store"}
                    </p>
                  </div>

                  <div className="metrics-grid">
                    <section className="panel">
                      <h3>SERVICE</h3>
                      <p>
                        DOT: {toPctDisplay(perf.service.dot.mtd)} /{" "}
                        {toPctDisplay(perf.service.dot.ytd)}
                      </p>
                      <p>
                        EXTREME: {toPctDisplay(perf.service.extreme.mtd)} /{" "}
                        {toPctDisplay(perf.service.extreme.ytd)}
                      </p>
                      <p>
                        R&amp;L: {toNumberDisplay(perf.service.rnl.mtd)} /{" "}
                        {toNumberDisplay(perf.service.rnl.ytd)}
                      </p>
                      <p>
                        Additional Hours: {toNumberDisplay(perf.service.additionalHours.mtd)}{" "}
                        / {toNumberDisplay(perf.service.additionalHours.ytd)}
                      </p>
                    </section>

                    <section className="panel">
                      <h3>COST CONTROL</h3>
                      <p>
                        Labour %: {toPctDisplay(perf.costControl.labour.mtd)} /{" "}
                        {toPctDisplay(perf.costControl.labour.ytd)}
                      </p>
                      <p>
                        Food Variance %: {toPctDisplay(perf.costControl.foodVariance.mtd)}{" "}
                        / {toPctDisplay(perf.costControl.foodVariance.ytd)}
                      </p>
                    </section>

                    <section className="panel">
                      <h3>INTERNAL OSA</h3>
                      <p>
                        Visits: {toNumberDisplay(perf.internalOsa.visits.mtd, 0)} /{" "}
                        {toNumberDisplay(perf.internalOsa.visits.ytd, 0)}
                      </p>
                      <p>
                        Average Score: {toNumberDisplay(perf.internalOsa.averageScore.mtd)}{" "}
                        / {toNumberDisplay(perf.internalOsa.averageScore.ytd)}
                      </p>
                    </section>

                    <section className="panel">
                      <h3>WALKTHROUGH</h3>
                      <p>
                        Completed: {toNumberDisplay(perf.walkthrough.completed.mtd, 0)} /{" "}
                        {toNumberDisplay(perf.walkthrough.completed.ytd, 0)}
                      </p>
                      <p>
                        Latest completion: {toDateDisplay(perf.walkthrough.latestCompletionDate)}
                      </p>
                    </section>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
      </div>

      <style jsx>{`
        .wrap {
          background: #f2f5f9;
          min-height: 100dvh;
          padding-bottom: 36px;
        }
        .banner {
          display: flex;
          justify-content: center;
          background: #fff;
          border-bottom: 3px solid #006491;
          box-shadow: 0 8px 16px rgba(2, 6, 23, 0.08);
        }
        .banner img {
          max-width: 92%;
          height: auto;
        }
        .shell {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          gap: 12px;
        }
        h1 {
          font-size: 1.5rem;
          margin: 0;
          color: #0f172a;
        }
        .profiles-grid {
          display: grid;
          gap: 16px;
        }
        .card {
          background: #fff;
          border-radius: 18px;
          padding: 16px;
          box-shadow: 0 10px 18px rgba(2, 6, 23, 0.08);
        }
        .error {
          border-left: 4px solid #b91c1c;
          color: #b91c1c;
        }
        .perf-card {
          border: 1px solid rgba(15, 23, 42, 0.08);
        }
        .profile-head h2 {
          margin: 0;
          font-size: 1rem;
          color: #0f172a;
        }
        .profile-head p {
          margin: 4px 0 0;
          font-size: 0.9rem;
          color: #64748b;
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 14px;
        }
        .panel {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px;
        }
        .panel h3 {
          font-size: 0.78rem;
          margin: 0 0 8px;
          letter-spacing: 0.03em;
          color: #006491;
        }
        .panel p {
          margin: 6px 0;
          font-size: 0.82rem;
          color: #0f172a;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 700;
          border: 2px solid transparent;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .btn--brand {
          background: #006491;
          color: white;
          border-color: #004b75;
        }
        .btn--ghost {
          background: white;
          color: #0f172a;
          border-color: #dbe3ee;
        }

        @media (max-width: 980px) {
          .metrics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .topbar {
            flex-wrap: wrap;
          }
          .metrics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
