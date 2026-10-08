-- Fadeke's Job Desk: full schema
-- Run this whole file once in the Supabase SQL Editor (or `supabase db push`).
-- Safe to re-run: every statement is idempotent.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (one row per user: the master profile)
-- Contact details (email, phone, location) are entered on the Profile page.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  location text,
  timezone text not null default 'WAT, UTC+1',
  target_titles text[] not null default '{}',
  min_hourly_rate numeric,
  summary text not null default '',
  skills text[] not null default '{}',
  tools text[] not null default '{}',
  languages text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- experiences
-- Unverified experiences are shown with a "Needs confirmation" badge, and the
-- kit generator never uses their bullets.
-- ---------------------------------------------------------------------------
create table if not exists experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  employer text not null,
  title text not null,
  start_date date,
  end_date date,
  current boolean not null default false,
  location text,
  remote boolean not null default false,
  bullets jsonb not null default '[]'::jsonb, -- array of {text, tags[]}
  verified boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists experiences_user_idx on experiences (user_id, sort_order);

-- ---------------------------------------------------------------------------
-- education
-- ---------------------------------------------------------------------------
create table if not exists education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  school text not null,
  degree text not null default '',
  field text not null default '',
  start_year int,
  end_year int,
  created_at timestamptz not null default now()
);

create index if not exists education_user_idx on education (user_id);

-- ---------------------------------------------------------------------------
-- jobs (shared feed; written only by the server with the service role)
-- ---------------------------------------------------------------------------
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  title text not null,
  company text not null default '',
  url text not null,
  description text not null default '',
  region_text text not null default '',
  posted_at timestamptz,
  salary_text text,
  ng_eligible boolean,
  ng_reason text,
  scam_score int not null default 0,
  scam_flags jsonb not null default '[]'::jsonb,
  scam_level text not null default 'low' check (scam_level in ('low', 'medium', 'high')),
  fetched_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists jobs_posted_at_idx on jobs (posted_at desc);

-- ---------------------------------------------------------------------------
-- source_runs (fetch cache / rate-limit bookkeeping, one row per source)
-- ---------------------------------------------------------------------------
create table if not exists source_runs (
  source text primary key,
  last_run_at timestamptz not null,
  last_status text not null default 'ok',
  last_count int not null default 0,
  last_error text
);

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references jobs (id) on delete cascade,
  score int not null check (score between 0 and 100),
  reasons jsonb not null default '[]'::jsonb,
  have jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index if not exists matches_user_score_idx on matches (user_id, score desc);

-- ---------------------------------------------------------------------------
-- kits (application kit per job; latest row wins)
-- ---------------------------------------------------------------------------
create table if not exists kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references jobs (id) on delete cascade,
  cv_text text not null default '',
  cover_letter text not null default '',
  answers_text text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists kits_user_job_idx on kits (user_id, job_id, created_at desc);

-- ---------------------------------------------------------------------------
-- applications (tracker)
-- ---------------------------------------------------------------------------
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references jobs (id) on delete cascade,
  stage text not null default 'Saved'
    check (stage in ('Saved', 'Applied', 'Replied', 'Interview', 'Offer', 'Rejected')),
  applied_on date,
  follow_up_on date,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index if not exists applications_user_stage_idx on applications (user_id, stage);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Per-user tables: each user only sees and changes their own rows.
-- jobs / source_runs: signed-in users can read; only the service role writes
-- (the service role bypasses RLS, so no write policies are needed).
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table experiences enable row level security;
alter table education enable row level security;
alter table jobs enable row level security;
alter table source_runs enable row level security;
alter table matches enable row level security;
alter table kits enable row level security;
alter table applications enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'experiences', 'education', 'matches', 'kits', 'applications']
  loop
    execute format('drop policy if exists "own rows select" on %I', t);
    execute format('drop policy if exists "own rows insert" on %I', t);
    execute format('drop policy if exists "own rows update" on %I', t);
    execute format('drop policy if exists "own rows delete" on %I', t);
    execute format('create policy "own rows select" on %I for select to authenticated using (auth.uid() = user_id)', t);
    execute format('create policy "own rows insert" on %I for insert to authenticated with check (auth.uid() = user_id)', t);
    execute format('create policy "own rows update" on %I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own rows delete" on %I for delete to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;

drop policy if exists "signed-in read" on jobs;
create policy "signed-in read" on jobs for select to authenticated using (true);

drop policy if exists "signed-in read" on source_runs;
create policy "signed-in read" on source_runs for select to authenticated using (true);
