-- Auto-populate *_profile_id columns by matching normalized name fields
-- against public.profiles.display_name.
-- Matching rules:
--   * case-insensitive
--   * trims surrounding whitespace
--   * only links when the normalized display_name is unambiguous

create or replace function public.resolve_profile_id_by_display_name(input_name text)
returns uuid
language plpgsql
stable
as $$
declare
  normalized_name text;
  resolved_profile_id uuid;
  match_count integer;
begin
  if input_name is null or trim(input_name) = '' then
    return null;
  end if;

  normalized_name := lower(trim(input_name));

  select min(p.id), count(*)
  into resolved_profile_id, match_count
  from public.profiles p
  where p.display_name is not null
    and trim(p.display_name) <> ''
    and lower(trim(p.display_name)) = normalized_name;

  if match_count = 1 then
    return resolved_profile_id;
  end if;

  return null;
end;
$$;

create or replace function public.set_cost_control_entries_manager_profile_id()
returns trigger
language plpgsql
as $$
begin
  new.manager_profile_id := public.resolve_profile_id_by_display_name(new.manager_name);
  return new;
end;
$$;

drop trigger if exists trg_set_cost_control_entries_manager_profile_id on public.cost_control_entries;

create trigger trg_set_cost_control_entries_manager_profile_id
before insert or update of manager_name
on public.cost_control_entries
for each row
execute function public.set_cost_control_entries_manager_profile_id();

create or replace function public.set_service_shifts_manager_profile_id()
returns trigger
language plpgsql
as $$
begin
  new.manager_profile_id := public.resolve_profile_id_by_display_name(new.manager);
  return new;
end;
$$;

drop trigger if exists trg_set_service_shifts_manager_profile_id on public.service_shifts;

create trigger trg_set_service_shifts_manager_profile_id
before insert or update of manager
on public.service_shifts
for each row
execute function public.set_service_shifts_manager_profile_id();

create or replace function public.set_osa_internal_results_team_member_profile_id()
returns trigger
language plpgsql
as $$
begin
  new.team_member_profile_id := public.resolve_profile_id_by_display_name(new.team_member_name);
  return new;
end;
$$;

drop trigger if exists trg_set_osa_internal_results_team_member_profile_id on public.osa_internal_results;

create trigger trg_set_osa_internal_results_team_member_profile_id
before insert or update of team_member_name
on public.osa_internal_results
for each row
execute function public.set_osa_internal_results_team_member_profile_id();
