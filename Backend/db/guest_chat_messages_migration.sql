-- Guest chat storage, kept SEPARATE from registered users' chat_messages.
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
--  * Messages are encrypted by the Backend (same AES-GCM scheme as chat_messages, keyed
--    by the guest id), so this table never holds plaintext.
--  * Only written when the Backend has STORE_GUEST_CHATS=true (off by default).
--  * RLS enabled with NO policies: only the service-role key can read/write.
--  * Deleting a session row deletes its guest messages (ON DELETE CASCADE).

create table if not exists public.guest_chat_messages (
  id          bigint generated always as identity primary key,
  session_id  uuid        not null references public.sessions(id) on delete cascade,
  guest_id    text        not null,          -- full id incl. "guest_" prefix (used as the encryption salt)
  user_msg    text        not null,          -- encrypted
  ai_reply    text        not null,          -- encrypted
  mode        text,                          -- 'chat' | 'voice'
  created_at  timestamptz not null default now()
);

create index if not exists guest_chat_messages_session_idx
  on public.guest_chat_messages (session_id, created_at);

-- Supports the retention purge below.
create index if not exists guest_chat_messages_created_idx
  on public.guest_chat_messages (created_at);

alter table public.guest_chat_messages enable row level security;

-- ─── Retention purge ─────────────────────────────────────────────────────────
-- Guests are anonymous and cannot ask for deletion, so old chats should expire.
-- Call manually (or from a scheduled job) e.g.:  select public.purge_old_guest_chat_messages(30);
-- Returns how many rows were deleted. Not scheduled automatically.
create or replace function public.purge_old_guest_chat_messages(older_than_days int default 30)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count bigint;
begin
  delete from public.guest_chat_messages
   where created_at < now() - make_interval(days => older_than_days);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_old_guest_chat_messages(int) from public, anon, authenticated;
grant execute on function public.purge_old_guest_chat_messages(int) to service_role;
