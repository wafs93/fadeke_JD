-- 003: jobs Fadeke pastes in herself ("Add a job")
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- owner_id null  = a job from a public feed, visible to every signed-in user
-- owner_id set   = a post that user pasted; only they can see it
-- content_hash   = sha256 of the normalised post text, to stop duplicates

alter table jobs add column if not exists owner_id uuid references auth.users (id) on delete cascade;
alter table jobs add column if not exists content_hash text;

create unique index if not exists jobs_owner_content_hash_idx
  on jobs (owner_id, content_hash)
  where owner_id is not null;

create index if not exists jobs_owner_idx on jobs (owner_id) where owner_id is not null;

-- Replace the read policy: public feed jobs, plus the user's own pasted posts.
drop policy if exists "signed-in read" on jobs;
create policy "signed-in read" on jobs for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
