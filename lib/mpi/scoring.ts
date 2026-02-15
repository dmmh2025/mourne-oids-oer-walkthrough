export type ServiceMetrics = {
  dot?: number | null;
  extremeOver40?: number | null;
  rnlMinutes?: number | null;
};

export type CostMetrics = {
  labourPct?: number | null;
  foodVariancePct?: number | null;
};

export type MpiScores = {
  service: number | null;
  cost: number | null;
  osa: number | null;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const average = (values: Array<number | null>): number | null => {
  const valid = values.filter((value): value is number => value != null);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

export const scoreStars = (avgStars: number | null): number | null => {
  if (avgStars == null || !Number.isFinite(avgStars)) return null;
  return clamp((avgStars / 5) * 100, 0, 100);
};

export const scorePointsLost = (avgPointsLost: number | null): number | null => {
  if (avgPointsLost == null || !Number.isFinite(avgPointsLost)) return null;
  return clamp(100 - avgPointsLost * 10, 0, 100);
};

export const scoreOsa = (
  avgStars: number | null,
  avgPointsLost: number | null
): number | null => average([scoreStars(avgStars), scorePointsLost(avgPointsLost)]);

export const scoreService = (metrics: ServiceMetrics): number | null => {
  const dotScore =
    metrics.dot == null || !Number.isFinite(metrics.dot)
      ? null
      : clamp((metrics.dot > 1 ? metrics.dot / 100 : metrics.dot) * 100, 0, 100);

  const extremeScore =
    metrics.extremeOver40 == null || !Number.isFinite(metrics.extremeOver40)
      ? null
      : clamp(100 - (metrics.extremeOver40 > 1 ? metrics.extremeOver40 / 100 : metrics.extremeOver40) * 1000, 0, 100);

  const rackloadScore =
    metrics.rnlMinutes == null || !Number.isFinite(metrics.rnlMinutes)
      ? null
      : clamp(100 - metrics.rnlMinutes * 5, 0, 100);

  return average([dotScore, extremeScore, rackloadScore]);
};

export const scoreCost = (metrics: CostMetrics): number | null => {
  const labourScore =
    metrics.labourPct == null || !Number.isFinite(metrics.labourPct)
      ? null
      : clamp(100 - metrics.labourPct, 0, 100);

  const foodVarianceScore =
    metrics.foodVariancePct == null || !Number.isFinite(metrics.foodVariancePct)
      ? null
      : clamp(100 - Math.abs(metrics.foodVariancePct) * 10, 0, 100);

  return average([labourScore, foodVarianceScore]);
};

export const scoreMpi = ({ service, cost, osa }: MpiScores): number | null =>
  average([service, cost, osa]);
