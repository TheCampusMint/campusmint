-- The authenticated composer endpoint scopes these public catalogs to a user's
-- campus. This grants read access to the trusted server, not to browser clients.
grant select on public.organizations, public.campus_events to service_role;
