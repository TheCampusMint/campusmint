-- Registered organization source slots. Official adapters remain disabled until a reviewed
-- university API or feed is configured. Development sources contain synthetic records only.

insert into public.data_sources (
  id, university_id, name, source_type, url, sync_method, refresh_interval,
  enabled, adapter_key, metadata
) values
  (
    '10000000-0000-4000-8000-000000000020', 'tamu',
    'Texas A&M Organization Directory (registered source)', 'organizations', null,
    'manual', 'manual', false, 'tamu-official-organizations',
    '{"policy":"Configure a reviewed official API or feed before enabling. Random scraping is prohibited."}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000021', 'tamu',
    'Texas A&M Organizations Development Dataset', 'organizations', null,
    'manual', 'manual', true, 'tamu-development-organizations',
    '{"development":true,"warning":"Synthetic records only; never present as an official directory."}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000020', 'blinn',
    'Blinn Organization Directory (registered source)', 'organizations', null,
    'manual', 'manual', false, 'blinn-official-organizations',
    '{"policy":"Configure a reviewed official API or feed before enabling. Random scraping is prohibited."}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000021', 'blinn',
    'Blinn Organizations Development Dataset', 'organizations', null,
    'manual', 'manual', true, 'blinn-development-organizations',
    '{"development":true,"warning":"Synthetic records only; never present as an official directory."}'::jsonb
  )
on conflict (university_id, adapter_key) do update set
  name = excluded.name,
  source_type = excluded.source_type,
  url = excluded.url,
  sync_method = excluded.sync_method,
  refresh_interval = excluded.refresh_interval,
  enabled = excluded.enabled,
  metadata = excluded.metadata,
  updated_at = now();
