-- Representative data for local development only.
-- Every catalog row is pending/development and therefore excluded by public RLS policies.

insert into public.universities
  (id, name, short_name, primary_color, secondary_color, source_type, confidence_level, is_development)
values
  ('tamu', 'Texas A&M University', 'Texas A&M', '#500000', '#ffffff', 'manual', 'pending', true),
  ('blinn', 'Blinn College', 'Blinn', '#003366', '#ffffff', 'manual', 'pending', true),
  ('texas', 'The University of Texas at Austin', 'Texas', '#BF5700', '#ffffff', 'manual', 'pending', true),
  ('lsu', 'Louisiana State University', 'LSU', '#35145F', '#F4D35E', 'manual', 'pending', true),
  ('alabama', 'The University of Alabama', 'Alabama', '#7A1426', '#F8F8F8', 'manual', 'pending', true)
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color;

insert into public.data_sources
  (id, university_id, name, source_type, url, sync_method, refresh_interval, enabled, adapter_key, metadata)
values
  ('10000000-0000-4000-8000-000000000001', 'tamu', 'Texas A&M Undergraduate Catalog', 'course_catalog',
   'https://catalog.tamu.edu/undergraduate/course-descriptions/', 'html', 'weekly', false, 'tamu-official-catalog',
   '{"reason":"Registered only. Requires a reviewed university-specific parser before enablement."}'::jsonb),
  ('10000000-0000-4000-8000-000000000002', 'tamu', 'Texas A&M Academic Programs', 'academic_catalog',
   'https://www.tamu.edu/academics/programs/index.html', 'html', 'weekly', false, 'tamu-official-programs',
   '{"reason":"Registered only. Requires a reviewed university-specific parser before enablement."}'::jsonb),
  ('10000000-0000-4000-8000-000000000003', 'tamu', 'Texas A&M Representative Development Dataset', 'manual',
   null, 'manual', 'manual', true, 'tamu-development-academics', '{"development":true,"official":false}'::jsonb),
  ('20000000-0000-4000-8000-000000000001', 'blinn', 'Blinn College Academic Affairs', 'academic_catalog',
   'https://www.blinn.edu/academics/index.html', 'html', 'weekly', false, 'blinn-official-academics',
   '{"reason":"Registered only. Requires a reviewed university-specific parser before enablement."}'::jsonb),
  ('20000000-0000-4000-8000-000000000002', 'blinn', 'Blinn Representative Development Dataset', 'manual',
   null, 'manual', 'manual', true, 'blinn-development-academics', '{"development":true,"official":false}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  url = excluded.url,
  enabled = excluded.enabled,
  adapter_key = excluded.adapter_key,
  metadata = excluded.metadata;

insert into public.academic_programs
  (id, university_id, external_id, name, degree_type, department, description, source_id, source_type, confidence_level, effective_from, is_development)
values
  ('30000000-0000-4000-8000-000000000001', 'tamu', 'dev-tamu-program-cs-bs', 'Computer Science', 'BS',
   'Computer Science and Engineering', 'Representative development program.', '10000000-0000-4000-8000-000000000003', 'development_seed', 'pending', '2026-08-01', true),
  ('30000000-0000-4000-8000-000000000004', 'tamu', 'dev-tamu-program-architecture-bs', 'Architecture', 'BS',
   'Architecture', 'Representative development program.', '10000000-0000-4000-8000-000000000003', 'development_seed', 'pending', '2026-08-01', true),
  ('31000000-0000-4000-8000-000000000001', 'blinn', 'dev-blinn-program-cs-as', 'Computer Science', 'AS',
   'Engineering, Computer Technology, and Innovation', 'Representative development program.', '20000000-0000-4000-8000-000000000002', 'development_seed', 'pending', '2026-08-01', true),
  ('31000000-0000-4000-8000-000000000002', 'blinn', 'dev-blinn-program-biology-as', 'Biology', 'AS',
   'Natural and Physical Sciences', 'Representative development program.', '20000000-0000-4000-8000-000000000002', 'development_seed', 'pending', '2026-08-01', true)
on conflict (id) do update set name = excluded.name, department = excluded.department, updated_at = now();

insert into public.courses
  (id, university_id, external_id, subject_code, course_number, title, description, credit_hours, department, source_id, source_type, confidence_level, effective_from, is_development)
values
  ('40000000-0000-4000-8000-000000000001', 'tamu', 'dev-tamu-csce-120', 'CSCE', '120', 'Program Design and Concepts',
   'Representative development course.', 4, 'Computer Science and Engineering', '10000000-0000-4000-8000-000000000003', 'development_seed', 'pending', '2026-08-01', true),
  ('40000000-0000-4000-8000-000000000002', 'tamu', 'dev-tamu-csce-221', 'CSCE', '221', 'Data Structures and Algorithms',
   'Representative development course.', 4, 'Computer Science and Engineering', '10000000-0000-4000-8000-000000000003', 'development_seed', 'pending', '2026-08-01', true),
  ('40000000-0000-4000-8000-000000000004', 'tamu', 'dev-tamu-arch-205', 'ARCH', '205', 'Architectural Design I',
   'Representative development course.', 5, 'Architecture', '10000000-0000-4000-8000-000000000003', 'development_seed', 'pending', '2026-08-01', true),
  ('41000000-0000-4000-8000-000000000001', 'blinn', 'dev-blinn-course-1', 'COSC', '1436', 'Programming Fundamentals I',
   'Representative development course.', 4, 'Computer Science', '20000000-0000-4000-8000-000000000002', 'development_seed', 'pending', '2026-08-01', true),
  ('41000000-0000-4000-8000-000000000002', 'blinn', 'dev-blinn-course-2', 'COSC', '1437', 'Programming Fundamentals II',
   'Representative development course.', 4, 'Computer Science', '20000000-0000-4000-8000-000000000002', 'development_seed', 'pending', '2026-08-01', true),
  ('41000000-0000-4000-8000-000000000004', 'blinn', 'dev-blinn-course-4', 'BIOL', '1406', 'Biology for Science Majors I',
   'Representative development course.', 4, 'Biology', '20000000-0000-4000-8000-000000000002', 'development_seed', 'pending', '2026-08-01', true)
on conflict (id) do update set title = excluded.title, department = excluded.department, updated_at = now();

insert into public.course_program_relations
  (id, university_id, program_id, course_id, relation_type, recommended_term, notes, source_id, source_type, confidence_level, effective_from, is_development)
values
  ('90000000-0000-4000-8000-000000000001', 'tamu', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   'required', 1, 'Development-only recommendation.', '10000000-0000-4000-8000-000000000003', 'development_seed', 'pending', '2026-08-01', true),
  ('91000000-0000-4000-8000-000000000001', 'blinn', '31000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
   'required', 1, 'Development-only recommendation.', '20000000-0000-4000-8000-000000000002', 'development_seed', 'pending', '2026-08-01', true)
on conflict (id) do nothing;

insert into public.academic_terms
  (id, university_id, external_id, code, name, starts_on, ends_on, registration_status, source_id, source_type, confidence_level, effective_from, is_development)
values
  ('50000000-0000-4000-8000-000000000001', 'tamu', 'dev-tamu-2026-fall', '2026-FALL', 'Fall 2026', '2026-08-24', '2026-12-16', 'open',
   '10000000-0000-4000-8000-000000000003', 'development_seed', 'pending', '2026-08-01', true),
  ('51000000-0000-4000-8000-000000000001', 'blinn', 'dev-blinn-2026-fall', '2026-FALL', 'Fall 2026', '2026-08-24', '2026-12-16', 'open',
   '20000000-0000-4000-8000-000000000002', 'development_seed', 'pending', '2026-08-01', true)
on conflict (id) do update set name = excluded.name, updated_at = now();

insert into public.instructors
  (id, university_id, external_id, display_name, department, title, source_id, source_type, confidence_level, effective_from, is_development)
values
  ('60000000-0000-4000-8000-000000000001', 'tamu', 'dev-tamu-instructor-nguyen', 'Dr. Morgan Nguyen', 'Computer Science and Engineering',
   'Development Instructor', '10000000-0000-4000-8000-000000000003', 'development_seed', 'pending', '2026-08-01', true),
  ('61000000-0000-4000-8000-000000000001', 'blinn', 'dev-blinn-instructor-1', 'Prof. Avery Brooks', 'Computer Science',
   'Development Instructor', '20000000-0000-4000-8000-000000000002', 'development_seed', 'pending', '2026-08-01', true)
on conflict (id) do update set display_name = excluded.display_name, updated_at = now();

insert into public.course_sections
  (id, university_id, external_id, course_id, term_id, section_number, days, start_time, end_time, location_text, source_id, source_type, confidence_level, effective_from, is_development)
values
  ('70000000-0000-4000-8000-000000000001', 'tamu', 'dev-tamu-csce120-501', '40000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000001', '501', array['Mon','Wed','Fri'], '09:10', '10:00', 'Development classroom',
   '10000000-0000-4000-8000-000000000003', 'development_seed', 'pending', '2026-08-01', true),
  ('71000000-0000-4000-8000-000000000001', 'blinn', 'dev-blinn-cosc1436-001', '41000000-0000-4000-8000-000000000001',
   '51000000-0000-4000-8000-000000000001', '001', array['Mon','Wed'], '10:35', '11:50', 'Development classroom',
   '20000000-0000-4000-8000-000000000002', 'development_seed', 'pending', '2026-08-01', true)
on conflict (id) do update set location_text = excluded.location_text, updated_at = now();

insert into public.section_instructors (section_id, instructor_id, is_primary)
values
  ('70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', true),
  ('71000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', true)
on conflict (section_id, instructor_id) do update set is_primary = excluded.is_primary;

insert into public.aliases
  (id, university_id, entity_type, alias_text, normalized_alias, canonical_entity_id, canonical_label, source_id, source_type, confidence_level)
values
  ('a1000000-0000-4000-8000-000000000001', 'tamu', 'academic_program', 'CS', 'cs',
   '30000000-0000-4000-8000-000000000001', 'Computer Science', '10000000-0000-4000-8000-000000000003', 'development_seed', 'pending'),
  ('a2000000-0000-4000-8000-000000000001', 'blinn', 'academic_program', 'CS', 'cs',
   '31000000-0000-4000-8000-000000000001', 'Computer Science', '20000000-0000-4000-8000-000000000002', 'development_seed', 'pending')
on conflict (id) do update set canonical_label = excluded.canonical_label, updated_at = now();

insert into public.campus_entities
  (id, university_id, external_id, entity_type, name, description, status, source_id, source_type, confidence_level, effective_from, is_development)
values
  ('b1000000-0000-4000-8000-000000000001', 'tamu', 'dev-tamu-future-study-center', 'building',
   'Future Study Center (Development Example)', 'Lifecycle-status development example.', 'planned',
   '10000000-0000-4000-8000-000000000003', 'development_seed', 'pending', '2026-08-01', true)
on conflict (id) do nothing;

insert into public.buildings (id, expected_opening)
values ('b1000000-0000-4000-8000-000000000001', '2028-08-01')
on conflict (id) do update set expected_opening = excluded.expected_opening, updated_at = now();
