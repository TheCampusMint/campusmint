-- Inactive foundations for reliable media cleanup, owner-only Archives,
-- provider licensing boundaries, and human moderation review. Server jobs and
-- WebAuthn enrollment must be configured before these features are exposed.

create type public.media_cleanup_status as enum ('pending', 'processing', 'complete', 'retry', 'failed');
create type public.archive_status as enum ('preparing', 'ready', 'failed', 'deleted');
create type public.review_action_kind as enum ('triage', 'restrict', 'remove', 'restore', 'dismiss', 'escalate');

create table public.media_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references public.social_content(id) on delete set null,
  bucket_id text not null,
  storage_path text not null,
  due_at timestamptz not null,
  status public.media_cleanup_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count between 0 and 25),
  last_error_code text,
  next_attempt_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, storage_path)
);

create table public.archive_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  auto_archive_temporary boolean not null default true,
  save_captured_media_to_device boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.private_content_archives (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_content_id uuid references public.social_content(id) on delete set null,
  source_was_temporary boolean not null,
  caption text,
  metadata jsonb not null default '{}'::jsonb,
  status public.archive_status not null default 'preparing',
  ready_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'ready' and ready_at is not null) or status <> 'ready')
);

create table public.private_archive_media (
  id uuid primary key default gen_random_uuid(),
  archive_id uuid not null references public.private_content_archives(id) on delete cascade,
  storage_path text not null unique,
  media_type public.social_media_type not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (archive_id, sort_order)
);

create table public.web_authn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key bytea not null,
  sign_count bigint not null default 0 check (sign_count >= 0),
  transports text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table public.media_provider_registrations (
  provider_key text primary key,
  media_kind text not null check (media_kind in ('music', 'sound', 'gif', 'sticker')),
  status text not null default 'unavailable' check (status in ('unavailable', 'sandbox', 'licensed', 'disabled')),
  permitted_uses text[] not null default '{}'::text[],
  terms_url text,
  attribution_requirement text,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (status <> 'licensed' or (terms_url is not null and reviewed_at is not null))
);

create table public.content_review_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.content_reports(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action public.review_action_kind not null,
  assistant_signal jsonb,
  human_decision boolean not null default false,
  rationale text,
  created_at timestamptz not null default now(),
  check (action in ('triage', 'escalate') or human_decision)
);

create table public.content_review_appeals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.content_reports(id) on delete cascade,
  appellant_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'under_review', 'upheld', 'overturned')),
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.mark_expired_social_content()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  insert into public.media_cleanup_jobs (content_id, bucket_id, storage_path, due_at)
  select content.id, 'mint-media', media.storage_path, now()
  from public.social_content content
  join public.content_media media on media.content_id = content.id
  where content.status = 'active'
    and content.expires_at is not null
    and content.expires_at <= now()
  on conflict (bucket_id, storage_path) do nothing;

  update public.social_content
  set status = 'expired', updated_at = now()
  where status = 'active' and expires_at is not null and expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.mark_expired_social_content() from public, anon, authenticated;
grant execute on function public.mark_expired_social_content() to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mint-archive', 'mint-archive', false, 104857600, array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do nothing;

create policy "Owners read their private Archive media" on storage.objects
for select to authenticated using (bucket_id = 'mint-archive' and (storage.foldername(name))[1] = auth.uid()::text);

create trigger media_cleanup_jobs_set_updated_at before update on public.media_cleanup_jobs for each row execute function public.set_updated_at();
create trigger archive_preferences_set_updated_at before update on public.archive_preferences for each row execute function public.set_updated_at();
create trigger private_content_archives_set_updated_at before update on public.private_content_archives for each row execute function public.set_updated_at();
create trigger media_provider_registrations_set_updated_at before update on public.media_provider_registrations for each row execute function public.set_updated_at();

alter table public.media_cleanup_jobs enable row level security;
alter table public.archive_preferences enable row level security;
alter table public.private_content_archives enable row level security;
alter table public.private_archive_media enable row level security;
alter table public.web_authn_credentials enable row level security;
alter table public.media_provider_registrations enable row level security;
alter table public.content_review_actions enable row level security;
alter table public.content_review_appeals enable row level security;

create policy archive_preferences_owner_read on public.archive_preferences for select to authenticated using (user_id = auth.uid());
create policy private_content_archives_owner_read on public.private_content_archives for select to authenticated using (owner_user_id = auth.uid());
create policy private_archive_media_owner_read on public.private_archive_media for select to authenticated using (exists (select 1 from public.private_content_archives archive where archive.id = archive_id and archive.owner_user_id = auth.uid()));
create policy web_authn_credentials_owner_metadata_read on public.web_authn_credentials for select to authenticated using (user_id = auth.uid());
create policy content_review_appeals_owner_read on public.content_review_appeals for select to authenticated using (appellant_user_id = auth.uid());

revoke all on public.media_cleanup_jobs, public.archive_preferences, public.private_content_archives,
  public.private_archive_media, public.web_authn_credentials, public.media_provider_registrations,
  public.content_review_actions, public.content_review_appeals from anon, authenticated;
grant select on public.archive_preferences, public.private_content_archives, public.private_archive_media,
  public.web_authn_credentials, public.content_review_appeals to authenticated;
grant select, insert, update, delete on public.media_cleanup_jobs, public.archive_preferences,
  public.private_content_archives, public.private_archive_media, public.web_authn_credentials,
  public.media_provider_registrations, public.content_review_actions, public.content_review_appeals to service_role;

comment on table public.media_cleanup_jobs is 'Retryable queue; a separately configured server worker must delete expired public objects.';
comment on table public.private_content_archives is 'Owner-only copy, distinct from a hidden or expired public post.';
comment on table public.web_authn_credentials is 'Passkey credential storage only; Archive UI remains disabled until a server challenge ceremony is implemented.';
comment on table public.media_provider_registrations is 'A catalog is unavailable unless its licensed permitted uses are explicitly registered.';
comment on column public.content_review_actions.assistant_signal is 'Non-authoritative triage signal; removal/restoration requires a human decision.';
