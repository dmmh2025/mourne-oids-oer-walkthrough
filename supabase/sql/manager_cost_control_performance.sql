-- Cost Control performance snapshot for a single manager_profile_id
-- Replace :manager_profile_id with your target UUID (or bind as a query parameter).

SELECT
  -- Month to date (weighted by sales)
  COALESCE(
    SUM(cce.labour_pct * cce.sales)
      FILTER (
        WHERE cce.shift_date >= date_trunc('month', CURRENT_DATE)
          AND cce.shift_date <= CURRENT_DATE
      )
    / NULLIF(
        SUM(cce.sales)
          FILTER (
            WHERE cce.shift_date >= date_trunc('month', CURRENT_DATE)
              AND cce.shift_date <= CURRENT_DATE
          ),
        0
      ),
    0
  ) AS labour_mtd,
  COALESCE(
    SUM(cce.food_variance_pct * cce.sales)
      FILTER (
        WHERE cce.shift_date >= date_trunc('month', CURRENT_DATE)
          AND cce.shift_date <= CURRENT_DATE
      )
    / NULLIF(
        SUM(cce.sales)
          FILTER (
            WHERE cce.shift_date >= date_trunc('month', CURRENT_DATE)
              AND cce.shift_date <= CURRENT_DATE
          ),
        0
      ),
    0
  ) AS food_variance_mtd,

  -- Year to date (weighted by sales)
  COALESCE(
    SUM(cce.labour_pct * cce.sales)
      FILTER (
        WHERE cce.shift_date >= date_trunc('year', CURRENT_DATE)
          AND cce.shift_date <= CURRENT_DATE
      )
    / NULLIF(
        SUM(cce.sales)
          FILTER (
            WHERE cce.shift_date >= date_trunc('year', CURRENT_DATE)
              AND cce.shift_date <= CURRENT_DATE
          ),
        0
      ),
    0
  ) AS labour_ytd,
  COALESCE(
    SUM(cce.food_variance_pct * cce.sales)
      FILTER (
        WHERE cce.shift_date >= date_trunc('year', CURRENT_DATE)
          AND cce.shift_date <= CURRENT_DATE
      )
    / NULLIF(
        SUM(cce.sales)
          FILTER (
            WHERE cce.shift_date >= date_trunc('year', CURRENT_DATE)
              AND cce.shift_date <= CURRENT_DATE
          ),
        0
      ),
    0
  ) AS food_variance_ytd
FROM cost_control_entries cce
WHERE cce.manager_profile_id = :manager_profile_id;
