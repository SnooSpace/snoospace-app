-- ============================================================
-- 057_fix_category_group_dimensions.sql
-- Corrects the category_group -> dimension mapping written by 056_review_reputation_system.sql.
--
-- What was wrong in 056:
--   1. Each group was mapped to 4 dimensions instead of the specified 3.
--   2. Several dimension assignments were semantically incorrect or inconsistent
--      with the verified spec (e.g. Food & Dining used 'value' as primary instead
--      of 'food_quality'; Sports & Fitness used 'competition' not 'pace'; etc.).
--   3. The two dimensions 'food_quality' and 'family_friendliness' were never
--      inserted in 056 (they existed only as a comment), so any insert referencing
--      them via JOIN would have silently produced 0 rows.
--
-- Fix strategy: TRUNCATE + rebuild from scratch rather than patching individual rows.
-- Safe to run idempotently (truncate is always a clean slate).
-- ============================================================

-- ── Step 1: Ensure the two additional dimensions exist (idempotent) ────────────
INSERT INTO review_dimensions (key, label, applies_to, scale_type, scale_labels)
VALUES
  ('food_quality',        'Food Quality',     'event', '4pt_word',    '["Excellent","Good","Average","Poor"]'),
  ('family_friendliness', 'Family-Friendly?', 'event', 'yes_no_maybe','["Yes","Somewhat","No"]')
ON CONFLICT (key) DO NOTHING;

-- ── Step 2: Wipe the existing mapping entirely and rebuild from verified source ─
TRUNCATE TABLE category_group_dimensions;

-- ── Step 3: Rebuild correct 27-group → 3-dimension mapping ────────────────────
-- Source of truth: Harshith's eventCategories.js EVENT_CATEGORIES_HIERARCHY (27 groups).
-- Each group gets exactly 3 dimensions, ordered by display priority.
-- Group name strings match the `group` field verbatim from eventCategories.js —
-- these must equal whatever is written to events.category_group.

INSERT INTO category_group_dimensions (category_group, dimension_id, display_order)
SELECT v.category_group, d.id, v.display_order
FROM (VALUES
  -- 1. Seasonal & Holiday
  ('Seasonal & Holiday',             'atmosphere',          1),
  ('Seasonal & Holiday',             'crowd',               2),
  ('Seasonal & Holiday',             'organization',        3),
  -- 2. Music
  ('Music',                          'music_quality',       1),
  ('Music',                          'atmosphere',          2),
  ('Music',                          'venue',               3),
  -- 3. Food & Dining
  ('Food & Dining',                  'food_quality',        1),
  ('Food & Dining',                  'venue',               2),
  ('Food & Dining',                  'value',               3),
  -- 4. Sports & Fitness
  ('Sports & Fitness',               'facilities',          1),
  ('Sports & Fitness',               'organization',        2),
  ('Sports & Fitness',               'pace',                3),
  -- 5. Tech & Startup
  ('Tech & Startup',                 'speakers',            1),
  ('Tech & Startup',                 'networking',          2),
  ('Tech & Startup',                 'organization',        3),
  -- 6. Gaming & Esports
  ('Gaming & Esports',               'competition',         1),
  ('Gaming & Esports',               'organization',        2),
  ('Gaming & Esports',               'facilities',          3),
  -- 7. Outdoors & Adventure
  ('Outdoors & Adventure',           'organization',        1),
  ('Outdoors & Adventure',           'facilities',          2),
  ('Outdoors & Adventure',           'pace',                3),
  -- 8. Arts & Culture
  ('Arts & Culture',                 'atmosphere',          1),
  ('Arts & Culture',                 'venue',               2),
  ('Arts & Culture',                 'organization',        3),
  -- 9. Education & Workshops
  ('Education & Workshops',          'learning',            1),
  ('Education & Workshops',          'organization',        2),
  ('Education & Workshops',          'pace',                3),
  -- 10. Nightlife & Parties
  ('Nightlife & Parties',            'atmosphere',          1),
  ('Nightlife & Parties',            'crowd',               2),
  ('Nightlife & Parties',            'venue',               3),
  -- 11. Wellness & Mindfulness
  ('Wellness & Mindfulness',         'pace',                1),
  ('Wellness & Mindfulness',         'atmosphere',          2),
  ('Wellness & Mindfulness',         'organization',        3),
  -- 12. Networking & Professional
  ('Networking & Professional',      'networking',          1),
  ('Networking & Professional',      'speakers',            2),
  ('Networking & Professional',      'organization',        3),
  -- 13. Community & Social Causes
  ('Community & Social Causes',      'organization',        1),
  ('Community & Social Causes',      'atmosphere',          2),
  ('Community & Social Causes',      'crowd',               3),
  -- 14. Family & Kids
  ('Family & Kids',                  'family_friendliness', 1),
  ('Family & Kids',                  'organization',        2),
  ('Family & Kids',                  'venue',               3),
  -- 15. Hobbies & Clubs
  ('Hobbies & Clubs',                'organization',        1),
  ('Hobbies & Clubs',                'atmosphere',          2),
  ('Hobbies & Clubs',                'pace',                3),
  -- 16. Comedy & Entertainment
  ('Comedy & Entertainment',         'atmosphere',          1),
  ('Comedy & Entertainment',         'venue',               2),
  ('Comedy & Entertainment',         'organization',        3),
  -- 17. Film & Media
  ('Film & Media',                   'venue',               1),
  ('Film & Media',                   'atmosphere',          2),
  ('Film & Media',                   'organization',        3),
  -- 18. Fashion & Lifestyle
  ('Fashion & Lifestyle',            'atmosphere',          1),
  ('Fashion & Lifestyle',            'venue',               2),
  ('Fashion & Lifestyle',            'organization',        3),
  -- 19. Travel & Exploration
  ('Travel & Exploration',           'organization',        1),
  ('Travel & Exploration',           'pace',                2),
  ('Travel & Exploration',           'facilities',          3),
  -- 20. Religious & Spiritual
  ('Religious & Spiritual',          'atmosphere',          1),
  ('Religious & Spiritual',          'organization',        2),
  ('Religious & Spiritual',          'venue',               3),
  -- 21. College & Campus
  ('College & Campus',               'crowd',               1),
  ('College & Campus',               'atmosphere',          2),
  ('College & Campus',               'organization',        3),
  -- 22. Pets & Animals
  ('Pets & Animals',                 'organization',        1),
  ('Pets & Animals',                 'venue',               2),
  ('Pets & Animals',                 'facilities',          3),
  -- 23. Automotive & Motorsports
  ('Automotive & Motorsports',       'competition',         1),
  ('Automotive & Motorsports',       'organization',        2),
  ('Automotive & Motorsports',       'facilities',          3),
  -- 24. Markets & Pop-ups
  ('Markets & Pop-ups',              'organization',        1),
  ('Markets & Pop-ups',              'venue',               2),
  ('Markets & Pop-ups',              'value',               3),
  -- 25. Casual Meetups & Making Friends
  ('Casual Meetups & Making Friends','networking',          1),
  ('Casual Meetups & Making Friends','crowd',               2),
  ('Casual Meetups & Making Friends','atmosphere',          3),
  -- 26. Celebrations & Milestones
  ('Celebrations & Milestones',      'atmosphere',          1),
  ('Celebrations & Milestones',      'organization',        2),
  ('Celebrations & Milestones',      'venue',               3),
  -- 27. Business & Corporate
  ('Business & Corporate',           'organization',        1),
  ('Business & Corporate',           'speakers',            2),
  ('Business & Corporate',           'networking',          3)
) AS v(category_group, dimension_key, display_order)
JOIN review_dimensions d ON d.key = v.dimension_key;

-- ── Step 4: Verification queries (run manually after migration) ────────────────
-- Query A: confirm every group has exactly 3 rows (should show 27 rows, all count=3)
-- SELECT category_group, count(*) AS dim_count
-- FROM category_group_dimensions
-- GROUP BY category_group
-- ORDER BY category_group;

-- Query B: find any events.category_group values not covered by this mapping
-- (should return 0 rows if all events have NULL or a valid group name)
-- SELECT DISTINCT e.category_group, COUNT(*) AS event_count
-- FROM events e
-- LEFT JOIN category_group_dimensions cgd ON cgd.category_group = e.category_group
-- WHERE cgd.category_group IS NULL
--   AND e.category_group IS NOT NULL
-- GROUP BY e.category_group
-- ORDER BY e.category_group;
