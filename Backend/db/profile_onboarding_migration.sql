alter table public.profiles
  add column if not exists gender text,
  add column if not exists profession text,
  add column if not exists age_group text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_skipped boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_age_group_check'
  ) then
    alter table public.profiles
      add constraint profiles_age_group_check
      check (
        age_group is null
        or age_group in (
          'under-18',
          '18-24',
          '25-34',
          '35-44',
          '45-54',
          '55+',
          'prefer-not-to-say'
        )
      )
      not valid;

    alter table public.profiles
      validate constraint profiles_age_group_check;
  end if;
end $$;
