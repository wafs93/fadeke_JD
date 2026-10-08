# Fadeke's Job Desk

A private web app that finds remote Virtual Assistant jobs for one job seeker in Lagos. It scores each job against her master profile, flags scams and jobs that aren't open to Nigeria, writes a tailored application kit, and tracks her applications.

**It never submits an application.** It prepares the kit. Fadeke reads it, edits it and applies on the company's own site.

Screens: **Job feed** (ranked list + detail pane), **Tracker** (kanban), **Scam check** (paste a post), **Profile** (master profile editor).

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, RLS) · OpenAI GPT-4o (server-side only) · `docx` · Vercel + Vercel Cron · optional Telegram digest.

## Setup

### 1. Supabase

1. Create a project.
2. Open **SQL Editor**, paste the whole of [supabase/schema.sql](supabase/schema.sql) and run it. The script is idempotent, so you can run it again safely.
3. **Authentication → Users → Add user**: create Fadeke's login (email + password, auto-confirm).
4. **Authentication → Providers → Email**: turn off "Allow new users to sign up" so nobody else can create an account.

#### Migration notes

- **003 (Add a job):** run [supabase/migrations/003_pasted_jobs.sql](supabase/migrations/003_pasted_jobs.sql). It adds `jobs.owner_id` and `jobs.content_hash`, and changes the jobs read policy to "public jobs, plus your own pasted ones". Until it's run, "Add a job" shows a message asking for it, and everything else works as before.
- **002 (Nigeria evidence):** run [supabase/migrations/002_ng_evidence.sql](supabase/migrations/002_ng_evidence.sql), then `npm run reevaluate`. It adds `jobs.ng_evidence`, `ng_method` and `ng_checked_at`. Until then the app still works: the evidence quote is kept in `ng_reason`, but the AI location check is paused, because there is nowhere to record that a job was already checked.

- `schema.sql` creates `profiles`, `experiences`, `education`, `jobs`, `matches`, `kits`, `applications`, plus a small `source_runs` table. `source_runs` stores the last fetch time per job source and enforces each provider's rate limit.
- It adds these columns beyond the spec: `experiences.sort_order`, `profiles.updated_at` and `applications.updated_at`. It also adds `unique (user_id, job_id)` on `applications`, so each job has one tracker card.
- RLS: every per-user table only allows `auth.uid() = user_id`. `jobs` and `source_runs` are readable by signed-in users and writable only by the service role (cron/fetcher).
- Indexes: `jobs(posted_at desc)` and `matches(user_id, score desc)`, plus helper indexes on experiences, kits and applications.
- For later changes, add numbered files under `supabase/migrations/` and keep `schema.sql` as the full current state.

### 2. Environment

```bash
cp .env.example .env.local   # gitignored
```

Fill in the Supabase URL, anon key, service role key, `OPENAI_API_KEY` and `CRON_SECRET` (any long random string). See [.env.example](.env.example) for the optional settings.

### 3. Seed the master profile (one time)

```bash
cp seed.example.json seed.local.json   # gitignored; seed.example.json holds fake values only
# edit seed.local.json: set auth_email to Fadeke's login email, check the facts
npm install
npm run seed
```

- The seed **never** writes her email or phone. She enters those on the Profile page, and they're stored only in Supabase.
- Roles with `"verified": false` (Lagos Land Check, WafsDesign) are saved with no duties, whatever the file says. They show a **Needs confirmation** badge until she adds dates and duties and ticks the confirm box.
- Running it again refuses to overwrite. `npm run seed -- --force` replaces the experiences and education.

### 4. Run

```bash
npm run dev            # http://localhost:3000
npm test               # rules, parsers, CV composer and fact checks (no network)
npm run lint && npm run build
npm run check:sources  # one live call to each job source; writes nothing. Don't loop it.
```

### 5. Deploy (Vercel)

1. Import the repo and add the same env vars in **Project settings → Environment Variables**.
2. [vercel.json](vercel.json) schedules three daily crons (UTC): fetch at 05:00, match at 06:00, digest at 07:00 (06:00 to 08:00 in Lagos). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. On the Hobby plan, each cron fires once a day at some point within its hour.
3. To run a step by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/fetch`.
4. **Fetching every 6 hours:** [.github/workflows/fetch-jobs.yml](.github/workflows/fetch-jobs.yml) calls `/api/cron/fetch-jobs` (an alias of `/api/cron/fetch`) every 6 hours. Add the repository secrets `APP_URL` and `CRON_SECRET` under **Settings → Secrets and variables → Actions**. Each source still enforces its own minimum gap, and scoring stays on the daily Vercel cron.

The **Fetch new jobs** and **Score new jobs** buttons on the feed run the same steps on demand. They respect the same rate limits.

## How it works

### Job sources (official APIs and public RSS only)

| Source | Endpoint | Min. gap between fetches |
|---|---|---|
| Remotive | `remotive.com/api/remote-jobs` | 12 h (2 requests per run) |
| Remote OK | `remoteok.com/api` | 6 h |
| We Work Remotely | public category RSS feeds | 3 h |
| Jobicy | `jobicy.com/api/v2/remote-jobs` | 6 h (their guidance: at most hourly) |
| Himalayas | `himalayas.app/jobs/api/search` | 12 h (their data refreshes daily) |

| Greenhouse, Lever, Ashby, Workable | public job board APIs, one request per company in [config/companies.json](config/companies.json) | 6 h |
| Working Nomads | `workingnomads.com/api/exposed_jobs/` (linked as "API" in their footer) | 6 h |

- Company boards: edit [config/companies.json](config/companies.json) (`board` + `slug`) to add or remove companies. These boards only list jobs that are still open, so the 30-day age cutoff doesn't apply to them.
- Skipped on purpose: Jooble (its API is for website publishers), Arbeitnow (Europe only), Jobspresso (its robots.txt disallows the feed URL).
- No LinkedIn, Indeed or other scraping.
- Every job links back to its original listing and shows the source name, as each provider's terms require.
- Results are cached in `jobs`. Fetches inside a source's window are skipped.
- `JOB_SOURCES` limits which sources run.

The sandbox I built this in had no outbound network, so the adapters are written against each provider's documented format and parse defensively. Check them on the first live fetch (see "First run checklist").

### Filtering, eligibility and scams (rule-based, no AI cost)

- **Relevance**: only VA-type titles are kept, plus her target titles from Profile ([lib/relevance.ts](lib/relevance.ts)).
- **Open to Nigeria?** ([lib/eligibility.ts](lib/eligibility.ts)) gives every job one of three states, stored in `jobs.ng_eligible` (`true` open, `false` closed, `null` unclear), with `ng_reason` and the quoted `ng_evidence`:
  - **open**: only explicit wording such as worldwide, anywhere, global, all countries, Africa, Nigeria, Lagos, or a country list that includes Nigeria.
  - **closed**: anything that rules her out, including country-only wording, "must reside/be located in", work authorisation, work permits, no visa sponsorship, citizenship, US or Australian hours (EST, PST, "PT or ET"), on-site or hybrid, a place list without Nigeria, title tags like "(US)", and Himalayas time-zone ranges that leave out UTC+1. Closed signals always win.
  - **unclear**: remote with no location, or EMEA/Europe only. A small model (`OPENAI_MODEL_SMALL`, default gpt-4o-mini) reads each unclear post once. Its answer is accepted only if it quotes words that really are in the post and support that answer. Otherwise the job stays unclear.
- The feed shows **only open jobs**, each with its evidence ("Open: 'work from anywhere'"). "Show jobs that need checking" adds unclear jobs with a warning. Closed and high-scam-risk jobs never appear, and only open jobs are scored with GPT-4o.
- Himalayas is queried with `country=Nigeria`, so it returns jobs whose restrictions include Nigeria or that have none. A job with no restrictions is shown as "Worldwide (no location restrictions listed on Himalayas)".
- `npm run reevaluate` re-checks every stored job (`-- --dry-run`, `-- --no-ai`). Run it after changing the rules.

### Add a job (manual paste)

For posts she finds on LinkedIn, X, Facebook, WhatsApp or by email, she uses **Add a job**: a button on the feed, and a floating button on phones.
- The post goes through the same steps as fetched jobs: the eligibility rules, the small model only if the rules leave it unclear (quote required), the scam check, and GPT-4o scoring only if it's open and not high risk.
- The link is saved for her to open later. **It is never fetched.**
- Duplicates are caught with a SHA-256 hash of the normalised text.
- Pasted posts have `jobs.owner_id` set, so RLS shows them only to her. They carry an "Added by you" chip.
- The flow is in [lib/paste.ts](lib/paste.ts), with its database and model calls passed in, so it is unit-tested. This feature needs migration 003.

### Matching (GPT-4o)

[lib/match.ts](lib/match.ts) scores up to `MATCH_BATCH_SIZE` unscored jobs per run. It returns a score, reasons, "what you have" and "gaps". The model sees only her profile facts. For unconfirmed roles it sees the title and employer and nothing else.

### Application kit: "never invent facts"

[lib/kit.ts](lib/kit.ts):

- **The CV is assembled in code from confirmed profile data.** GPT-4o only:
  - picks which of her listed skills to show (anything not in her profile is dropped),
  - orders her existing duties,
  - writes the summary.
- Unconfirmed experiences are left out of the kit completely.
- **The cover letter and answers** are written by GPT-4o under strict rules: profile facts only, and a visible `[placeholder]` for anything missing (for example `[add rate]` when no minimum rate is set).
- **Checks** ([lib/kit-checks.ts](lib/kit-checks.ts)) run on the saved text after every edit and list:
  - unfilled placeholders,
  - any number that appears in neither her profile nor the job post,
  - any mention of an unconfirmed employer,
  - claims the profile can't back up: availability, travel, office work, years of experience, pay agreement, inflated wording ("extensive experience", "proven track record"), and results such as "saved two hours a week",
  - answers to "describe a time…" questions with no placeholder, so she confirms the story really happened.
- Export: `.docx` for the CV and cover letter (placeholders are highlighted yellow), and a print-friendly page for PDF.

### Telegram digest (optional)

Set `TELEGRAM_ENABLED=true`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` and `APP_URL`. The 07:00 UTC cron sends new matches scoring 60 or more, plus follow-ups due. With the flag off, the route does nothing.

## First run checklist

1. Sign in, then open **Profile**:
   - add email, phone and minimum hourly rate,
   - confirm or fill in the Lagos Land Check and WafsDesign roles.
2. **Job feed → Fetch new jobs**. Every source should report ✓ with a count. If a source shows ✕, its feed format may have changed; the error message names it.
3. **Score new jobs**, open a job, then **Build application kit**.
