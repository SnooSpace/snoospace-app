-- Add expires_at column to opportunities table
-- This allows setting deadlines for opportunity applications

ALTER TABLE opportunities 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add index for querying unexpired opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_expires_at ON opportunities(expires_at);

-- Verification
-- SELECT id, title, expires_at FROM opportunities LIMIT 5;
