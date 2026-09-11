-- Production university configuration required by downstream migrations.
-- Development academic fixtures live in application test/development data,
-- never in the production migration history.

insert into public.universities
  (id, name, short_name, status, primary_color, secondary_color, source_url,
   source_type, confidence_level, effective_from, last_verified_at, is_development)
values
  ('tamu', 'Texas A&M University', 'Texas A&M', 'active', '#500000', '#ffffff',
   'https://www.tamu.edu/', 'official_source', 'official', '2026-08-08', '2026-08-08', false),
  ('blinn', 'Blinn College', 'Blinn', 'active', '#003366', '#ffffff',
   'https://www.blinn.edu/', 'official_source', 'official', '2026-08-08', '2026-08-08', false),
  ('texas', 'The University of Texas at Austin', 'Texas', 'active', '#BF5700', '#ffffff',
   'https://www.utexas.edu/', 'official_source', 'official', '2026-08-08', '2026-08-08', false),
  ('lsu', 'Louisiana State University', 'LSU', 'active', '#35145F', '#F4D35E',
   'https://www.lsu.edu/', 'official_source', 'official', '2026-08-08', '2026-08-08', false),
  ('alabama', 'The University of Alabama', 'Alabama', 'active', '#7A1426', '#F8F8F8',
   'https://www.ua.edu/', 'official_source', 'official', '2026-08-08', '2026-08-08', false)
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  status = excluded.status,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  source_url = excluded.source_url,
  source_type = excluded.source_type,
  confidence_level = excluded.confidence_level,
  effective_from = excluded.effective_from,
  effective_until = null,
  last_verified_at = excluded.last_verified_at,
  is_development = false,
  updated_at = now();

-- These official sources are registrations only. Imports remain disabled until
-- their university-specific parsers have been reviewed against the live sites.
insert into public.data_sources
  (id, university_id, name, source_type, url, sync_method, refresh_interval,
   enabled, adapter_key, metadata)
values
  ('10000000-0000-4000-8000-000000000001', 'tamu', 'Texas A&M Undergraduate Catalog', 'course_catalog',
   'https://catalog.tamu.edu/undergraduate/course-descriptions/', 'html', 'weekly', false,
   'tamu-official-catalog', '{"official":true,"automaticImport":"disabled_pending_review"}'::jsonb),
  ('10000000-0000-4000-8000-000000000002', 'tamu', 'Texas A&M Academic Programs', 'academic_catalog',
   'https://www.tamu.edu/academics/programs/index.html', 'html', 'weekly', false,
   'tamu-official-programs', '{"official":true,"automaticImport":"disabled_pending_review"}'::jsonb),
  ('20000000-0000-4000-8000-000000000001', 'blinn', 'Blinn College Academic Affairs', 'academic_catalog',
   'https://www.blinn.edu/academics/index.html', 'html', 'weekly', false,
   'blinn-official-academics', '{"official":true,"automaticImport":"disabled_pending_review"}'::jsonb)
on conflict (id) do update set
  university_id = excluded.university_id,
  name = excluded.name,
  source_type = excluded.source_type,
  url = excluded.url,
  sync_method = excluded.sync_method,
  refresh_interval = excluded.refresh_interval,
  enabled = false,
  adapter_key = excluded.adapter_key,
  metadata = excluded.metadata,
  updated_at = now();
