export type ServiceMetrics = {
  dot?: number | null;
  extremeOver40?: number | null;
  rnlMinutes?: number | null;
  additionalHours?: number | null;
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

const normalizedPercent = (value: number): number => (value > 1 ? value / 100 : value);

export const scoreDot = (dot: number | null | undefined): number | null => {
  if (dot == null || !Number.isFinite(dot)) return null;
  return clamp(normalizedPercent(dot) * 100, 0, 100);
};

export const scoreExtremeOver40 = (
  extremeOver40: number | null | undefined
): number | null => {
  if (extremeOver40 == null || !Number.isFinite(extremeOver40)) return null;
  return clamp(100 - normalizedPercent(extremeOver40) * 1000, 0, 100);
};

export const scoreRnlMinutes = (
  rnlMinutes: number | null | undefined
): number | null => {
  if (rnlMinutes == null || !Number.isFinite(rnlMinutes)) return null;
  return clamp(100 - rnlMinutes * 5, 0, 100);
};

export const scoreAdditionalHours = (
  additionalHours: number | null | undefined
): number | null => {
  if (additionalHours == null || !Number.isFinite(additionalHours)) return null;
  return clamp(100 - additionalHours * 5, 0, 100);
};

export const scoreLabourPct = (
  labourPct: number | null | undefined
): number | null => {
  if (labourPct == null || !Number.isFinite(labourPct)) return null;
  return clamp(100 - labourPct, 0, 100);
};

export const scoreFoodVariancePct = (
  foodVariancePct: number | null | undefined
): number | null => {
  if (foodVariancePct == null || !Number.isFinite(foodVariancePct)) return null;
  return clamp(100 - Math.abs(foodVariancePct) * 10, 0, 100);
};

export const scoreStars = (avgStars: number | null): number | null => {
  if (avgStars == null || !Number.isFinite(avgStars)) return null;
  return clamp((avgStars / 5) * 100, 0, 100);
};

export const scorePointsLost = (avgPointsLost: number | null): number | null => {
  if (avgPointsLost == null || !Number.isFinite(avgPointsLost)) return null;
  return clamp(100 - avgPointsLost * 10, 0, 100);
};

export const scoreService = (metrics: ServiceMetrics): number | null =>
  average([
    scoreDot(metrics.dot),
    scoreExtremeOver40(metrics.extremeOver40),
    scoreRnlMinutes(metrics.rnlMinutes),
    scoreAdditionalHours(metrics.additionalHours),
  ]);

export const scoreCost = (metrics: CostMetrics): number | null =>
  average([
    scoreLabourPct(metrics.labourPct),
    scoreFoodVariancePct(metrics.foodVariancePct),
  ]);

export const scoreOsa = (
  avgStars: number | null,
  avgPointsLost: number | null
): number | null => average([scoreStars(avgStars), scorePointsLost(avgPointsLost)]);

export const scoreMpi = ({ service, cost, osa }: MpiScores): number | null =>
  average([service, cost, osa]);
