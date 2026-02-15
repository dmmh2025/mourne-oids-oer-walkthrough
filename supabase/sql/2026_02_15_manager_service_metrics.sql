-- Service performance metrics for a single manager profile.
-- Replace $1 with the target manager_profile_id when executing.
WITH bounds AS (
  SELECT
    date_trunc('month', CURRENT_DATE)::date AS month_start,
    date_trunc('year', CURRENT_DATE)::date  AS year_start,
    CURRENT_DATE::date                      AS today
)
SELECT
  AVG(s.dot_pct) FILTER (
    WHERE s.shift_date >= b.month_start
      AND s.shift_date <= b.today
  ) AS dot_mtd,
  AVG(s.extreme_pct) FILTER (
    WHERE s.shift_date >= b.month_start
      AND s.shift_date <= b.today
  ) AS extreme_mtd,
  AVG(s.rn1_minutes) FILTER (
    WHERE s.shift_date >= b.month_start
      AND s.shift_date <= b.today
  ) AS rnl_mtd,
  COALESCE(SUM(s.additional_hours) FILTER (
    WHERE s.shift_date >= b.month_start
      AND s.shift_date <= b.today
  ), 0) AS additional_hours_mtd,
  AVG(s.dot_pct) FILTER (
    WHERE s.shift_date >= b.year_start
      AND s.shift_date <= b.today
  ) AS dot_ytd,
  AVG(s.extreme_pct) FILTER (
    WHERE s.shift_date >= b.year_start
      AND s.shift_date <= b.today
  ) AS extreme_ytd,
  AVG(s.rn1_minutes) FILTER (
    WHERE s.shift_date >= b.year_start
      AND s.shift_date <= b.today
  ) AS rnl_ytd,
  COALESCE(SUM(s.additional_hours) FILTER (
    WHERE s.shift_date >= b.year_start
      AND s.shift_date <= b.today
  ), 0) AS additional_hours_ytd
FROM service_shifts AS s
CROSS JOIN bounds AS b
WHERE s.manager_profile_id = $1;
