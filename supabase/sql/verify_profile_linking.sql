-- Verification script: profile linking + RLS/policies audit
-- Run in Supabase SQL editor (or psql) and inspect each result set.

-- =====================================================================
-- 1) Verify manager_profile_id + team_member_profile_id exist,
--    and are UUID + nullable
-- =====================================================================
select
  c.table_schema,
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  case
    when c.udt_name = 'uuid' and c.is_nullable = 'YES' then 'PASS'
    when c.udt_name = 'uuid' and c.is_nullable = 'NO' then 'FAIL: uuid but NOT NULL'
    when c.udt_name <> 'uuid' and c.is_nullable = 'YES' then 'FAIL: nullable but NOT uuid'
    else 'FAIL: not uuid and NOT NULL'
  end as uuid_nullable_check
from information_schema.columns c
where c.table_schema = 'public'
  and c.column_name in ('manager_profile_id', 'team_member_profile_id')
order by c.table_name, c.column_name;

-- Optional quick summary to reveal missing expected columns in any table where they might be required.
-- (This lists every public table and whether each column is present.)
select
  t.table_schema,
  t.table_name,
  max((c.column_name = 'manager_profile_id')::int)::boolean as has_manager_profile_id,
  max((c.column_name = 'team_member_profile_id')::int)::boolean as has_team_member_profile_id
from information_schema.tables t
left join information_schema.columns c
  on c.table_schema = t.table_schema
 and c.table_name = t.table_name
 and c.column_name in ('manager_profile_id', 'team_member_profile_id')
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
group by t.table_schema, t.table_name
order by t.table_name;

-- =====================================================================
-- 2) Check FK constraints for manager_profile_id + team_member_profile_id
-- =====================================================================
select
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  tc.constraint_name,
  ccu.table_schema as referenced_table_schema,
  ccu.table_name as referenced_table_name,
  ccu.column_name as referenced_column_name,
  rc.update_rule,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
 and tc.table_schema = ccu.table_schema
join information_schema.referential_constraints rc
  on tc.constraint_name = rc.constraint_name
 and tc.table_schema = rc.constraint_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and kcu.column_name in ('manager_profile_id', 'team_member_profile_id')
order by tc.table_name, kcu.column_name, tc.constraint_name;

-- =====================================================================
-- 3) Check duplicates of profiles.display_name
-- =====================================================================
select
  p.display_name,
  count(*) as duplicate_count,
  array_agg(p.id order by p.id) as profile_ids
from public.profiles p
where p.display_name is not null
group by p.display_name
having count(*) > 1
order by duplicate_count desc, p.display_name;

-- Optional normalization-aware duplicate check (trim + lower).
select
  lower(trim(p.display_name)) as normalized_display_name,
  count(*) as duplicate_count,
  array_agg(p.id order by p.id) as profile_ids,
  array_agg(p.display_name order by p.display_name) as raw_display_names
from public.profiles p
where p.display_name is not null
  and trim(p.display_name) <> ''
group by lower(trim(p.display_name))
having count(*) > 1
order by duplicate_count desc, normalized_display_name;

-- =====================================================================
-- 4) RLS enabled status + policies for target tables
--    tables: profiles, cost_control_entries, osa_internal_results, service_shifts
-- =====================================================================

-- RLS status + force RLS flags
select
  n.nspname as table_schema,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('profiles', 'cost_control_entries', 'osa_internal_results', 'service_shifts')
order by c.relname;

-- Policy list
select
  schemaname as table_schema,
  tablename as table_name,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'cost_control_entries', 'osa_internal_results', 'service_shifts')
order by tablename, policyname;
