-- One-row performance summary for a single manager profile.
-- Combines Service, Cost Control, OSA, and Walkthrough metrics for MTD + YTD.

create or replace function public.get_manager_performance_summary(
  p_manager_profile_id uuid
)
returns table (
  manager_profile_id uuid,

  service_dot_pct_mtd numeric,
  service_dot_pct_ytd numeric,
  service_extreme_pct_mtd numeric,
  service_extreme_pct_ytd numeric,
  service_rn1_minutes_mtd numeric,
  service_rn1_minutes_ytd numeric,
  service_additional_hours_mtd numeric,
  service_additional_hours_ytd numeric,

  cost_labour_pct_mtd numeric,
  cost_labour_pct_ytd numeric,
  cost_food_variance_pct_mtd numeric,
  cost_food_variance_pct_ytd numeric,

  osa_visits_mtd bigint,
  osa_visits_ytd bigint,
  osa_avg_score_mtd numeric,
  osa_avg_score_ytd numeric,

  walkthrough_completed_mtd bigint,
  walkthrough_completed_ytd bigint,
  walkthrough_latest_completion_at timestamptz
)
language sql
stable
as $$
with bounds as (
  select
    date_trunc('month', current_date)::date as month_start,
    date_trunc('year', current_date)::date as year_start,
    current_date::date as today,
    now() as right_now
),
service as (
  select
    avg(s.dot_pct) filter (
      where s.shift_date >= b.month_start
        and s.shift_date <= b.today
    ) as service_dot_pct_mtd,
    avg(s.dot_pct) filter (
      where s.shift_date >= b.year_start
        and s.shift_date <= b.today
    ) as service_dot_pct_ytd,
    avg(s.extreme_pct) filter (
      where s.shift_date >= b.month_start
        and s.shift_date <= b.today
    ) as service_extreme_pct_mtd,
    avg(s.extreme_pct) filter (
      where s.shift_date >= b.year_start
        and s.shift_date <= b.today
    ) as service_extreme_pct_ytd,
    avg(s.rn1_minutes) filter (
      where s.shift_date >= b.month_start
        and s.shift_date <= b.today
    ) as service_rn1_minutes_mtd,
    avg(s.rn1_minutes) filter (
      where s.shift_date >= b.year_start
        and s.shift_date <= b.today
    ) as service_rn1_minutes_ytd,
    coalesce(sum(s.additional_hours) filter (
      where s.shift_date >= b.month_start
        and s.shift_date <= b.today
    ), 0) as service_additional_hours_mtd,
    coalesce(sum(s.additional_hours) filter (
      where s.shift_date >= b.year_start
        and s.shift_date <= b.today
    ), 0) as service_additional_hours_ytd
  from public.service_shifts s
  cross join bounds b
  where s.manager_profile_id = p_manager_profile_id
),
cost_control as (
  select
    coalesce(
      sum(cce.labour_pct * cce.sales) filter (
        where cce.shift_date >= b.month_start
          and cce.shift_date <= b.today
      )
      / nullif(
          sum(cce.sales) filter (
            where cce.shift_date >= b.month_start
              and cce.shift_date <= b.today
          ),
          0
        ),
      0
    ) as cost_labour_pct_mtd,
    coalesce(
      sum(cce.labour_pct * cce.sales) filter (
        where cce.shift_date >= b.year_start
          and cce.shift_date <= b.today
      )
      / nullif(
          sum(cce.sales) filter (
            where cce.shift_date >= b.year_start
              and cce.shift_date <= b.today
          ),
          0
        ),
      0
    ) as cost_labour_pct_ytd,
    coalesce(
      sum(cce.food_variance_pct * cce.sales) filter (
        where cce.shift_date >= b.month_start
          and cce.shift_date <= b.today
      )
      / nullif(
          sum(cce.sales) filter (
            where cce.shift_date >= b.month_start
              and cce.shift_date <= b.today
          ),
          0
        ),
      0
    ) as cost_food_variance_pct_mtd,
    coalesce(
      sum(cce.food_variance_pct * cce.sales) filter (
        where cce.shift_date >= b.year_start
          and cce.shift_date <= b.today
      )
      / nullif(
          sum(cce.sales) filter (
            where cce.shift_date >= b.year_start
              and cce.shift_date <= b.today
          ),
          0
        ),
      0
    ) as cost_food_variance_pct_ytd
  from public.cost_control_entries cce
  cross join bounds b
  where cce.manager_profile_id = p_manager_profile_id
),
osa as (
  select
    count(*) filter (
      where oir.shift_date >= b.month_start
        and oir.shift_date <= b.today
    ) as osa_visits_mtd,
    count(*) filter (
      where oir.shift_date >= b.year_start
        and oir.shift_date <= b.today
    ) as osa_visits_ytd,
    round(
      avg(oir.score) filter (
        where oir.shift_date >= b.month_start
          and oir.shift_date <= b.today
      )::numeric,
      2
    ) as osa_avg_score_mtd,
    round(
      avg(oir.score) filter (
        where oir.shift_date >= b.year_start
          and oir.shift_date <= b.today
      )::numeric,
      2
    ) as osa_avg_score_ytd
  from public.osa_internal_results oir
  cross join bounds b
  where oir.team_member_profile_id = p_manager_profile_id
),
walkthrough as (
  select
    count(*) filter (
      where ws.submitted_at >= date_trunc('month', b.right_now)
        and ws.submitted_at <= b.right_now
    ) as walkthrough_completed_mtd,
    count(*) filter (
      where ws.submitted_at >= date_trunc('year', b.right_now)
        and ws.submitted_at <= b.right_now
    ) as walkthrough_completed_ytd,
    max(ws.submitted_at) as walkthrough_latest_completion_at
  from public.walkthrough_submissions ws
  cross join bounds b
  where ws.manager_profile_id = p_manager_profile_id
)
select
  p_manager_profile_id as manager_profile_id,
  s.service_dot_pct_mtd,
  s.service_dot_pct_ytd,
  s.service_extreme_pct_mtd,
  s.service_extreme_pct_ytd,
  s.service_rn1_minutes_mtd,
  s.service_rn1_minutes_ytd,
  s.service_additional_hours_mtd,
  s.service_additional_hours_ytd,

  cc.cost_labour_pct_mtd,
  cc.cost_labour_pct_ytd,
  cc.cost_food_variance_pct_mtd,
  cc.cost_food_variance_pct_ytd,

  o.osa_visits_mtd,
  o.osa_visits_ytd,
  o.osa_avg_score_mtd,
  o.osa_avg_score_ytd,

  w.walkthrough_completed_mtd,
  w.walkthrough_completed_ytd,
  w.walkthrough_latest_completion_at
from service s
cross join cost_control cc
cross join osa o
cross join walkthrough w;
$$;
