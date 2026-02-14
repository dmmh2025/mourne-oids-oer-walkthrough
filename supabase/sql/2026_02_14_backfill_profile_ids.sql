-- Backfill *_profile_id columns by matching name fields to profiles.display_name.
-- Matching rules:
--   * case-insensitive
--   * trim surrounding whitespace
--   * only set profile id when target *_profile_id is currently NULL
--   * only use unambiguous normalized profile names (exactly one matching profile)

with normalized_profiles as (
  select
    p.id,
    lower(trim(p.display_name)) as normalized_display_name
  from public.profiles p
  where p.display_name is not null
    and trim(p.display_name) <> ''
), unique_profiles as (
  select
    np.normalized_display_name,
    min(np.id) as profile_id
  from normalized_profiles np
  group by np.normalized_display_name
  having count(*) = 1
)
update public.cost_control_entries cce
set manager_profile_id = up.profile_id
from unique_profiles up
where cce.manager_profile_id is null
  and cce.manager_name is not null
  and trim(cce.manager_name) <> ''
  and lower(trim(cce.manager_name)) = up.normalized_display_name;

with normalized_profiles as (
  select
    p.id,
    lower(trim(p.display_name)) as normalized_display_name
  from public.profiles p
  where p.display_name is not null
    and trim(p.display_name) <> ''
), unique_profiles as (
  select
    np.normalized_display_name,
    min(np.id) as profile_id
  from normalized_profiles np
  group by np.normalized_display_name
  having count(*) = 1
)
update public.service_shifts ss
set manager_profile_id = up.profile_id
from unique_profiles up
where ss.manager_profile_id is null
  and ss.manager is not null
  and trim(ss.manager) <> ''
  and lower(trim(ss.manager)) = up.normalized_display_name;

with normalized_profiles as (
  select
    p.id,
    lower(trim(p.display_name)) as normalized_display_name
  from public.profiles p
  where p.display_name is not null
    and trim(p.display_name) <> ''
), unique_profiles as (
  select
    np.normalized_display_name,
    min(np.id) as profile_id
  from normalized_profiles np
  group by np.normalized_display_name
  having count(*) = 1
)
update public.osa_internal_results oir
set team_member_profile_id = up.profile_id
from unique_profiles up
where oir.team_member_profile_id is null
  and oir.team_member_name is not null
  and trim(oir.team_member_name) <> ''
  and lower(trim(oir.team_member_name)) = up.normalized_display_name;
