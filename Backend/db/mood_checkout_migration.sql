alter table public.sessions
  add column if not exists mood_checkout smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_mood_checkout_check'
  ) then
    alter table public.sessions
      add constraint sessions_mood_checkout_check
      check (mood_checkout is null or mood_checkout between 1 and 5)
      not valid;

    alter table public.sessions
      validate constraint sessions_mood_checkout_check;
  end if;
end $$;
