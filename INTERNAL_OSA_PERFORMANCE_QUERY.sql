-- Internal OSA performance by team member (MTD + YTD)
-- Replace `visit_date` with "date" below if your table uses a `date` column name instead.

SELECT
  COUNT(*) FILTER (
    WHERE visit_date >= date_trunc('month', CURRENT_DATE)
      AND visit_date < CURRENT_DATE + INTERVAL '1 day'
  ) AS visits_mtd,
  ROUND(
    AVG(score) FILTER (
      WHERE visit_date >= date_trunc('month', CURRENT_DATE)
        AND visit_date < CURRENT_DATE + INTERVAL '1 day'
    )::numeric,
    2
  ) AS avg_score_mtd,
  COUNT(*) FILTER (
    WHERE visit_date >= date_trunc('year', CURRENT_DATE)
      AND visit_date < CURRENT_DATE + INTERVAL '1 day'
  ) AS visits_ytd,
  ROUND(
    AVG(score) FILTER (
      WHERE visit_date >= date_trunc('year', CURRENT_DATE)
        AND visit_date < CURRENT_DATE + INTERVAL '1 day'
    )::numeric,
    2
  ) AS avg_score_ytd
FROM osa_internal_results
WHERE team_member_profile_id = $1;
