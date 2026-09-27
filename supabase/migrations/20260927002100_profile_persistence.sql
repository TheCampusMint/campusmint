-- A person with one name must not have that name copied into a fabricated surname.
alter table public.profiles drop constraint if exists profiles_last_name_check;
alter table public.profiles add constraint profiles_last_name_check
  check (char_length(last_name) between 0 and 80);

-- These are editable profile/discovery attributes, not enrollment or club membership grants.
alter table public.profiles add column if not exists profile_details jsonb not null default '{}'::jsonb
  check (jsonb_typeof(profile_details) = 'object' and octet_length(profile_details::text) <= 65536);
comment on column public.profiles.profile_details is
  'Owner-edited discovery attributes: academic area, interests in classes/clubs, hobbies, roommate preferences and tutoring subjects. Never an authorization source.';
