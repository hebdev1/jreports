-- Content taken verbatim from the design file (design-source/James Reports.dc.html).
-- The episode and report entries are the design's examples: James's team
-- should replace them with the real catalogue and add youtube_id / audio_url
-- so the players appear. Fundraising figures are deliberately left null.

insert into public.episodes (id, number, title, dek, guest, topic, language, duration_seconds, published_on, chapters) values
  ('ep-48', 48, 'Haiti at a Crossroads: Security, Transition and the Road Ahead', 'A long conversation on the transitional government, gang violence in Port-au-Prince, and what the diaspora can do now.', 'With a former Haitian government official', 'Haiti', 'EN', 3492, '2026-09-18',
    '[{"at":0,"label":"Introduction"},{"at":252,"label":"Where things stand today"},{"at":870,"label":"The view from the diaspora"},{"at":1665,"label":"What the numbers show"},{"at":2468,"label":"Questions from viewers"},{"at":3140,"label":"What comes next"}]'),
  ('ep-47', 47, 'TPS Explained: Your Questions, Answered', 'An immigration attorney walks through eligibility, deadlines and re-registration, question by question.', 'With an immigration attorney', 'Immigration', 'KR', 2550, '2026-09-11', '[]'),
  ('ep-46', 46, 'Inside Little Haiti: Rent, Development and Staying Home', 'Longtime residents and a city commissioner on housing costs and neighborhood change.', 'With Miami community leaders', 'Community', 'EN', 2164, '2026-09-04', '[]'),
  ('ep-45', 45, 'La diaspora haïtienne et le droit de vote', 'Should Haitians abroad vote in national elections? Two constitutional scholars debate.', 'Avec deux juristes', 'Politics', 'FR', 2870, '2026-08-28', '[]'),
  ('ep-44', 44, 'Vuelos de deportación: siguiendo los números', 'What the flight data shows about removals to the Caribbean and Latin America this year.', 'Con un investigador de datos', 'Immigration', 'ES', 1878, '2026-08-21', '[]'),
  ('ep-43', 43, 'Art as Record: Haitian Painters in Miami', 'Three painters on memory, migration and building a market for Haitian art in South Florida.', 'With three Haitian-American artists', 'Culture', 'EN', 1780, '2026-08-14', '[]'),
  ('ep-42', 42, 'Konsèy pou nouvo imigran: travay, lekòl, sante', 'Practical guidance for new arrivals on work permits, school enrollment and clinics.', 'Avèk yon travayè sosyal', 'Community', 'KR', 2362, '2026-08-07', '[]'),
  ('ep-41', 41, 'Who Decides Haiti''s Aid? Following the Money', 'Where international assistance goes, and who is accountable when it misses.', 'With a development economist', 'Politics', 'EN', 3065, '2026-07-31', '[]'),
  ('ep-40', 40, 'From Little Haiti to the Pros: Haitian-American Athletes', 'Players and coaches on scholarships, scouting and representing Haiti on the field.', 'With South Florida athletes and coaches', 'Sports', 'EN', 2055, '2026-07-24', '[]'),
  ('ep-39', 39, 'Behind the Scenes: Haitian Voices in Film and Music', 'Actors, directors and musicians on breaking into the industry and telling Haitian stories.', 'With Haitian-American entertainers', 'Entertainment', 'EN', 2642, '2026-07-17', '[]');

insert into public.reports (id, topic, title, dek, read_minutes, published_on) values
  ('tps-decision-haitian-families-florida', 'Immigration', 'What the latest TPS decision means for Haitian families in Florida', 'Deadlines, who is covered, and where to get free legal help in Miami-Dade and Broward.', 8, '2026-09-20'),
  ('port-au-prince-block-by-block', 'Haiti', 'Port-au-Prince, block by block: a map of who controls what', 'Reporting from residents and local journalists on daily life under armed groups.', 12, '2026-09-15'),
  ('diaspora-vote-promises-obstacles', 'Politics', 'The diaspora vote: promises, obstacles and what comes next', 'Why the question keeps returning, and what it would take to make it real.', 6, '2026-09-09'),
  ('north-miami-haitian-businesses-rents', 'Community', 'North Miami’s Haitian-owned businesses weather rising rents', 'Owners on leases, loans and the customers who keep them open.', 7, '2026-09-02'),
  ('parole-asylum-tps-guide', 'Immigration', 'Parole, asylum, TPS: a plain-language guide in four languages', 'The differences between each status, explained without jargon.', 10, '2026-08-26'),
  ('kompa-at-70', 'Culture', 'Kompa at 70: the sound that crossed the water', 'Musicians and producers on the genre’s past and its Miami future.', 5, '2026-08-19');

insert into public.archive_items (name, show, image_url, href, sort_order) values
  ('Jawan Strader', 'The Talk with James Pierre', 'https://www.jamespierre.com/uploads/9/5/9/0/9590960/jawan.jpg', 'https://www.jamespierre.com/jawan-strader-is-on-tv.html', 1),
  ('PBS Miami · Haitian Voices', 'WPBT2', 'https://www.jamespierre.com/uploads/9/5/9/0/9590960/james-at-pbs-copy.jpg', 'https://www.jamespierre.com/james-pierre-on-wpbt-2---haitian-voices.html', 2),
  ('Shirley Thimothée Paul', 'The Talk with James Pierre', 'https://www.jamespierre.com/uploads/9/5/9/0/9590960/shirley-2.jpg', 'https://www.jamespierre.com/shirley-thimothee-paul-is-on-tv.html', 3),
  ('Suze Guillaume', 'The Talk with James Pierre', 'https://www.jamespierre.com/uploads/9/5/9/0/9590960/suze-guillaume.jpg', 'https://www.jamespierre.com/suze-guillaume-is-on-tv.html', 4),
  ('Jerry Delince', 'The Talk with James Pierre', 'https://www.jamespierre.com/uploads/9/5/9/0/9590960/jerry-delince.jpg', 'https://www.jamespierre.com/jerry-delince-is-on-tv.html', 5),
  ('With Farah Larrieux', 'WPBT2', 'https://www.jamespierre.com/uploads/9/5/9/0/9590960/6707307.jpg', 'https://www.jamespierre.com/james-pierre-on-wpbt2-with-farah-larrieux.html', 6),
  ('Oswald', 'The Talk with James Pierre', 'https://www.jamespierre.com/uploads/9/5/9/0/9590960/596f7762-8e15-4d09-94aa-ed3a26ea2a5c.jpg', 'https://www.jamespierre.com/oswald-is-on-tv.html', 7),
  ('James Pierre on WPBT2', 'WPBT2', 'https://www.jamespierre.com/uploads/9/5/9/0/9590960/9124145.jpg', 'https://www.jamespierre.com/james-pierre-on-wpbt2.html', 8),
  ('James Pierre on WPBT2', 'WPBT2', 'https://www.jamespierre.com/uploads/9/5/9/0/9590960/8394030.jpg', 'https://www.jamespierre.com/james-pierre-on-wpbt21.html', 9),
  ('Rev. Fr. Reginald', 'The Talk with James Pierre', 'https://www.jamespierre.com/uploads/9/5/9/0/9590960/4852151.jpg', 'https://www.jamespierre.com/rev-fr-reginald.html', 10);

insert into public.site_settings (id, show_ticker, ticker_text, ticker_link_url, monthly_goal_cents, raised_cents, supporters_count)
values (true, true, 'New episode of James Reports premieres Thursday at 8 PM ET on YouTube', 'https://www.youtube.com/@JamesReports', 1200000, null, null);
