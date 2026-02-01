-- OSA Standards Walkthrough (tick-only) completion log
-- Run in Supabase SQL editor.

create table if not exists public.osa_standards_walkthroughs (
  id uuid primary key default gen_random_uuid(),
  store text not null,
  walkthrough_type text not null check (walkthrough_type in ('pre_open','handover')),
  completed_at timestamptz not null default now(),
  completed_by text not null,
  sections jsonb null,
  notes text null,
  is_admin_override boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists osa_standards_walkthroughs_completed_at_idx
  on public.osa_standards_walkthroughs (completed_at desc);

create index if not exists osa_standards_walkthroughs_store_type_completed_at_idx
  on public.osa_standards_walkthroughs (store, walkthrough_type, completed_at desc);

-- If you use RLS, either disable for this table or add policies.
-- This project writes via service role key in API routes, so RLS is optional here.
