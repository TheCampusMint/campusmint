-- Small source-backed seed. No ratings, reviews, wait times, popularity, or occupancy are invented.

insert into public.data_sources
  (id, university_id, name, source_type, url, sync_method, refresh_interval, enabled, adapter_key, metadata)
values
  ('10000000-0000-4000-8000-000000000010', 'tamu', 'Texas A&M Dining Services', 'dining',
   'https://www.tamu.edu/campus-community/dining.html', 'html', 'daily', false, 'tamu-official-dining',
   '{"official":true,"automaticImport":"disabled_pending_review"}'::jsonb),
  ('10000000-0000-4000-8000-000000000011', 'tamu', 'Texas A&M Residence Life', 'housing',
   'https://reslife.tamu.edu/housing-options/', 'html', 'weekly', false, 'tamu-official-housing',
   '{"official":true,"automaticImport":"disabled_pending_review"}'::jsonb),
  ('20000000-0000-4000-8000-000000000010', 'blinn', 'Blinn College Food Services', 'dining',
   'https://www.blinn.edu/food-services/index.html', 'html', 'daily', false, 'blinn-official-dining',
   '{"official":true,"automaticImport":"disabled_pending_review"}'::jsonb),
  ('20000000-0000-4000-8000-000000000011', 'blinn', 'Blinn Brenham Housing and Residence Life', 'housing',
   'https://www2.blinn.edu/housing/index.html', 'html', 'weekly', false, 'blinn-official-housing',
   '{"official":true,"automaticImport":"disabled_pending_review"}'::jsonb),
  ('10000000-0000-4000-8000-000000000012', 'tamu', 'Google Places API (New)', 'dining',
   'https://developers.google.com/maps/documentation/places/web-service/overview', 'api', 'manual', false, 'google-places',
   '{"storePlaceIdsOnly":true,"cacheProviderContent":false}'::jsonb),
  ('20000000-0000-4000-8000-000000000012', 'blinn', 'Google Places API (New)', 'dining',
   'https://developers.google.com/maps/documentation/places/web-service/overview', 'api', 'manual', false, 'google-places',
   '{"storePlaceIdsOnly":true,"cacheProviderContent":false}'::jsonb)
on conflict (id) do update set
  name = excluded.name, url = excluded.url, enabled = excluded.enabled,
  adapter_key = excluded.adapter_key, metadata = excluded.metadata;

insert into public.campus_entities
  (id, university_id, external_id, entity_type, name, description, status, address,
   source_id, source_url, source_type, confidence_level, effective_from, last_verified_at, is_development)
values
  ('d1000000-0000-4000-8000-000000000001', 'tamu', 'official-tamu-sbisa', 'dining_location', 'Sbisa Dining Hall',
   'Official Texas A&M dining hall listing.', 'open', '233 Houston St, College Station, TX 77843',
   '10000000-0000-4000-8000-000000000010', 'https://www.tamu.edu/campus-community/dining.html',
   'official_source', 'official', '2026-08-08', '2026-08-08', false),
  ('d1000000-0000-4000-8000-000000000002', 'tamu', 'official-tamu-commons', 'dining_location', 'The Commons Dining Hall',
   'Official Texas A&M dining hall listing.', 'open', null,
   '10000000-0000-4000-8000-000000000010', 'https://www.tamu.edu/campus-community/dining.html',
   'official_source', 'official', '2026-08-08', '2026-08-08', false),
  ('d2000000-0000-4000-8000-000000000001', 'blinn', 'official-blinn-brenham-cafeteria', 'dining_location', 'Brenham Campus Cafeteria',
   'Official Blinn College Brenham food-service listing.', 'open', 'Brenham Campus Student Center, 902 College Ave, Brenham, TX 77833',
   '20000000-0000-4000-8000-000000000010', 'https://www.blinn.edu/food-services/index.html',
   'official_source', 'official', '2026-08-08', '2026-08-08', false),
  ('d2000000-0000-4000-8000-000000000002', 'blinn', 'official-blinn-bryan-cafeteria', 'dining_location', 'Bryan Campus Cafeteria',
   'Official Blinn College Bryan food-service listing.', 'open', 'Blinn College Bryan Student Center, first floor',
   '20000000-0000-4000-8000-000000000010', 'https://www.blinn.edu/food-services/bryan-campus.html',
   'official_source', 'official', '2026-08-08', '2026-08-08', false),
  ('h1000000-0000-4000-8000-000000000001', 'tamu', 'official-tamu-clements', 'housing', 'Clements Hall',
   'Official Texas A&M Residence Life housing option.', 'open', null,
   '10000000-0000-4000-8000-000000000011', 'https://reslife.tamu.edu/housing-options/',
   'official_source', 'official', '2026-08-08', '2026-08-08', false),
  ('h1000000-0000-4000-8000-000000000002', 'tamu', 'official-tamu-gardens', 'housing', 'The Gardens Apartments',
   'Official Texas A&M university-apartment option.', 'open', null,
   '10000000-0000-4000-8000-000000000011', 'https://reslife.tamu.edu/housing-options/',
   'official_source', 'official', '2026-08-08', '2026-08-08', false),
  ('h2000000-0000-4000-8000-000000000001', 'blinn', 'official-blinn-beazley', 'housing', 'Beazley Dormitories',
   'Official Blinn-Brenham on-campus housing.', 'open', '902 College Ave, Brenham, TX 77833',
   '20000000-0000-4000-8000-000000000011', 'https://www2.blinn.edu/housing/index.html',
   'official_source', 'official', '2026-08-08', '2026-08-08', false),
  ('h2000000-0000-4000-8000-000000000002', 'blinn', 'official-blinn-park', 'housing', 'Blinn College Park Apartments',
   'Official Blinn-Brenham on-campus apartment housing.', 'open', '902 College Ave, Brenham, TX 77833',
   '20000000-0000-4000-8000-000000000011', 'https://www2.blinn.edu/housing/index.html',
   'official_source', 'official', '2026-08-08', '2026-08-08', false)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, address = excluded.address,
  source_url = excluded.source_url, last_verified_at = excluded.last_verified_at, updated_at = now();

insert into public.dining_locations
  (id, campus_id, campus_area, dining_scope, categories, regular_hours, special_hours, today_menu_url, website)
values
  ('d1000000-0000-4000-8000-000000000001', 'tamu', 'Texas A&M · College Station', 'on_campus',
   array['On-campus dining','Dining hall'], '[]'::jsonb, null,
   'https://www.tamu.edu/campus-community/dining.html', 'https://www.tamu.edu/campus-community/dining.html'),
  ('d1000000-0000-4000-8000-000000000002', 'tamu', 'Texas A&M · College Station', 'on_campus',
   array['On-campus dining','Dining hall'], '[]'::jsonb, null,
   'https://www.tamu.edu/campus-community/dining.html', 'https://www.tamu.edu/campus-community/dining.html'),
  ('d2000000-0000-4000-8000-000000000001', 'blinn-brenham', 'Blinn College · Brenham', 'on_campus',
   array['On-campus dining','Dining hall'],
   '["Weekday breakfast: 7:00–8:30 a.m.","Weekday lunch: 11:30 a.m.–2:00 p.m.","Weekday dinner: 4:00–6:30 p.m."]'::jsonb,
   'Confirm weekend and academic-break hours with Blinn Food Services.',
   'https://www.blinn.edu/food-services/brenham-campus.html', 'https://www.blinn.edu/food-services/index.html'),
  ('d2000000-0000-4000-8000-000000000002', 'blinn-bryan', 'Blinn College · Bryan', 'on_campus',
   array['On-campus dining','Restaurant','Coffee shop','Fast food'], '[]'::jsonb, null,
   'https://www.blinn.edu/food-services/bryan-campus.html', 'https://www.blinn.edu/food-services/bryan-campus.html')
on conflict (id) do update set
  campus_area = excluded.campus_area, categories = excluded.categories,
  regular_hours = excluded.regular_hours, website = excluded.website, updated_at = now();

insert into public.housing_entities
  (id, campus_id, campus_name, housing_scope, housing_type, official_description, website, phone, capacity, eligibility_restrictions)
values
  ('h1000000-0000-4000-8000-000000000001', 'tamu', 'Texas A&M · College Station', 'on_campus', 'residence_hall',
   'Official Texas A&M Residence Life housing option.', 'https://reslife.tamu.edu/housing-options/', null, null, '{}'),
  ('h1000000-0000-4000-8000-000000000002', 'tamu', 'Texas A&M · College Station', 'on_campus', 'university_apartment',
   'Official Texas A&M university-apartment option.', 'https://reslife.tamu.edu/housing-options/', null, null,
   array['Official eligibility restrictions apply; confirm with Texas A&M Residence Life.']),
  ('h2000000-0000-4000-8000-000000000001', 'blinn-brenham', 'Blinn College · Brenham', 'on_campus', 'residence_hall',
   'Official Blinn-Brenham on-campus housing.', 'https://www2.blinn.edu/housing/index.html', '979-830-4461', 42, array['Male housing']),
  ('h2000000-0000-4000-8000-000000000002', 'blinn-brenham', 'Blinn College · Brenham', 'on_campus', 'university_apartment',
   'Official Blinn-Brenham on-campus apartment housing.', 'https://www2.blinn.edu/housing/index.html', '979-830-4461', 336, '{}')
on conflict (id) do update set
  official_description = excluded.official_description, website = excluded.website,
  phone = excluded.phone, capacity = excluded.capacity, updated_at = now();

insert into public.housing_units
  (id, housing_entity_id, name, bedroom_count, bathroom_count, occupants_per_bedroom, effective_from)
values
  ('e2000000-0000-4000-8000-000000000001', 'h2000000-0000-4000-8000-000000000001', '2-bed dormitory', 2, null, 2, '2026-08-08'),
  ('e2000000-0000-4000-8000-000000000002', 'h2000000-0000-4000-8000-000000000002', '4-bed / 2-bath', 4, 2, 1, '2026-08-08'),
  ('e2000000-0000-4000-8000-000000000003', 'h2000000-0000-4000-8000-000000000002', '2-bed / 1-bath', 2, 1, 1, '2026-08-08')
on conflict (id) do update set
  name = excluded.name, bedroom_count = excluded.bedroom_count,
  bathroom_count = excluded.bathroom_count, occupants_per_bedroom = excluded.occupants_per_bedroom,
  updated_at = now();

insert into public.housing_rates
  (id, housing_unit_id, term_label, amount, currency, cadence, source_id, source_url,
   source_type, confidence_level, effective_from, last_verified_at)
values
  ('f2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001',
   'Fall 2026–Spring 2027', 2058, 'USD', 'semester', '20000000-0000-4000-8000-000000000011',
   'https://www2.blinn.edu/housing/index.html', 'official_source', 'official', '2026-08-08', '2026-08-08'),
  ('f2000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000002',
   'Fall 2026–Spring 2027', 3741, 'USD', 'semester', '20000000-0000-4000-8000-000000000011',
   'https://www2.blinn.edu/housing/index.html', 'official_source', 'official', '2026-08-08', '2026-08-08'),
  ('f2000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000003',
   'Fall 2026–Spring 2027', 3741, 'USD', 'semester', '20000000-0000-4000-8000-000000000011',
   'https://www2.blinn.edu/housing/index.html', 'official_source', 'official', '2026-08-08', '2026-08-08')
on conflict (id) do update set
  amount = excluded.amount, source_url = excluded.source_url,
  last_verified_at = excluded.last_verified_at, updated_at = now();

