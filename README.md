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
npm run dev     # http://localhost:3000
npm run build && npm run lint
```

### 5. Deploy (Vercel)

1. Import the repo and add the same env vars in **Project settings → Environment Variables**.
2. [vercel.json](vercel.json) schedules three daily crons (UTC): fetch at 05:00, match at 06:00, digest at 07:00 (06:00 to 08:00 in Lagos). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. On the Hobby plan, each cron fires once a day at some point within its hour.
3. To run a step by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/fetch`.

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

- No LinkedIn, Indeed or other scraping.
- Every job links back to its original listing and shows the source name, as each provider's terms require.
- Results are cached in `jobs`. Fetches inside a source's window are skipped.
- `JOB_SOURCES` limits which sources run.

The sandbox I built this in had no outbound network, so the adapters are written against each provider's documented format and parse defensively. Check them on the first live fetch (see "First run checklist").

### Filtering, eligibility and scams (rule-based, no AI cost)

- **Relevance**: only VA-type titles are kept, plus her target titles from Profile ([lib/relevance.ts](lib/relevance.ts)).
- **Open to Nigeria?** ([lib/eligibility.ts](lib/eligibility.ts)): `true` only if the post says worldwide, Nigeria or Africa. `false` if it names other countries only, or says "US only", "authorized to work in the US" and similar. Otherwise `null` ("Check location"). Every result carries a reason.
- **Scam score** ([lib/scam.ts](lib/scam.ts)): weighted signals such as fees, cheques, gift cards or crypto, BVN/NIN/bank requests, Telegram/WhatsApp-only contact, no interview, unrealistic pay, personal email and reshipping. Each flag stores the matching text as evidence. 0–19 is low, 20–49 medium, 50+ high.
- Jobs that are closed to Nigeria or high scam risk are hidden from the feed by default (one click shows them) and are never sent to GPT-4o.

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
  - any mention of an unconfirmed employer.
- Export: `.docx` for the CV and cover letter (placeholders are highlighted yellow), and a print-friendly page for PDF.

### Telegram digest (optional)

Set `TELEGRAM_ENABLED=true`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` and `APP_URL`. The 07:00 UTC cron sends new matches scoring 60 or more, plus follow-ups due. With the flag off, the route does nothing.

## First run checklist

1. Sign in, then open **Profile**:
   - add email, phone and minimum hourly rate,
   - confirm or fill in the Lagos Land Check and WafsDesign roles.
2. **Job feed → Fetch new jobs**. Every source should report ✓ with a count. If a source shows ✕, its feed format may have changed; the error message names it.
3. **Score new jobs**, open a job, then **Build application kit**.
