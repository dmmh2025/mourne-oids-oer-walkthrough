-- Create a profile KPI view with one row per profile id.
-- Includes MTD/YTD counts for service shifts, cost controls, internal OSA results,
-- and walkthrough submissions (when a profile-id join column is available).

do $$
declare
  walkthrough_table_exists boolean;
  walkthrough_profile_col text;
  walkthrough_time_col text;

  walkthrough_cte_sql text;
  walkthrough_join_sql text;
  walkthrough_select_sql text;

  create_view_sql text;
begin
  select exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = 'walkthrough_submissions'
  ) into walkthrough_table_exists;

  if walkthrough_table_exists then
    -- Prefer submitted_by_profile_id, then created_by_profile_id.
    select c.column_name
    into walkthrough_profile_col
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'walkthrough_submissions'
      and c.column_name in ('submitted_by_profile_id', 'created_by_profile_id')
    order by case c.column_name
      when 'submitted_by_profile_id' then 1
      when 'created_by_profile_id' then 2
      else 99
    end
    limit 1;

    -- Prefer submitted_at, then created_at, then shift_date for time-windowing.
    select c.column_name
    into walkthrough_time_col
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'walkthrough_submissions'
      and c.column_name in ('submitted_at', 'created_at', 'shift_date')
    order by case c.column_name
      when 'submitted_at' then 1
      when 'created_at' then 2
      when 'shift_date' then 3
      else 99
    end
    limit 1;
  end if;

  if walkthrough_table_exists and walkthrough_profile_col is not null and walkthrough_time_col is not null then
    walkthrough_cte_sql := format(
      $fmt$
      , walkthrough_stats as (
          select
            ws.%1$I as profile_id,
            count(*) filter (
              where (ws.%2$I)::timestamptz >= date_trunc('month', now())
                and (ws.%2$I)::timestamptz <= now()
            )::bigint as walkthrough_submissions_mtd_count,
            count(*) filter (
              where (ws.%2$I)::timestamptz >= date_trunc('year', now())
                and (ws.%2$I)::timestamptz <= now()
            )::bigint as walkthrough_submissions_ytd_count
          from public.walkthrough_submissions ws
          where ws.%1$I is not null
          group by ws.%1$I
        )
      $fmt$,
      walkthrough_profile_col,
      walkthrough_time_col
    );

    walkthrough_join_sql := 'left join walkthrough_stats ws on ws.profile_id = p.id';

    walkthrough_select_sql :=
      'coalesce(ws.walkthrough_submissions_mtd_count, 0) as walkthrough_submissions_mtd_count,' || E'\n      ' ||
      'coalesce(ws.walkthrough_submissions_ytd_count, 0) as walkthrough_submissions_ytd_count,' || E'\n      ' ||
      'null::text as walkthrough_todo_note';
  else
    walkthrough_cte_sql := '';
    walkthrough_join_sql := '';
    walkthrough_select_sql :=
      '0::bigint as walkthrough_submissions_mtd_count,' || E'\n      ' ||
      '0::bigint as walkthrough_submissions_ytd_count,' || E'\n      ' ||
      format(
        '%L::text as walkthrough_todo_note',
        'TODO: walkthrough_submissions profile-link column missing (expected submitted_by_profile_id or created_by_profile_id).'
      );
  end if;

  create_view_sql := format(
    $sql$
    create or replace view public.view_profile_kpis as
    with
      service_shift_stats as (
        select
          ss.manager_profile_id as profile_id,
          count(*) filter (
            where ss.shift_date >= date_trunc('month', now())::date
              and ss.shift_date <= now()::date
          )::bigint as service_shifts_mtd_count,
          count(*) filter (
            where ss.shift_date >= date_trunc('year', now())::date
              and ss.shift_date <= now()::date
          )::bigint as service_shifts_ytd_count
        from public.service_shifts ss
        where ss.manager_profile_id is not null
        group by ss.manager_profile_id
      ),
      cost_control_stats as (
        select
          cce.manager_profile_id as profile_id,
          count(*) filter (
            where cce.shift_date >= date_trunc('month', now())::date
              and cce.shift_date <= now()::date
          )::bigint as cost_control_entries_mtd_count,
          count(*) filter (
            where cce.shift_date >= date_trunc('year', now())::date
              and cce.shift_date <= now()::date
          )::bigint as cost_control_entries_ytd_count
        from public.cost_control_entries cce
        where cce.manager_profile_id is not null
        group by cce.manager_profile_id
      ),
      osa_internal_stats as (
        select
          oir.team_member_profile_id as profile_id,
          count(*) filter (
            where oir.shift_date >= date_trunc('month', now())::date
              and oir.shift_date <= now()::date
          )::bigint as osa_internal_results_mtd_count,
          count(*) filter (
            where oir.shift_date >= date_trunc('year', now())::date
              and oir.shift_date <= now()::date
          )::bigint as osa_internal_results_ytd_count
        from public.osa_internal_results oir
        where oir.team_member_profile_id is not null
        group by oir.team_member_profile_id
      )
      %1$s
    select
      p.id as profile_id,
      coalesce(ss.service_shifts_mtd_count, 0) as service_shifts_mtd_count,
      coalesce(ss.service_shifts_ytd_count, 0) as service_shifts_ytd_count,
      coalesce(cce.cost_control_entries_mtd_count, 0) as cost_control_entries_mtd_count,
      coalesce(cce.cost_control_entries_ytd_count, 0) as cost_control_entries_ytd_count,
      coalesce(oir.osa_internal_results_mtd_count, 0) as osa_internal_results_mtd_count,
      coalesce(oir.osa_internal_results_ytd_count, 0) as osa_internal_results_ytd_count,
      %2$s
    from public.profiles p
    left join service_shift_stats ss on ss.profile_id = p.id
    left join cost_control_stats cce on cce.profile_id = p.id
    left join osa_internal_stats oir on oir.profile_id = p.id
    %3$s
    ;
    $sql$,
    walkthrough_cte_sql,
    walkthrough_select_sql,
    walkthrough_join_sql
  );

  execute create_view_sql;
end $$;
