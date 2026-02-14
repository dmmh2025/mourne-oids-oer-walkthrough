-- Add missing FK relationships to profiles for manager/team-member profile ids.
-- Requirements:
--   ON DELETE SET NULL
--   ON UPDATE CASCADE

create index if not exists cost_control_entries_manager_profile_id_idx
  on public.cost_control_entries (manager_profile_id);

create index if not exists service_shifts_manager_profile_id_idx
  on public.service_shifts (manager_profile_id);

create index if not exists osa_internal_results_team_member_profile_id_idx
  on public.osa_internal_results (team_member_profile_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cost_control_entries'
      and column_name = 'manager_profile_id'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'cost_control_entries_manager_profile_id_fkey'
      and conrelid = 'public.cost_control_entries'::regclass
  ) then
    alter table public.cost_control_entries
      add constraint cost_control_entries_manager_profile_id_fkey
      foreign key (manager_profile_id)
      references public.profiles (id)
      on delete set null
      on update cascade;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_shifts'
      and column_name = 'manager_profile_id'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'service_shifts_manager_profile_id_fkey'
      and conrelid = 'public.service_shifts'::regclass
  ) then
    alter table public.service_shifts
      add constraint service_shifts_manager_profile_id_fkey
      foreign key (manager_profile_id)
      references public.profiles (id)
      on delete set null
      on update cascade;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'osa_internal_results'
      and column_name = 'team_member_profile_id'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'osa_internal_results_team_member_profile_id_fkey'
      and conrelid = 'public.osa_internal_results'::regclass
  ) then
    alter table public.osa_internal_results
      add constraint osa_internal_results_team_member_profile_id_fkey
      foreign key (team_member_profile_id)
      references public.profiles (id)
      on delete set null
      on update cascade;
  end if;
end $$;
