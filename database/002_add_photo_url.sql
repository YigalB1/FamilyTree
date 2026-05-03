-- Migration 002: Add photo_url column to persons table
-- Run with: Get-Content database/002_add_photo_url.sql | psql -U familytree_user -d familytree

ALTER TABLE persons ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 002: photo_url column added to persons table';
END $$;
