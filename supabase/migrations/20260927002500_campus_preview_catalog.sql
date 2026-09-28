-- Public display metadata for the optional owner campus preview. Existing rows are unchanged.
insert into public.universities (id, name, short_name, primary_color, secondary_color, status, is_development) values
('tamu', 'Texas A&M University', 'Texas A&M', '#500000', '#ffffff', 'active', false),
('blinn', 'Blinn College', 'Blinn', '#003366', '#ffffff', 'active', false),
('texas', 'The University of Texas at Austin', 'Texas', '#BF5700', '#ffffff', 'active', false),
('lsu', 'Louisiana State University', 'LSU', '#35145F', '#F4D35E', 'active', false),
('alabama', 'The University of Alabama', 'Alabama', '#7A1426', '#F8F8F8', 'active', false),
('oregon', 'University of Oregon', 'Oregon', '#007030', '#FEE11A', 'active', false),
('harvard', 'Harvard University', 'Harvard', '#A51C30', '#FFFFFF', 'active', false),
('michigan', 'University of Michigan', 'Michigan', '#00274C', '#FFCB05', 'active', false),
('miami', 'University of Miami', 'Miami', '#005030', '#F47321', 'active', false),
('ucla', 'University of California, Los Angeles', 'UCLA', '#2774AE', '#FFD100', 'active', false),
('stanford', 'Stanford University', 'Stanford', '#8C1515', '#FFFFFF', 'active', false),
('usc', 'University of Southern California', 'USC', '#990000', '#FFCC00', 'active', false),
('washington', 'University of Washington', 'Washington', '#4B2E83', '#B7A57A', 'active', false),
('ohio-state', 'The Ohio State University', 'Ohio State', '#BA0C2F', '#A7B1B7', 'active', false),
('penn-state', 'The Pennsylvania State University', 'Penn State', '#001E44', '#FFFFFF', 'active', false),
('duke', 'Duke University', 'Duke', '#012169', '#FFFFFF', 'active', false),
('uconn', 'University of Connecticut', 'UConn', '#000E2F', '#FFFFFF', 'active', false),
('wisconsin', 'University of Wisconsin–Madison', 'Wisconsin', '#C5050C', '#FFFFFF', 'active', false),
('mines', 'Colorado School of Mines', 'Colorado Mines', '#21314D', '#92A2BD', 'active', false),
('williams', 'Williams College', 'Williams', '#500082', '#FFBE0A', 'active', false)
on conflict (id) do nothing;
