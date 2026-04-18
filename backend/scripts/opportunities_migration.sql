-- ============================================
-- OPPORTUNITIES / HIRING FEATURE MIGRATION
-- Run this script in Supabase SQL Editor
-- ============================================

-- 1. Create opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  creator_type TEXT NOT NULL CHECK (creator_type IN ('member', 'community')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  
  -- Step 1: Opportunity types (max 5)
  opportunity_types TEXT[] NOT NULL,
  
  -- Step 2: Intent & Scope
  work_type TEXT DEFAULT 'one_time' CHECK (work_type IN ('one_time', 'ongoing')),
  work_mode TEXT DEFAULT 'remote' CHECK (work_mode IN ('remote', 'on_site')),
  event_id BIGINT REFERENCES events(id),
  
  -- Step 3: Core Requirements (AND logic)
  experience_level TEXT DEFAULT 'any' CHECK (experience_level IN ('any', 'beginner', 'intermediate', 'advanced')),
  availability TEXT NOT NULL,
  turnaround TEXT NOT NULL,
  timezone TEXT,
  
  -- Step 5: Compensation
  payment_type TEXT DEFAULT 'fixed' CHECK (payment_type IN ('fixed', 'monthly', 'per_deliverable')),
  budget_range TEXT,
  payment_nature TEXT DEFAULT 'paid' CHECK (payment_nature IN ('paid', 'trial', 'revenue_share')),
  
  -- Step 4: Skill matching mode
  eligibility_mode TEXT DEFAULT 'any_one' CHECK (eligibility_mode IN ('any_one', 'multiple')),
  
  -- Step 7: Visibility
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'community', 'invite')),
  notify_talent BOOLEAN DEFAULT true,
  
  -- Metadata
  applicant_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Indexes for opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_creator ON opportunities(creator_id, creator_type);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_visibility ON opportunities(visibility);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON opportunities(created_at DESC);

-- 2. Create skill_groups table (Step 4 - OR logic)
CREATE TABLE IF NOT EXISTS opportunity_skill_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  tools TEXT[],
  sample_type TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_groups_opportunity ON opportunity_skill_groups(opportunity_id);

-- 3. Create opportunity_questions table (Step 6)
CREATE TABLE IF NOT EXISTS opportunity_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('short_text', 'portfolio_link', 'sample_upload')),
  prompt TEXT NOT NULL,
  required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_questions ON opportunity_questions(opportunity_id);

-- 4. Create applications table
CREATE TABLE IF NOT EXISTS opportunity_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL,
  applicant_type TEXT NOT NULL CHECK (applicant_type IN ('member', 'community')),
  applied_skill_group TEXT NOT NULL,
  portfolio_items JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'shortlisted', 'rejected', 'withdrawn')),
  creator_note TEXT,
  rejection_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate applications
  UNIQUE(opportunity_id, applicant_id, applicant_type)
);

CREATE INDEX IF NOT EXISTS idx_applications_opportunity ON opportunity_applications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON opportunity_applications(applicant_id, applicant_type);
CREATE INDEX IF NOT EXISTS idx_applications_status ON opportunity_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_skill ON opportunity_applications(applied_skill_group);

-- 5. Create application responses table
CREATE TABLE IF NOT EXISTS opportunity_application_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES opportunity_questions(id) ON DELETE CASCADE,
  response_text TEXT,
  response_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_responses_application ON opportunity_application_responses(application_id);

-- 6. Create function to update applicant count
CREATE OR REPLACE FUNCTION update_opportunity_applicant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE opportunities 
    SET applicant_count = applicant_count + 1,
        updated_at = NOW()
    WHERE id = NEW.opportunity_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE opportunities 
    SET applicant_count = GREATEST(0, applicant_count - 1),
        updated_at = NOW()
    WHERE id = OLD.opportunity_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for applicant count
DROP TRIGGER IF EXISTS trigger_update_applicant_count ON opportunity_applications;
CREATE TRIGGER trigger_update_applicant_count
AFTER INSERT OR DELETE ON opportunity_applications
FOR EACH ROW EXECUTE FUNCTION update_opportunity_applicant_count();

-- 7. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_opportunity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS trigger_opportunity_updated_at ON opportunities;
CREATE TRIGGER trigger_opportunity_updated_at
BEFORE UPDATE ON opportunities
FOR EACH ROW EXECUTE FUNCTION update_opportunity_updated_at();

DROP TRIGGER IF EXISTS trigger_application_updated_at ON opportunity_applications;
CREATE TRIGGER trigger_application_updated_at
BEFORE UPDATE ON opportunity_applications
FOR EACH ROW EXECUTE FUNCTION update_opportunity_updated_at();

-- Verification queries (run after migration)
-- SELECT COUNT(*) as opportunities_count FROM opportunities;
-- SELECT COUNT(*) as skill_groups_count FROM opportunity_skill_groups;
-- SELECT COUNT(*) as applications_count FROM opportunity_applications;
