-- ============================================================
-- 037 — FIX RECURRING OPEN PLANS
-- ============================================================
-- Problem: generate_recurring_plans() queried ALL is_recurring=TRUE
-- completed plans including child plans, causing exponential
-- duplication every day the cron ran.
--
-- Fix 1: Hard-delete all existing open plans with is_recurring=TRUE
--        (the duplicates the user is seeing, as requested).
--
-- Fix 2: Replace generate_recurring_plans() so it ONLY generates
--        from ROOT plans (parent_plan_id IS NULL), preventing chains.
-- ============================================================

-- Step 1: Delete all open plans that have is_recurring = TRUE
-- (cascade handles requests, likes, comments, views automatically)
DELETE FROM open_plans WHERE is_recurring = TRUE;

-- Step 2: Replace the recurring-plan generator with a corrected version.
-- Key change: added AND parent_plan_id IS NULL — only root originals
-- can spawn children. Children inherit is_recurring=FALSE so they
-- can never themselves trigger further generation.
CREATE OR REPLACE FUNCTION generate_recurring_plans()
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM open_plans
    WHERE is_recurring = TRUE
      AND recurrence_interval = 'weekly'
      AND parent_plan_id IS NULL          -- only original (root) plans
      AND status = 'completed'
      -- Only generate if no future instance already exists for this root
      AND NOT EXISTS (
        SELECT 1 FROM open_plans child
        WHERE child.parent_plan_id = open_plans.id
          AND child.scheduled_at > NOW()
      )
  LOOP
    INSERT INTO open_plans (
      created_by, title, activity_type, custom_activity_label,
      cost_type, cost_amount_paise, visibility, scoped_community_id,
      gender_preference, location_public, location_private,
      scheduled_at, expires_at, max_accepted,
      is_recurring, recurrence_interval, parent_plan_id, status
    ) VALUES (
      r.created_by, r.title, r.activity_type, r.custom_activity_label,
      r.cost_type, r.cost_amount_paise, r.visibility, r.scoped_community_id,
      r.gender_preference, r.location_public, r.location_private,
      r.scheduled_at + INTERVAL '7 days',
      r.expires_at  + INTERVAL '7 days',
      r.max_accepted,
      FALSE,        -- child is NOT itself recurring — stops the chain
      NULL,         -- child has no recurrence_interval
      r.id,         -- link back to root parent
      'active'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
