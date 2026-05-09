-- Migration 004: Add birth last name columns
ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS birth_last_name_he text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS birth_last_name_en text NOT NULL DEFAULT '';

-- Copy current last_name into birth_last_name for existing people
UPDATE persons SET
  birth_last_name_he = last_name_he
WHERE birth_last_name_he = '' AND last_name_he != '';

UPDATE persons SET
  birth_last_name_en = last_name_en
WHERE birth_last_name_en = '' AND last_name_en != '';
