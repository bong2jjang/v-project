-- Add validation fields to gateways table
-- Migration: add_gateway_validation
-- Date: 2026-03-28

-- Add is_valid column (default TRUE for existing gateways)
ALTER TABLE gateways ADD COLUMN IF NOT EXISTS is_valid BOOLEAN NOT NULL DEFAULT TRUE;

-- Add validation_errors column
ALTER TABLE gateways ADD COLUMN IF NOT EXISTS validation_errors TEXT;

-- Create index on is_valid for faster filtering
CREATE INDEX IF NOT EXISTS idx_gateways_is_valid ON gateways(is_valid);

-- Update existing gateways to have is_valid = TRUE
UPDATE gateways SET is_valid = TRUE WHERE is_valid IS NULL;
