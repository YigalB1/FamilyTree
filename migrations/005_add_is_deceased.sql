-- Migration 005: Add is_deceased boolean column
ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS is_deceased boolean NOT NULL DEFAULT false;

-- Mark as deceased anyone who already has a death date
UPDATE persons SET is_deceased = true
WHERE death_date IS NOT NULL AND death_date != '';

COMMENT ON COLUMN persons.is_deceased IS 'True if person is known to be deceased, even without a death date';
