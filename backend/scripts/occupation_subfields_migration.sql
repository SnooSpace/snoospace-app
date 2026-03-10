-- Add occupation sub-fields support columns to members table
-- occupation_details: JSONB storing per-occupation key/value pairs (e.g. {"company":"Google","tech_stack":"React"})
-- occupation_category: Only used when occupation = 'other:...' to unlock category-based sub-fields
-- portfolio_link: Universal profile field for portfolio/website URL
-- education: College/University text field (was missing from backend despite frontend support)

ALTER TABLE members ADD COLUMN IF NOT EXISTS occupation_details JSONB DEFAULT NULL;
ALTER TABLE members ADD COLUMN IF NOT EXISTS occupation_category VARCHAR(50) DEFAULT NULL;
ALTER TABLE members ADD COLUMN IF NOT EXISTS portfolio_link VARCHAR(255) DEFAULT NULL;
ALTER TABLE members ADD COLUMN IF NOT EXISTS education VARCHAR(200) DEFAULT NULL;
