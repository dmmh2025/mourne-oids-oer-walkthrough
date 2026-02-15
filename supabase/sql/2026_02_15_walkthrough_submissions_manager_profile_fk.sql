-- Add manager_profile_id to walkthrough_submissions, backfill from profiles,
-- and enforce referential integrity.

alter table public.walkthrough_submissions
add column if not exists manager_profile_id uuid;

update public.walkthrough_submissions ws
set manager_profile_id = p.id
from public.profiles p
where ws.manager_profile_id is null
  and ws.display_name is not null
  and p.display_name = ws.display_name;

create index if not exists walkthrough_submissions_manager_profile_id_idx
on public.walkthrough_submissions (manager_profile_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'walkthrough_submissions_manager_profile_id_fkey'
      and conrelid = 'public.walkthrough_submissions'::regclass
  ) then
    alter table public.walkthrough_submissions
    add constraint walkthrough_submissions_manager_profile_id_fkey
    foreign key (manager_profile_id)
    references public.profiles (id)
    on delete set null;
  end if;
end $$;
