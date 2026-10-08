-- 002: evidence for Nigeria eligibility
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- jobs.ng_eligible keeps the three states: true = open, false = closed,
-- null = unclear. These columns record why, and how it was decided.

alter table jobs add column if not exists ng_evidence text;      -- phrase quoted from the post
alter table jobs add column if not exists ng_method text;        -- 'rules' or 'ai'
alter table jobs add column if not exists ng_checked_at timestamptz;

create index if not exists jobs_ng_eligible_idx on jobs (ng_eligible, posted_at desc);
