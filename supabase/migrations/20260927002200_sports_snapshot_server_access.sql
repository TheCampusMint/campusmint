-- Provider refreshes run on the trusted server. Keep sports snapshots
-- inaccessible to direct browser clients while allowing verified updates.
grant select, insert, update on public.sports_program_snapshots to service_role;
