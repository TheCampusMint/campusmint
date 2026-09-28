# Campus preview release

The optional Dev control requires the active server-side owner_campus_tester capability. Production access is assigned to the existing account whose unique username is fawzanyousfi; the UI never grants access based on a typed username. Local development controls require their separate development-only flag.

Preview is session state, defaults off, and never changes the saved profile or posting identity. It reads public campus content, suppresses personal/social mutations, and clears previous-campus results while requests change. Exit test returns to the saved campus.

The catalog contains 20 campuses. Sports display one to three distinct configured programs with official schedule links. Selection is editorial, not a claimed popularity ranking. Harvard includes rowing first; Alabama has football, basketball and baseball; Williams and Colorado Mines have two slots. Programs are never padded with another school's data.

Official schedules refresh on Sports visits, focus and periodic reads. Imports accept explicit results only; dates alone never become scores. Previously verified finals survive missing results. Schema.org fixture-only sources remain unverified for past games without readable results.

September 27 validation: all configured schedule links returned successful official pages after correcting Michigan hockey's path. Live refresh/storage succeeded for 18 campuses. LSU and Penn State use official-link fallbacks because their current date markup is not supported. These fallbacks do not claim a schedule has not been published.

Validated capability gating, revoked access, public-only preview filtering, private profile field removal, request cancellation, read-only polls, 20-school coverage, one-to-three limits, score validation and provider ID parsing. Full suite, lint and production build pass. Mobile UI checks cover default-off controls, Harvard, Williams, post blocking and returning home.

The larger account-synced social/realtime, licensed media provider, transcoding and moderation backlog is not completed by this release. Music remains absent from the composer.
