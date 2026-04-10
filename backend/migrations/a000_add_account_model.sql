-- Add Account Model for DB-based Account Management
-- Created: 2026-03-29
-- Purpose: Store Slack and Microsoft Teams account credentials in PostgreSQL

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    name VARCHAR(255) UNIQUE NOT NULL,

    -- Slack fields
    token VARCHAR(500),
    app_token VARCHAR(500),

    -- Teams fields
    tenant_id VARCHAR(255),
    app_id VARCHAR(255),
    app_password VARCHAR(500),

    -- Common settings
    prefix_messages_with_nick BOOLEAN DEFAULT TRUE,
    edit_suffix VARCHAR(50) DEFAULT ' (edited)',
    edit_disable BOOLEAN DEFAULT FALSE,
    use_username BOOLEAN DEFAULT TRUE,
    no_send_join_part BOOLEAN DEFAULT TRUE,
    use_api BOOLEAN DEFAULT TRUE,
    debug BOOLEAN DEFAULT FALSE,

    -- Validation
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    validation_errors TEXT,

    -- Metadata
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),

    -- Constraints
    CONSTRAINT account_platform_fields_check CHECK (
        (platform = 'slack' AND token IS NOT NULL) OR
        (platform = 'teams' AND tenant_id IS NOT NULL AND app_id IS NOT NULL)
    )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accounts_platform ON accounts(platform);
CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts(name);
CREATE INDEX IF NOT EXISTS idx_accounts_platform_name ON accounts(platform, name);
CREATE INDEX IF NOT EXISTS idx_accounts_is_valid ON accounts(is_valid);
CREATE INDEX IF NOT EXISTS idx_accounts_enabled ON accounts(enabled);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_accounts_updated_at ON accounts;
CREATE TRIGGER trigger_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_accounts_updated_at();

-- Migrate existing accounts from matterbridge.toml (optional, run manually if needed)
-- This can be done programmatically in Python using ConfigManager
-- See: backend/app/services/config_manager.py -> migrate_accounts_from_toml()

COMMENT ON TABLE accounts IS 'Slack and Microsoft Teams account credentials';
COMMENT ON COLUMN accounts.platform IS 'Platform type: slack or teams';
COMMENT ON COLUMN accounts.name IS 'Unique account name';
COMMENT ON COLUMN accounts.token IS 'Slack Bot User OAuth Token (xoxb-)';
COMMENT ON COLUMN accounts.app_token IS 'Slack App-Level Token for Socket Mode (xapp-)';
COMMENT ON COLUMN accounts.tenant_id IS 'Azure Tenant ID';
COMMENT ON COLUMN accounts.app_id IS 'Azure Application (Client) ID';
COMMENT ON COLUMN accounts.app_password IS 'Azure Client Secret';
COMMENT ON COLUMN accounts.is_valid IS 'Validation status';
COMMENT ON COLUMN accounts.validation_errors IS 'JSON array of validation errors';
COMMENT ON COLUMN accounts.enabled IS 'Account enabled status';
