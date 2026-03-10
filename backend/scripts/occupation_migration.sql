-- Add occupation column to members table
-- This stores the user's occupation as a snake_case value (e.g., 'student', 'developer', 'founder')
ALTER TABLE members ADD COLUMN IF NOT EXISTS occupation VARCHAR(50) DEFAULT NULL;
