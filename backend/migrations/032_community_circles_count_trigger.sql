-- ============================================================
-- Migration 032: Maintain circle_count for community circle connections
-- ============================================================

-- 1. Create trigger function to update member's circle_count
CREATE OR REPLACE FUNCTION fn_update_community_circle_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE members 
    SET circle_count = circle_count + 1 
    WHERE id = NEW.member_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE members 
    SET circle_count = GREATEST(0, circle_count - 1) 
    WHERE id = OLD.member_id;
  END IF;
  RETURN NULL;
END;
$$;

-- 2. Create trigger on community_member_circles
DROP TRIGGER IF EXISTS trg_community_circle_member_count ON community_member_circles;
CREATE TRIGGER trg_community_circle_member_count
  AFTER INSERT OR DELETE ON community_member_circles
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_community_circle_member_count();

-- 3. Recalculate denormalized circle_count on members
UPDATE members m
SET circle_count = 
  (SELECT COUNT(*) FROM circles WHERE user_a_id = m.id OR user_b_id = m.id) +
  (SELECT COUNT(*) FROM community_member_circles WHERE member_id = m.id);
