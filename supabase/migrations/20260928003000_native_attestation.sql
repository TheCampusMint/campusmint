-- Checkpoint NATIVE-02. Prepared only; explicit approval required before remote apply.
begin;
create table public.native_auth_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.native_attest_keys (
  key_id text primary key check (length(key_id) = 44),
  user_id uuid not null references auth.users(id) on delete cascade,
  public_key text not null check (length(public_key) < 2048),
  receipt text not null check (length(receipt) < 24000),
  environment text not null check (environment in ('development', 'production')),
  sign_count bigint not null default 0 check (sign_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index native_attest_keys_owner on public.native_attest_keys(user_id);
create table public.native_attest_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge text not null check (length(challenge) = 43),
  purpose text not null check (purpose in ('register', 'assert')),
  key_id text,
  method text,
  path text,
  body_hash text,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  check ((purpose = 'register' and key_id is null and method is null and path is null and body_hash is null)
    or (purpose = 'assert' and key_id is not null and method in ('POST','PATCH','DELETE','PUT') and path like '/api/%' and body_hash ~ '^[a-f0-9]{64}$'))
);
create index native_attest_challenges_expiry on public.native_attest_challenges(expires_at);
create index native_auth_sessions_expiry on public.native_auth_sessions(expires_at);
alter table public.native_auth_sessions enable row level security;
alter table public.native_attest_keys enable row level security;
alter table public.native_attest_challenges enable row level security;
revoke all on public.native_auth_sessions, public.native_attest_keys, public.native_attest_challenges from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.native_auth_sessions to service_role;
grant select on public.native_attest_keys to service_role;
grant select, insert on public.native_attest_challenges to service_role;

-- Atomic challenge consumption prevents two concurrent valid requests replaying.
create function public.register_native_attest_key(p_challenge_id uuid, p_user_id uuid, p_key_id text, p_public_key text, p_receipt text, p_environment text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  if (select count(*) from public.native_attest_keys where user_id = p_user_id and revoked_at is null) >= 10 then
    raise exception 'Device limit reached' using errcode = '42501';
  end if;
  delete from public.native_attest_challenges where id = p_challenge_id and user_id = p_user_id and purpose = 'register' and expires_at > now();
  if not found then raise exception 'Challenge unavailable' using errcode = '42501'; end if;
  insert into public.native_attest_keys(key_id,user_id,public_key,receipt,environment)
    values(p_key_id,p_user_id,p_public_key,p_receipt,p_environment);
end $$;

create function public.consume_native_assertion(p_challenge_id uuid, p_user_id uuid, p_key_id text, p_previous_count bigint, p_next_count bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_next_count <= p_previous_count then raise exception 'Invalid counter' using errcode = '42501'; end if;
  update public.native_attest_keys set sign_count = p_next_count
    where key_id = p_key_id and user_id = p_user_id and revoked_at is null and sign_count = p_previous_count;
  if not found then raise exception 'Assertion replay' using errcode = '42501'; end if;
  delete from public.native_attest_challenges where id = p_challenge_id and user_id = p_user_id and key_id = p_key_id and purpose = 'assert' and expires_at > now();
  if not found then raise exception 'Challenge unavailable' using errcode = '42501'; end if;
end $$;

create function public.prune_native_challenges() returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.native_attest_challenges where id in (select id from public.native_attest_challenges where expires_at < now() limit 5000);
  delete from public.native_auth_sessions where session_id in (select session_id from public.native_auth_sessions where expires_at < now() - interval '30 days' limit 5000);
end $$;
revoke all on function public.register_native_attest_key(uuid,uuid,text,text,text,text), public.consume_native_assertion(uuid,uuid,text,bigint,bigint), public.prune_native_challenges() from public, anon, authenticated;
grant execute on function public.register_native_attest_key(uuid,uuid,text,text,text,text), public.consume_native_assertion(uuid,uuid,text,bigint,bigint), public.prune_native_challenges() to service_role;
commit;
