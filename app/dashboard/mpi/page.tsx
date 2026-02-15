import {
  scoreCost,
  scoreMpi,
  scoreOsa,
  scoreService,
  type CostMetrics,
  type ServiceMetrics,
} from "@/lib/mpi/scoring";

const serviceMetrics: ServiceMetrics = {
  dot: 0.82,
  extremeOver40: 0.03,
  rnlMinutes: 11,
};

const costMetrics: CostMetrics = {
  labourPct: 25,
  foodVariancePct: 0.8,
};

const avgStars = 4.4;
const avgPointsLost = 2.1;

export default function MpiDashboardPage() {
  const service = scoreService(serviceMetrics);
  const cost = scoreCost(costMetrics);
  const osa = scoreOsa(avgStars, avgPointsLost);
  const mpi = scoreMpi({ service, cost, osa });

  return (
    <main style={{ padding: 24 }}>
      <h1>MPI Dashboard</h1>
      <ul>
        <li>Service score: {service == null ? "N/A" : service.toFixed(1)}</li>
        <li>Cost score: {cost == null ? "N/A" : cost.toFixed(1)}</li>
        <li>OSA score: {osa == null ? "N/A" : osa.toFixed(1)}</li>
        <li>MPI score: {mpi == null ? "N/A" : mpi.toFixed(1)}</li>
      </ul>
    </main>
  );
}
