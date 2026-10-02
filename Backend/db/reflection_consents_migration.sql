-- Records each time a (former) guest agrees to have their conversation saved and analysed
-- to prepare "reflections", at the moment they sign in / sign up. This is the consent
-- evidence: who, when, which wording version, and which sessions it covered.
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Deliberately NO message text and no email here. RLS is on with no policies, so only the
-- Backend (service-role key) can read or write it.

create table if not exists public.reflection_consents (
  id               bigint generated always as identity primary key,
  user_id          text        not null,
  guest_id         text        not null,          -- raw guest UUID (no "guest_" prefix)
  consent_version  text        not null,          -- which consent wording the user saw
  session_ids      text[]      not null default '{}',
  consented_at     timestamptz not null default now()
);

create index if not exists reflection_consents_user_idx
  on public.reflection_consents (user_id, consented_at desc);

alter table public.reflection_consents enable row level security;
