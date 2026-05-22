-- Add new columns for detailed opportunity screen support
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS about_role TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS responsibilities TEXT[] DEFAULT '{}';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS who_can_apply TEXT[] DEFAULT '{}';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS gains TEXT[] DEFAULT '{}';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS trial_type TEXT CHECK (trial_type IN ('paid_trial', 'free_trial'));
