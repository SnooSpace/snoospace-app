-- ============================================================
-- 048_reseed_sparks.sql  –  Replace system spark list
-- ============================================================
-- Safe to re-run.
-- Strategy:
--   1. Remove user_sparks rows that reference the old system sparks
--      (only 4 rows exist, pre-launch, so this is safe).
--   2. Delete all existing system sparks.
--   3. Insert the new canonical list.
-- ============================================================

-- 1. Wipe user_sparks rows tied to system sparks
DELETE FROM user_sparks
WHERE spark_id IN (SELECT id FROM sparks WHERE is_system = true);

-- 2. Wipe old system sparks
DELETE FROM sparks WHERE is_system = true;

-- 3. Insert new canonical list
INSERT INTO sparks (label, normalized_label, category, spark_type, requires_date_range, is_system) VALUES

  -- Professional (8)
  ('Looking for a co-founder',  'looking for a co-founder',  'professional', 'seeking',  false, true),
  ('Open to co-founding',       'open to co-founding',       'professional', 'offering', false, true),
  ('Seeking mentorship',        'seeking mentorship',        'professional', 'seeking',  false, true),
  ('Open to mentoring',         'open to mentoring',         'professional', 'offering', false, true),
  ('Looking for teammates',     'looking for teammates',     'professional', 'seeking',  false, true),
  ('Open to collaborations',    'open to collaborations',    'professional', 'offering', false, true),
  ('Exploring opportunities',   'exploring opportunities',   'professional', NULL,       false, true),
  ('Growing my network',        'growing my network',        'professional', NULL,       false, true),

  -- Social (3)  — "Looking for Travel Buddies" promoted here per design decision
  ('Making new friends',        'making new friends',        'social',       NULL,       false, true),
  ('New to the city',           'new to the city',           'social',       NULL,       false, true),
  ('Looking for travel buddies','looking for travel buddies','social',       NULL,       false, true),

  -- Activity (5)
  ('Looking for gym buddies',   'looking for gym buddies',   'activity',     NULL,       false, true),
  ('Looking for sports buddies','looking for sports buddies','activity',     NULL,       false, true),
  ('Looking for running buddies','looking for running buddies','activity',   NULL,       false, true),
  ('Looking for hiking buddies','looking for hiking buddies','activity',     NULL,       false, true),
  ('Looking for cycling buddies','looking for cycling buddies','activity',   NULL,       false, true),

  -- Learning (2)
  ('Looking for study partners','looking for study partners','learning',     NULL,       false, true),
  ('Here to learn',             'here to learn',             'learning',     NULL,       false, true),

  -- Travel (2)  — city-specific, date-range optional
  ('Visiting Bangalore',        'visiting bangalore',        'travel',       NULL,       true,  true),
  ('Relocating to Bangalore',   'relocating to bangalore',   'travel',       NULL,       false, true)

ON CONFLICT DO NOTHING;
