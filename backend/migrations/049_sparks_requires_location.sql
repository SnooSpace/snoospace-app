-- ============================================================
-- 049_sparks_requires_location.sql
-- ============================================================
-- 1. Add requires_location to sparks table
-- 2. Add target_city to user_sparks table
-- 3. Update travel sparks to be city-agnostic
-- ============================================================

-- 1. Add requires_location flag to sparks (idempotent)
ALTER TABLE sparks
  ADD COLUMN IF NOT EXISTS requires_location BOOLEAN NOT NULL DEFAULT false;

-- 2. Add target_city to user_sparks (idempotent)
ALTER TABLE user_sparks
  ADD COLUMN IF NOT EXISTS target_city TEXT NULL;

-- 3. Replace the two Bangalore-specific travel sparks with city-agnostic versions
--    First remove any user_sparks rows referencing them (pre-launch, safe)
DELETE FROM user_sparks
WHERE spark_id IN (
  SELECT id FROM sparks
  WHERE is_system = true
    AND normalized_label IN ('visiting bangalore', 'relocating to bangalore')
);

DELETE FROM sparks
WHERE is_system = true
  AND normalized_label IN ('visiting bangalore', 'relocating to bangalore');

-- 4. Insert city-agnostic travel sparks
INSERT INTO sparks (label, normalized_label, category, spark_type, requires_date_range, requires_location, is_system)
VALUES
  ('Visiting',   'visiting',   'travel', NULL, true, true, true),
  ('Relocating', 'relocating', 'travel', NULL, true, true, true)
ON CONFLICT DO NOTHING;

-- 5. Index target_city for future geo-matching queries
CREATE INDEX IF NOT EXISTS user_sparks_target_city_idx
  ON user_sparks (target_city)
  WHERE target_city IS NOT NULL AND is_expired = false;
