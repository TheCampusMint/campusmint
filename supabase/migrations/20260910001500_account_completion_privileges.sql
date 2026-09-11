-- Account completion is executed by trusted server routes. RLS policies still
-- constrain authenticated browser access, while the service role needs explicit
-- SQL privileges in addition to its RLS bypass.

grant select, insert, update on table
  public.profile_identities,
  public.profiles,
  public.profile_privacy_settings,
  public.brand_profiles,
  public.brand_channels
to service_role;

-- Account hydration happens with the authenticated user's session and remains
-- restricted to the existing owner/read policies on each table.
grant select on table
  public.profile_identities,
  public.profiles,
  public.profile_privacy_settings,
  public.brand_profiles,
  public.brand_channels
to authenticated;

comment on table public.profile_identities is
  'Server-managed university, role, and verification identity. Trusted account completion has explicit service-role write privileges; client access remains RLS-restricted.';
