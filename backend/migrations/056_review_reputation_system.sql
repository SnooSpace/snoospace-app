-- ============================================================
-- 056_review_reputation_system.sql
-- Post-event & Post-Open-Plan Review + Reputation System
-- ============================================================
-- NEW TABLES:
--   review_dimensions           — composable question library
--   category_group_dimensions   — maps 27 event groups → dimensions
--   event_reviews               — "worth it" sentiment per event
--   event_review_tags           — checkbox tags per review
--   event_review_dimension_ratings — per-dimension answers
--   event_review_comments       — optional text (safety routed to moderation)
--   open_plan_reviews           — "would join again" per plan
--   open_plan_interaction_selections — "who did you get to know" pre-selection
--   open_plan_attendee_ratings  — per-person ratings in plan reviews
--   user_reputation_scores      — Bayesian-computed, batch-updated
--   reputation_pair_history     — rater→ratee log for anti-gaming
--   user_trust_flags            — internal safety flags, never public
--   review_prompts_queue        — delivery scheduling
--
-- EXISTING TABLE CHANGE:
--   events.category_group       — added column for dimension lookup
--
-- RLS: postgres superuser bypass (USING true), matching migration 051 pattern.
-- ============================================================

-- ============================================================
-- 0. ADD category_group TO events TABLE
-- ============================================================
-- Required for GET /api/reviews/events/:eventId/dimensions
-- Maps each event to one of the 27 taxonomy groups.
-- Existing events default to 'general' until backfilled by community.
-- ⚠️ HARSHITH: Backfill this column for existing events by running:
--   UPDATE events SET category_group = <your-group-key> WHERE id = <id>;
-- Group keys must match exactly the `category_group` values in
-- the category_group_dimensions seed below.
ALTER TABLE events ADD COLUMN IF NOT EXISTS category_group TEXT DEFAULT 'general';

-- ============================================================
-- 1. DIMENSION LIBRARY
-- ============================================================

CREATE TABLE IF NOT EXISTS review_dimensions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        UNIQUE NOT NULL,    -- e.g. 'music_quality'
  label       TEXT        NOT NULL,           -- display label e.g. 'Music Quality'
  applies_to  TEXT        NOT NULL CHECK (applies_to IN ('event', 'open_plan')),
  scale_type  TEXT        NOT NULL CHECK (scale_type IN ('4pt_emoji', '4pt_word', 'yes_no_maybe')),
  scale_labels JSONB      NOT NULL,           -- e.g. ["Amazing","Friendly","Average","Not great"]
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Maps category GROUPS (27 groups from EVENT_CATEGORIES_HIERARCHY) → dimensions.
-- New leaf categories under a group inherit dimensions automatically.
CREATE TABLE IF NOT EXISTS category_group_dimensions (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  category_group  TEXT    NOT NULL,
  dimension_id    UUID    REFERENCES review_dimensions(id) ON DELETE CASCADE,
  display_order   INT     NOT NULL DEFAULT 0,
  UNIQUE (category_group, dimension_id)
);

-- ── Seed: 12 dimensions ──────────────────────────────────────────────────────
INSERT INTO review_dimensions (key, label, applies_to, scale_type, scale_labels) VALUES
  ('crowd',        'Crowd',              'event', '4pt_emoji', '["Amazing","Friendly","Average","Not great"]'),
  ('organization', 'Organization',       'event', '4pt_word',  '["Excellent","Good","Average","Poor"]'),
  ('networking',   'Connections',        'event', 'yes_no_maybe', '["Yes","Maybe","No"]'),
  ('venue',        'Venue',              'event', '4pt_word',  '["Great","Okay","Poor"]'),
  ('value',        'Value',              'event', '4pt_word',  '["Definitely","Mostly","Not really","No"]'),
  ('music_quality','Music Quality',      'event', '4pt_word',  '["Excellent","Good","Average","Poor"]'),
  ('atmosphere',   'Atmosphere',         'event', '4pt_word',  '["Excellent","Good","Average","Poor"]'),
  ('speakers',     'Speakers',           'event', '4pt_word',  '["Excellent","Good","Average","Poor"]'),
  ('learning',     'Learned Something?', 'event', 'yes_no_maybe', '["Yes","Somewhat","No"]'),
  ('pace',         'Pace',               'event', '4pt_word',  '["Just right","Too fast","Too slow","Inconsistent"]'),
  ('competition',  'Competition',        'event', '4pt_word',  '["Thrilling","Good","Average","Poor"]'),
  ('facilities',   'Facilities',         'event', '4pt_word',  '["Great","Okay","Poor"]')
ON CONFLICT (key) DO NOTHING;

-- ── Seed: 27 category_group → dimension mappings ─────────────────────────────
-- ⚠️ HARSHITH REVIEW REQUIRED — This block is generated from EVENT_CATEGORIES_HIERARCHY.
-- category_group values MUST exactly match the `group` field from eventCategories.js
-- Dimension assignments are based on logical group semantics — review before committing.
-- Each INSERT is self-contained; safe to re-run (ON CONFLICT DO NOTHING).

DO $$
DECLARE
  dim_crowd        UUID := (SELECT id FROM review_dimensions WHERE key = 'crowd');
  dim_organization UUID := (SELECT id FROM review_dimensions WHERE key = 'organization');
  dim_networking   UUID := (SELECT id FROM review_dimensions WHERE key = 'networking');
  dim_venue        UUID := (SELECT id FROM review_dimensions WHERE key = 'venue');
  dim_value        UUID := (SELECT id FROM review_dimensions WHERE key = 'value');
  dim_music        UUID := (SELECT id FROM review_dimensions WHERE key = 'music_quality');
  dim_atmosphere   UUID := (SELECT id FROM review_dimensions WHERE key = 'atmosphere');
  dim_speakers     UUID := (SELECT id FROM review_dimensions WHERE key = 'speakers');
  dim_learning     UUID := (SELECT id FROM review_dimensions WHERE key = 'learning');
  dim_pace         UUID := (SELECT id FROM review_dimensions WHERE key = 'pace');
  dim_competition  UUID := (SELECT id FROM review_dimensions WHERE key = 'competition');
  dim_facilities   UUID := (SELECT id FROM review_dimensions WHERE key = 'facilities');
BEGIN

  -- 1. Seasonal & Holiday → atmosphere, crowd, venue, organization
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Seasonal & Holiday', dim_atmosphere, 1),
    ('Seasonal & Holiday', dim_crowd, 2),
    ('Seasonal & Holiday', dim_venue, 3),
    ('Seasonal & Holiday', dim_organization, 4)
  ON CONFLICT DO NOTHING;

  -- 2. Music → music_quality, atmosphere, venue, crowd
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Music', dim_music, 1),
    ('Music', dim_atmosphere, 2),
    ('Music', dim_venue, 3),
    ('Music', dim_crowd, 4)
  ON CONFLICT DO NOTHING;

  -- 3. Food & Dining → value, venue, organization, crowd
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Food & Dining', dim_value, 1),
    ('Food & Dining', dim_venue, 2),
    ('Food & Dining', dim_organization, 3),
    ('Food & Dining', dim_crowd, 4)
  ON CONFLICT DO NOTHING;

  -- 4. Sports & Fitness → competition, facilities, organization, crowd
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Sports & Fitness', dim_competition, 1),
    ('Sports & Fitness', dim_facilities, 2),
    ('Sports & Fitness', dim_organization, 3),
    ('Sports & Fitness', dim_crowd, 4)
  ON CONFLICT DO NOTHING;

  -- 5. Tech & Startup → speakers, networking, organization, learning
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Tech & Startup', dim_speakers, 1),
    ('Tech & Startup', dim_networking, 2),
    ('Tech & Startup', dim_organization, 3),
    ('Tech & Startup', dim_learning, 4)
  ON CONFLICT DO NOTHING;

  -- 6. Gaming & Esports → competition, facilities, atmosphere, crowd
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Gaming & Esports', dim_competition, 1),
    ('Gaming & Esports', dim_facilities, 2),
    ('Gaming & Esports', dim_atmosphere, 3),
    ('Gaming & Esports', dim_crowd, 4)
  ON CONFLICT DO NOTHING;

  -- 7. Outdoors & Adventure → facilities, organization, crowd, value
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Outdoors & Adventure', dim_facilities, 1),
    ('Outdoors & Adventure', dim_organization, 2),
    ('Outdoors & Adventure', dim_crowd, 3),
    ('Outdoors & Adventure', dim_value, 4)
  ON CONFLICT DO NOTHING;

  -- 8. Arts & Culture → atmosphere, venue, crowd, value
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Arts & Culture', dim_atmosphere, 1),
    ('Arts & Culture', dim_venue, 2),
    ('Arts & Culture', dim_crowd, 3),
    ('Arts & Culture', dim_value, 4)
  ON CONFLICT DO NOTHING;

  -- 9. Education & Workshops → learning, pace, speakers, organization
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Education & Workshops', dim_learning, 1),
    ('Education & Workshops', dim_pace, 2),
    ('Education & Workshops', dim_speakers, 3),
    ('Education & Workshops', dim_organization, 4)
  ON CONFLICT DO NOTHING;

  -- 10. Nightlife & Parties → music_quality, atmosphere, crowd, venue
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Nightlife & Parties', dim_music, 1),
    ('Nightlife & Parties', dim_atmosphere, 2),
    ('Nightlife & Parties', dim_crowd, 3),
    ('Nightlife & Parties', dim_venue, 4)
  ON CONFLICT DO NOTHING;

  -- 11. Wellness & Mindfulness → atmosphere, pace, organization, venue
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Wellness & Mindfulness', dim_atmosphere, 1),
    ('Wellness & Mindfulness', dim_pace, 2),
    ('Wellness & Mindfulness', dim_organization, 3),
    ('Wellness & Mindfulness', dim_venue, 4)
  ON CONFLICT DO NOTHING;

  -- 12. Networking & Professional → networking, speakers, organization, value
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Networking & Professional', dim_networking, 1),
    ('Networking & Professional', dim_speakers, 2),
    ('Networking & Professional', dim_organization, 3),
    ('Networking & Professional', dim_value, 4)
  ON CONFLICT DO NOTHING;

  -- 13. Community & Social Causes → crowd, organization, atmosphere, value
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Community & Social Causes', dim_crowd, 1),
    ('Community & Social Causes', dim_organization, 2),
    ('Community & Social Causes', dim_atmosphere, 3),
    ('Community & Social Causes', dim_value, 4)
  ON CONFLICT DO NOTHING;

  -- 14. Family & Kids → organization, venue, atmosphere, crowd
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Family & Kids', dim_organization, 1),
    ('Family & Kids', dim_venue, 2),
    ('Family & Kids', dim_atmosphere, 3),
    ('Family & Kids', dim_crowd, 4)
  ON CONFLICT DO NOTHING;

  -- 15. Hobbies & Clubs → networking, crowd, venue, atmosphere
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Hobbies & Clubs', dim_networking, 1),
    ('Hobbies & Clubs', dim_crowd, 2),
    ('Hobbies & Clubs', dim_venue, 3),
    ('Hobbies & Clubs', dim_atmosphere, 4)
  ON CONFLICT DO NOTHING;

  -- 16. Comedy & Entertainment → atmosphere, crowd, venue, value
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Comedy & Entertainment', dim_atmosphere, 1),
    ('Comedy & Entertainment', dim_crowd, 2),
    ('Comedy & Entertainment', dim_venue, 3),
    ('Comedy & Entertainment', dim_value, 4)
  ON CONFLICT DO NOTHING;

  -- 17. Film & Media → atmosphere, venue, crowd, organization
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Film & Media', dim_atmosphere, 1),
    ('Film & Media', dim_venue, 2),
    ('Film & Media', dim_crowd, 3),
    ('Film & Media', dim_organization, 4)
  ON CONFLICT DO NOTHING;

  -- 18. Fashion & Lifestyle → atmosphere, venue, crowd, value
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Fashion & Lifestyle', dim_atmosphere, 1),
    ('Fashion & Lifestyle', dim_venue, 2),
    ('Fashion & Lifestyle', dim_crowd, 3),
    ('Fashion & Lifestyle', dim_value, 4)
  ON CONFLICT DO NOTHING;

  -- 19. Travel & Exploration → organization, crowd, value, networking
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Travel & Exploration', dim_organization, 1),
    ('Travel & Exploration', dim_crowd, 2),
    ('Travel & Exploration', dim_value, 3),
    ('Travel & Exploration', dim_networking, 4)
  ON CONFLICT DO NOTHING;

  -- 20. Religious & Spiritual → atmosphere, crowd, organization, venue
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Religious & Spiritual', dim_atmosphere, 1),
    ('Religious & Spiritual', dim_crowd, 2),
    ('Religious & Spiritual', dim_organization, 3),
    ('Religious & Spiritual', dim_venue, 4)
  ON CONFLICT DO NOTHING;

  -- 21. College & Campus → atmosphere, crowd, organization, networking
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('College & Campus', dim_atmosphere, 1),
    ('College & Campus', dim_crowd, 2),
    ('College & Campus', dim_organization, 3),
    ('College & Campus', dim_networking, 4)
  ON CONFLICT DO NOTHING;

  -- 22. Pets & Animals → crowd, venue, organization, atmosphere
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Pets & Animals', dim_crowd, 1),
    ('Pets & Animals', dim_venue, 2),
    ('Pets & Animals', dim_organization, 3),
    ('Pets & Animals', dim_atmosphere, 4)
  ON CONFLICT DO NOTHING;

  -- 23. Automotive & Motorsports → crowd, atmosphere, venue, organization
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Automotive & Motorsports', dim_crowd, 1),
    ('Automotive & Motorsports', dim_atmosphere, 2),
    ('Automotive & Motorsports', dim_venue, 3),
    ('Automotive & Motorsports', dim_organization, 4)
  ON CONFLICT DO NOTHING;

  -- 24. Markets & Pop-ups → crowd, venue, value, atmosphere
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Markets & Pop-ups', dim_crowd, 1),
    ('Markets & Pop-ups', dim_venue, 2),
    ('Markets & Pop-ups', dim_value, 3),
    ('Markets & Pop-ups', dim_atmosphere, 4)
  ON CONFLICT DO NOTHING;

  -- 25. Casual Meetups & Making Friends → crowd, networking, atmosphere, venue
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Casual Meetups & Making Friends', dim_crowd, 1),
    ('Casual Meetups & Making Friends', dim_networking, 2),
    ('Casual Meetups & Making Friends', dim_atmosphere, 3),
    ('Casual Meetups & Making Friends', dim_venue, 4)
  ON CONFLICT DO NOTHING;

  -- 26. Celebrations & Milestones → atmosphere, crowd, venue, organization
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Celebrations & Milestones', dim_atmosphere, 1),
    ('Celebrations & Milestones', dim_crowd, 2),
    ('Celebrations & Milestones', dim_venue, 3),
    ('Celebrations & Milestones', dim_organization, 4)
  ON CONFLICT DO NOTHING;

  -- 27. Business & Corporate → speakers, networking, organization, value
  INSERT INTO category_group_dimensions (category_group, dimension_id, display_order) VALUES
    ('Business & Corporate', dim_speakers, 1),
    ('Business & Corporate', dim_networking, 2),
    ('Business & Corporate', dim_organization, 3),
    ('Business & Corporate', dim_value, 4)
  ON CONFLICT DO NOTHING;

END $$;

-- ============================================================
-- 2. EVENT REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS event_reviews (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        BIGINT      NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  worth_it_rating TEXT        NOT NULL CHECK (worth_it_rating IN (
                                  'absolutely', 'mostly', 'okay', 'not_really', 'not_at_all'
                                )),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_review_tags (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID    REFERENCES event_reviews(id) ON DELETE CASCADE,
  tag         TEXT    NOT NULL
  -- tag values validated at API layer against constants/reviewTags.js
  -- not constrained at DB level — tag library may expand without migrations
);

CREATE TABLE IF NOT EXISTS event_review_dimension_ratings (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id    UUID    REFERENCES event_reviews(id) ON DELETE CASCADE,
  dimension_id UUID    REFERENCES review_dimensions(id),
  rating_value TEXT    NOT NULL,
  UNIQUE (review_id, dimension_id)
);

-- Free text is ALWAYS optional, EXCEPT: if 'safety_concerns' tag is present,
-- comment_text becomes required at API layer and is routed to internal moderation.
-- is_safety_report=true reviews are NEVER exposed to organizers.
CREATE TABLE IF NOT EXISTS event_review_comments (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id         UUID    REFERENCES event_reviews(id) ON DELETE CASCADE,
  comment_text      TEXT,
  is_safety_report  BOOLEAN DEFAULT FALSE,
  moderation_status TEXT    DEFAULT 'none' CHECK (
                              moderation_status IN ('none', 'pending', 'reviewed', 'actioned')
                            ),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. OPEN PLAN REVIEWS + PEOPLE RATINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS open_plan_reviews (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  open_plan_id    BIGINT  NOT NULL REFERENCES open_plans(id) ON DELETE CASCADE,
  user_id         BIGINT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  would_join_again TEXT   NOT NULL CHECK (would_join_again IN (
                              'absolutely', 'probably', 'maybe', 'probably_not', 'never_again'
                            )),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (open_plan_id, user_id)
);

-- Step 1 of people rating: "Who did you get to know?" pre-selection.
-- Ratings are then only allowed for pre-selected users (validated at API layer).
CREATE TABLE IF NOT EXISTS open_plan_interaction_selections (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  open_plan_review_id   UUID    REFERENCES open_plan_reviews(id) ON DELETE CASCADE,
  rated_user_id         BIGINT  REFERENCES members(id) ON DELETE CASCADE,
  UNIQUE (open_plan_review_id, rated_user_id)
);

CREATE TABLE IF NOT EXISTS open_plan_attendee_ratings (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  open_plan_review_id   UUID    REFERENCES open_plan_reviews(id) ON DELETE CASCADE,
  rated_user_id         BIGINT  REFERENCES members(id) ON DELETE CASCADE,
  rater_id              BIGINT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  rating                TEXT    NOT NULL CHECK (rating IN (
                                    'absolutely', 'probably', 'maybe', 'probably_not', 'never_again'
                                  )),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (open_plan_review_id, rated_user_id)
);

-- ============================================================
-- 4. REPUTATION + ANTI-GAMING
-- ============================================================

-- Batch-computed; refreshed hourly by computeReputationScores.js.
-- smoothed_score is NULL until total_raw_rating_count >= 5 (cold-start safety gate).
CREATE TABLE IF NOT EXISTS user_reputation_scores (
  user_id                 BIGINT  PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  raw_positive_weighted   NUMERIC NOT NULL DEFAULT 0,
  raw_total_weighted      NUMERIC NOT NULL DEFAULT 0,
  smoothed_score          NUMERIC,   -- NULL until >= MIN_THRESHOLD raw ratings
  total_raw_rating_count  INT     NOT NULL DEFAULT 0,
  last_computed_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Every rater→ratee pair written here for anti-gaming (repeated-pair weight decay).
-- Also consumed by computeRecommendations Signal 10 (positive co-attendee signal).
CREATE TABLE IF NOT EXISTS reputation_pair_history (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id    BIGINT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  ratee_id    BIGINT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  rating      TEXT    NOT NULL,
  source_type TEXT    NOT NULL CHECK (source_type IN ('open_plan')),
  source_id   UUID    NOT NULL,   -- open_plan_review_id (UUID)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rph_rater_ratee ON reputation_pair_history (rater_id, ratee_id);
CREATE INDEX IF NOT EXISTS idx_rph_ratee_date  ON reputation_pair_history (ratee_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rph_rater_date  ON reputation_pair_history (rater_id, created_at);

-- Internal safety flags — NEVER shown publicly, never exposed via API.
CREATE TABLE IF NOT EXISTS user_trust_flags (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      BIGINT  REFERENCES members(id) ON DELETE CASCADE,
  flag_type    TEXT    NOT NULL CHECK (flag_type IN (
                           'repeat_never_again', 'safety_report', 'exclusivity_cluster'
                         )),
  severity     INT     NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL,
  window_end   TIMESTAMPTZ NOT NULL,
  status       TEXT    DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. REVIEW PROMPT SCHEDULING
-- ============================================================

CREATE TABLE IF NOT EXISTS review_prompts_queue (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      BIGINT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  source_type  TEXT    NOT NULL CHECK (source_type IN ('event', 'open_plan')),
  source_id    BIGINT  NOT NULL,   -- BIGINT to match events.id / open_plans.id
  scheduled_for TIMESTAMPTZ NOT NULL,  -- end_time + 3 hours
  expires_at   TIMESTAMPTZ NOT NULL,   -- scheduled_for + 7 days
  status       TEXT    DEFAULT 'pending' CHECK (
                           status IN ('pending', 'sent', 'completed', 'expired', 'skipped_throttled')
                         ),
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpq_status_scheduled ON review_prompts_queue (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_rpq_user_id          ON review_prompts_queue (user_id);

-- ============================================================
-- 6. INDEXES ON REVIEW TABLES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_event_reviews_event   ON event_reviews (event_id);
CREATE INDEX IF NOT EXISTS idx_event_reviews_user    ON event_reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_ert_review_id         ON event_review_tags (review_id);
CREATE INDEX IF NOT EXISTS idx_erdr_review_id        ON event_review_dimension_ratings (review_id);
CREATE INDEX IF NOT EXISTS idx_erc_review_id         ON event_review_comments (review_id);
CREATE INDEX IF NOT EXISTS idx_erc_safety            ON event_review_comments (is_safety_report, moderation_status) WHERE is_safety_report = TRUE;

CREATE INDEX IF NOT EXISTS idx_opr_plan_id           ON open_plan_reviews (open_plan_id);
CREATE INDEX IF NOT EXISTS idx_opr_user_id           ON open_plan_reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_opis_review_id        ON open_plan_interaction_selections (open_plan_review_id);
CREATE INDEX IF NOT EXISTS idx_opar_review_id        ON open_plan_attendee_ratings (open_plan_review_id);
CREATE INDEX IF NOT EXISTS idx_opar_rater_id         ON open_plan_attendee_ratings (rater_id);
CREATE INDEX IF NOT EXISTS idx_opar_rated_user_id    ON open_plan_attendee_ratings (rated_user_id);

-- ============================================================
-- 7. RLS (matching migration 051 pattern — postgres superuser bypass)
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'review_dimensions',
    'category_group_dimensions',
    'event_reviews',
    'event_review_tags',
    'event_review_dimension_ratings',
    'event_review_comments',
    'open_plan_reviews',
    'open_plan_interaction_selections',
    'open_plan_attendee_ratings',
    'user_reputation_scores',
    'reputation_pair_history',
    'user_trust_flags',
    'review_prompts_queue'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = tbl
        AND table_type   = 'BASE TABLE'
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON %I', tbl);
      EXECUTE format(
        'CREATE POLICY "service_role_all" ON %I AS PERMISSIVE FOR ALL TO postgres USING (true) WITH CHECK (true)',
        tbl
      );
      RAISE NOTICE 'RLS enabled: %', tbl;
    ELSE
      RAISE NOTICE 'Skipped (table not yet created): %', tbl;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
