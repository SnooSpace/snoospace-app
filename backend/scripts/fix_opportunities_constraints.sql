-- ============================================
-- Fix opportunities table check constraints
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Allow 'hybrid' as a valid work_mode
--    (previously only 'remote' and 'on_site' were allowed)
ALTER TABLE opportunities
  DROP CONSTRAINT IF EXISTS opportunities_work_mode_check;

ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_work_mode_check
  CHECK (work_mode IN ('remote', 'on_site', 'hybrid'));

-- 2. Allow 'exposure' as a valid payment_nature
--    (previously only 'paid', 'trial', 'revenue_share' were allowed)
ALTER TABLE opportunities
  DROP CONSTRAINT IF EXISTS opportunities_payment_nature_check;

ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_payment_nature_check
  CHECK (payment_nature IN ('paid', 'trial', 'revenue_share', 'exposure'));
