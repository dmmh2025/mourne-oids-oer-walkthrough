-- Walkthrough completion metrics for a single manager.
-- Replace :manager_profile_id with the target manager profile UUID/value.

SELECT
  COUNT(*) FILTER (
    WHERE submitted_at >= date_trunc('month', now())
      AND submitted_at <= now()
  ) AS completed_mtd,
  COUNT(*) FILTER (
    WHERE submitted_at >= date_trunc('year', now())
      AND submitted_at <= now()
  ) AS completed_ytd,
  MAX(submitted_at) AS latest_completion
FROM walkthrough_submissions
WHERE manager_profile_id = :manager_profile_id;
