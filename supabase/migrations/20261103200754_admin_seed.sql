-- Seed the managed content from what the site shows today: the bundled
-- images become media library entries, FowenNurses becomes a sponsor record,
-- and every hard-coded setting becomes a site_config document. The old
-- site_settings row (ticker + fundraising) is carried over, then removed.

insert into public.media_assets (source, path, url, file_name, alt, mime_type, size_bytes, width, height) values
  ('bundled', 'bundled/emmy-portrait.jpg', '/assets/emmy-portrait.jpg', 'emmy-portrait.jpg', 'James Pierre holding his Emmy in front of the Academy backdrop', 'image/jpeg', 233812, 1367, 2048),
  ('bundled', 'bundled/emmy-standing.jpg', '/assets/emmy-standing.jpg', 'emmy-standing.jpg', 'James Pierre standing with his Emmy award', 'image/jpeg', 67825, 720, 960),
  ('bundled', 'bundled/emmy-team.jpg', '/assets/emmy-team.jpg', 'emmy-team.jpg', 'James Pierre and three colleagues holding their Emmy awards', 'image/jpeg', 276117, 2048, 1152),
  ('bundled', 'bundled/emmy-trophy-look.jpg', '/assets/emmy-trophy-look.jpg', 'emmy-trophy-look.jpg', 'James Pierre looking down at his Emmy statuette', 'image/jpeg', 185473, 1597, 1234),
  ('bundled', 'bundled/event-fowen-backdrop.jpg', '/assets/event-fowen-backdrop.jpg', 'event-fowen-backdrop.jpg', 'James Pierre in a blue suit in front of the FowenNurses backdrop', 'image/jpeg', 265575, 1333, 2000),
  ('bundled', 'bundled/event-fowen-group.jpg', '/assets/event-fowen-group.jpg', 'event-fowen-group.jpg', 'FowenNurses graduates and guests in blue on the dance floor at the FowenNurses gala', 'image/jpeg', 353978, 2000, 1333),
  ('bundled', 'bundled/event-hosting-floor.jpg', '/assets/event-hosting-floor.jpg', 'event-hosting-floor.jpg', 'James Pierre hosting on the dance floor at the FowenNurses gala', 'image/jpeg', 351286, 2048, 1366),
  ('bundled', 'bundled/event-mic-blue.jpg', '/assets/event-mic-blue.jpg', 'event-mic-blue.jpg', 'James Pierre speaking into a microphone at the FowenNurses gala', 'image/jpeg', 167432, 2000, 1333),
  ('bundled', 'bundled/event-smile-blue.jpg', '/assets/event-smile-blue.jpg', 'event-smile-blue.jpg', 'James Pierre smiling in a blue tuxedo jacket while hosting an evening event', 'image/jpeg', 135751, 1333, 2000),
  ('bundled', 'bundled/event-stage-gold.jpg', '/assets/event-stage-gold.jpg', 'event-stage-gold.jpg', 'James Pierre speaking on stage in a gold jacket', 'image/jpeg', 80388, 1080, 1620),
  ('bundled', 'bundled/hero-james.webp', '/assets/hero-james.webp', 'hero-james.webp', 'James Pierre holding his Emmy award in front of the Suncoast Emmy Awards backdrop', 'image/webp', 70948, 845, 1200),
  ('bundled', 'bundled/james-beige.png', '/assets/james-beige.png', 'james-beige.png', 'James Pierre seated in a beige suit on set', 'image/png', 2978326, 1356, 1970),
  ('bundled', 'bundled/james-blue-interview.png', '/assets/james-blue-interview.png', 'james-blue-interview.png', 'James Pierre listening during a sit-down interview', 'image/png', 3316471, 1800, 1790),
  ('bundled', 'bundled/james-blue-talk.png', '/assets/james-blue-talk.png', 'james-blue-talk.png', 'James Pierre speaking during a seated conversation', 'image/png', 3845373, 1634, 2014),
  ('bundled', 'bundled/james-emmy.png', '/assets/james-emmy.png', 'james-emmy.png', 'James Pierre holding his Emmy award at the Suncoast Emmy Awards', 'image/png', 2151655, 1238, 1744),
  ('bundled', 'bundled/james-field.png', '/assets/james-field.png', 'james-field.png', 'James Pierre reporting in the field with a James Reports microphone', 'image/png', 2432619, 1136, 1980),
  ('bundled', 'bundled/james-gala.png', '/assets/james-gala.png', 'james-gala.png', 'James Pierre at a gala', 'image/png', 3170224, 1540, 1958),
  ('bundled', 'bundled/james-stage.png', '/assets/james-stage.png', 'james-stage.png', 'James Pierre smiling as he speaks into a microphone on stage', 'image/png', 2494048, 1402, 1668),
  ('bundled', 'bundled/james-tux-mic.png', '/assets/james-tux-mic.png', 'james-tux-mic.png', 'James Pierre hosting with a microphone in a tuxedo', 'image/png', 3312350, 1308, 1954),
  ('bundled', 'bundled/keyart.png', '/assets/keyart.png', 'keyart.png', 'James Reports key art with James Pierre in front of the U.S. Capitol', 'image/png', 4022168, 2894, 1766),
  ('bundled', 'bundled/sponsor-fowennurses.png', '/assets/sponsor-fowennurses.png', 'sponsor-fowennurses.png', 'FowenNurses — Pass your NCLEX with confidence. Kraze Bèt ou, Kwè nan Tèt ou. 2,300+ nurses trained.', 'image/png', 4584035, 3162, 1796);

insert into public.sponsors (name, name_accent, tagline, website_url, phone, image_id, thanks_text, thanks_image_id, placements, sort_order, status)
values (
  'FowenNurses', 'Nurses', 'NCLEX preparation · 2,300+ nurses trained', 'https://www.fowennursesllc.com', '(732) 822-3518',
  (select id from public.media_assets where path = 'bundled/sponsor-fowennurses.png'),
  'Thank you to FowenNurses for supporting James Reports and independent journalism for the Haitian community.',
  (select id from public.media_assets where path = 'bundled/event-fowen-group.jpg'),
  array['home_feature', 'home_thanks'], 1, 'published'
);

insert into public.site_config (key, value) values
('brand', jsonb_build_object('siteName', 'James Reports', 'tagline', 'with James Pierre', 'description', 'Trusted coverage of immigration, politics and Haiti. Miami, Florida.')),
('seo', jsonb_build_object(
  'defaultTitle', 'James Reports with James Pierre',
  'defaultDescription', 'Independent interviews and reporting on immigration, politics, Haiti and the Haitian community, with 4-time Emmy Award winner James Pierre. In English, Français, Kreyòl and Español.')),
('contact', jsonb_build_object('bookingEmail', 'booking@jamesreports.com', 'adsEmail', 'ads@jamesreports.com')),
('social', jsonb_build_object(
  'youtube', 'https://www.youtube.com/@JamesReports',
  'facebook', 'https://www.facebook.com/pages/JAMES-PIERRE/284513110117',
  'x', 'https://twitter.com/lovejamespierre',
  'vimeo', 'https://vimeo.com/jamespierre')),
('navigation', jsonb_build_object('header', jsonb_build_array(
  jsonb_build_object('label', 'Home', 'href', '/', 'visible', true),
  jsonb_build_object('label', 'Watch', 'href', '/watch', 'visible', true),
  jsonb_build_object('label', 'Podcast', 'href', '/podcast', 'visible', true),
  jsonb_build_object('label', 'Episodes', 'href', '/episodes', 'visible', true),
  jsonb_build_object('label', 'Reports', 'href', '/reports', 'visible', true),
  jsonb_build_object('label', 'Archive', 'href', '/archive', 'visible', true),
  jsonb_build_object('label', 'About', 'href', '/about', 'visible', true),
  jsonb_build_object('label', 'Booking', 'href', '/booking', 'visible', true)))),
('footer', jsonb_build_object('languages', 'English · Français · Kreyòl · Español', 'privacyUrl', '', 'termsUrl', '')),
('ticker', (select jsonb_build_object('enabled', show_ticker, 'label', 'Premiere', 'text', ticker_text, 'linkLabel', 'Set a reminder', 'linkUrl', ticker_link_url) from public.site_settings where id)),
('fundraising', (select jsonb_build_object('goalCents', monthly_goal_cents, 'raisedCents', raised_cents, 'supportersCount', supporters_count) from public.site_settings where id)),
('home', jsonb_build_object(
  'sections', (select jsonb_agg(jsonb_build_object('key', k, 'visible', true) order by n)
    from unnest(array['hero', 'appearances', 'story', 'recent', 'youtube', 'reports', 'fundraising', 'archive', 'sponsor_feature', 'sponsor_thanks']) with ordinality as s(k, n)),
  'highlights', jsonb_build_array(
    jsonb_build_object('value', '4×', 'label', 'Emmy Award winner'),
    jsonb_build_object('value', '20+', 'label', 'Years in broadcast'),
    jsonb_build_object('value', '4', 'label', 'Languages · EN FR KR ES')),
  'story', jsonb_build_object('youtubeId', 'Q_oljAV4Yfs', 'start', 31, 'title', 'How James Reports began',
    'body', 'James tells the story of why he created James Reports and what the channel stands for.'),
  'timelineIntro', 'Two decades on the biggest stories in Haiti and South Florida.',
  'timeline', jsonb_build_array(
    jsonb_build_object('year', '2004', 'text', 'Protests in Haiti that forced President Aristide into exile'),
    jsonb_build_object('year', '2010', 'text', 'The earthquake that struck Haiti, and the cholera outbreak that followed'),
    jsonb_build_object('year', '2017', 'text', 'TPS for Haitians'),
    jsonb_build_object('year', '2021', 'text', 'Arrest of former Panamanian president Ricardo Martinelli'),
    jsonb_build_object('year', 'Now', 'text', 'James Reports: independent interviews and reporting')))),
('credits', jsonb_build_object(
  'appearances', jsonb_build_array('CNN en Español', 'MSNBC', 'NewsNation', 'Univision', 'Telemundo', 'NBC 6', 'CBS 4', 'PBS'),
  'clients', jsonb_build_array('FCC', 'Humana', 'FPL', 'DoorDash', 'Kay Jewelers', 'City National Bank', 'Conviva', 'Simple Mobile'))),
('about', jsonb_build_object(
  'intro', '4-time Emmy Award-winning Haitian-American journalist, television producer and multilingual news anchor with more than 20 years of experience in broadcast journalism.',
  'paragraphs', jsonb_build_array(
    'James has been featured on CNN en Español, MSNBC, NewsNation, Telemundo, Univision, Fox Sports, CBS 4, NBC 6, RT America and Canal 9 in Argentina. He was a contributor to the Rick Sanchez Show and Prohibido Callarse on Mira TV, and serves as TV producer and anchor at MDC-TV, where he hosts The Talk with James Pierre.',
    'He is fluent in English, French, Creole and Spanish. Beyond the newsroom, he hosts events for nonprofits and educational institutions and speaks to students across South Florida and the Caribbean.'),
  'facts', jsonb_build_array(
    jsonb_build_object('label', 'Awards', 'value', 'Emmy · Davey · Telly · Communicator'),
    jsonb_build_object('label', 'Education', 'value', 'B.S. Miami Dade College · M.A. St. Thomas University'),
    jsonb_build_object('label', 'Based in', 'value', 'Miami, Florida')))),
('watch', jsonb_build_object(
  'channels', jsonb_build_array(
    jsonb_build_object('name', 'Latest', 'description', 'Newest episodes, back to back', 'guideLabel', 'James Reports: latest episodes', 'playlistId', 'UUXOdc4wPeeSxOOVakrf9wlg', 'videoId', '', 'start', 0),
    jsonb_build_object('name', 'Our Story', 'description', 'How James Reports began', 'guideLabel', 'The Story of James Reports', 'playlistId', '', 'videoId', 'Q_oljAV4Yfs', 'start', 31),
    jsonb_build_object('name', 'English', 'description', 'English-language interviews', 'guideLabel', 'English interviews', 'playlistId', 'PLYsDWrWXrYqKp2pvk5Seg-r8A3Vic_XWo', 'videoId', '', 'start', 0),
    jsonb_build_object('name', 'Promos', 'description', 'Highlights and trailers', 'guideLabel', 'Highlights & promos', 'playlistId', 'PLYsDWrWXrYqL0zJ9oXmqSS5nA3FM47R9Z', 'videoId', '', 'start', 0)),
  'headlines', jsonb_build_array(
    'Welcome to James Reports TV',
    'Immigration · Politics · Haiti · Community',
    'New episode premieres Thursday at 8 PM ET',
    'Available in English, Français, Kreyòl and Español',
    'Support independent journalism at jamesreports.com/support'),
  'premiereTitle', 'Thursday · 8 PM ET',
  'premiereSubtitle', 'New episode premiere')),
('podcast', jsonb_build_object(
  'uploadsPlaylistId', 'UUXOdc4wPeeSxOOVakrf9wlg',
  'playlists', jsonb_build_array(
    jsonb_build_object('id', 'UUXOdc4wPeeSxOOVakrf9wlg', 'label', 'Latest uploads'),
    jsonb_build_object('id', 'PLYsDWrWXrYqKp2pvk5Seg-r8A3Vic_XWo', 'label', 'English'),
    jsonb_build_object('id', 'PLYsDWrWXrYqL0zJ9oXmqSS5nA3FM47R9Z', 'label', 'Promos')))),
('images', jsonb_build_object(
  'homeHero', (select id from public.media_assets where path = 'bundled/hero-james.webp'),
  'aboutPortrait', (select id from public.media_assets where path = 'bundled/james-emmy.png'),
  'guestPhoto', (select id from public.media_assets where path = 'bundled/james-blue-interview.png'),
  'bookingHero', (select id from public.media_assets where path = 'bundled/event-smile-blue.jpg'),
  'vipHero', (select id from public.media_assets where path = 'bundled/emmy-portrait.jpg'),
  'episodeDefault', (select id from public.media_assets where path = 'bundled/keyart.png')));

drop table public.site_settings;
