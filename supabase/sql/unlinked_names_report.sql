-- Report unlinked names (rows where *_profile_id is still NULL) for each table.
-- Includes how often each normalized name appears and whether that name
-- has 0, 1, or many matches in public.profiles.

with normalized_profiles as (
  select
    lower(trim(p.display_name)) as normalized_display_name,
    count(*) as matching_profile_count
  from public.profiles p
  where p.display_name is not null
    and trim(p.display_name) <> ''
  group by lower(trim(p.display_name))
), unlinked_names as (
  select
    'cost_control_entries'::text as source_table,
    'manager_name'::text as source_name_column,
    lower(trim(cce.manager_name)) as normalized_name,
    cce.manager_name as raw_name
  from public.cost_control_entries cce
  where cce.manager_profile_id is null
    and cce.manager_name is not null
    and trim(cce.manager_name) <> ''

  union all

  select
    'service_shifts'::text as source_table,
    'manager'::text as source_name_column,
    lower(trim(ss.manager)) as normalized_name,
    ss.manager as raw_name
  from public.service_shifts ss
  where ss.manager_profile_id is null
    and ss.manager is not null
    and trim(ss.manager) <> ''

  union all

  select
    'osa_internal_results'::text as source_table,
    'team_member_name'::text as source_name_column,
    lower(trim(oir.team_member_name)) as normalized_name,
    oir.team_member_name as raw_name
  from public.osa_internal_results oir
  where oir.team_member_profile_id is null
    and oir.team_member_name is not null
    and trim(oir.team_member_name) <> ''
)
select
  u.source_table,
  u.source_name_column,
  u.normalized_name,
  min(u.raw_name) as example_raw_name,
  count(*) as unlinked_row_count,
  coalesce(np.matching_profile_count, 0) as matching_profile_count,
  case
    when coalesce(np.matching_profile_count, 0) = 0 then 'no profile match'
    when np.matching_profile_count = 1 then 'single profile match (not linked)'
    else 'ambiguous: multiple profile matches'
  end as match_status
from unlinked_names u
left join normalized_profiles np
  on np.normalized_display_name = u.normalized_name
group by
  u.source_table,
  u.source_name_column,
  u.normalized_name,
  np.matching_profile_count
order by
  unlinked_row_count desc,
  u.source_table,
  u.source_name_column,
  u.normalized_name;
