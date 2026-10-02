-- Post-session disorder analysis: job queue + results.
-- Run this whole file once in the Supabase SQL Editor. Safe to re-run.
--
-- Design notes:
--  * Only the Backend (service-role key) touches these tables. RLS is enabled with
--    NO policies, so the anon/authenticated keys cannot read or write them.
--  * No plaintext message text is stored anywhere here -- messages stay encrypted
--    in chat_messages. Results only reference messages by turn number.
--  * session_id / user_id are plain text with no foreign keys, so this can't fail
--    on a uuid-vs-text mismatch with your existing tables.

-- ─── 1. Job queue ────────────────────────────────────────────────────────────
create table if not exists public.analysis_jobs (
  id          bigint generated always as identity primary key,
  session_id  text        not null unique,        -- unique => one job per session
  user_id     text        not null,
  status      text        not null default 'pending'
              check (status in ('pending', 'processing', 'done', 'failed', 'skipped')),
  attempts    int         not null default 0,
  run_after   timestamptz not null default now(),  -- don't start before this time
  locked_at   timestamptz,                         -- set while a worker holds the job
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tiny partial index: polling only ever looks at rows that still need work.
create index if not exists analysis_jobs_open_idx
  on public.analysis_jobs (run_after)
  where status in ('pending', 'processing');

-- ─── 2. Lightweight per-session result ───────────────────────────────────────
create table if not exists public.session_analysis_summary (
  session_id           text primary key,
  user_id              text        not null,
  message_count        int         not null,
  high_risk_triggered  boolean     not null default false,
  high_risk_turns      jsonb       not null default '[]'::jsonb,  -- [{turn, suicidal_prob}]
  session_summary      jsonb       not null,                      -- {Normal, Depression, Anxiety, PTSD, Suicidal}
  dominant_flags       jsonb       not null default '[]'::jsonb,
  created_at           timestamptz not null default now()
);

create index if not exists session_analysis_summary_user_idx
  on public.session_analysis_summary (user_id, created_at desc);

-- Fast lookup of sessions that need human attention.
create index if not exists session_analysis_summary_high_risk_idx
  on public.session_analysis_summary (created_at desc)
  where high_risk_triggered;

-- ─── 3. Full per-turn audit detail (never sent to any client) ────────────────
create table if not exists public.session_analysis_audit_log (
  session_id       text primary key,
  user_id          text        not null,
  per_turn_detail  jsonb       not null,   -- [{turn_index, probabilities, primary, is_high_risk}]
  created_at       timestamptz not null default now()
);

-- ─── 4. Lock everything down (service role bypasses RLS; nobody else gets in) ─
alter table public.analysis_jobs              enable row level security;
alter table public.session_analysis_summary   enable row level security;
alter table public.session_analysis_audit_log enable row level security;

-- ─── 5. Atomic job claiming ──────────────────────────────────────────────────
-- Picks up to batch_size due jobs and marks them 'processing' in one statement.
-- FOR UPDATE SKIP LOCKED means two workers (or a redeploy overlap) can never
-- grab the same job. Also rescues jobs stuck in 'processing' for >10 minutes
-- (e.g. the Backend restarted mid-job), but gives up after 5 total attempts.
create or replace function public.claim_analysis_jobs(batch_size int default 2)
returns setof public.analysis_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select id
    from public.analysis_jobs
    where (status = 'pending' and run_after <= now())
       or (status = 'processing' and locked_at < now() - interval '10 minutes' and attempts < 5)
    order by run_after
    limit batch_size
    for update skip locked
  )
  update public.analysis_jobs j
     set status     = 'processing',
         locked_at  = now(),
         attempts   = j.attempts + 1,
         updated_at = now()
    from picked
   where j.id = picked.id
  returning j.*;
end;
$$;

-- Only the service role may call it (not anon / logged-in users).
revoke all on function public.claim_analysis_jobs(int) from public, anon, authenticated;
grant execute on function public.claim_analysis_jobs(int) to service_role;

-- ─── 6. Sanity checks (run these separately and send me the output) ──────────
-- select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'chat_messages' order by ordinal_position;
-- select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'sessions' and column_name = 'id';
