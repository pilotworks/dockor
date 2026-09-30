-- 000006_add_agent_enrollment.up.sql

CREATE TABLE IF NOT EXISTS agent_enrollment_tokens (
    token TEXT PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP
);

ALTER TABLE nodes ADD COLUMN agent_version TEXT DEFAULT '';
ALTER TABLE nodes ADD COLUMN os TEXT DEFAULT '';
ALTER TABLE nodes ADD COLUMN arch TEXT DEFAULT '';
ALTER TABLE nodes ADD COLUMN containers_running INTEGER DEFAULT 0;
ALTER TABLE nodes ADD COLUMN containers_total INTEGER DEFAULT 0;
ALTER TABLE nodes ADD COLUMN cpu_usage_percent REAL DEFAULT 0.0;
ALTER TABLE nodes ADD COLUMN memory_usage_bytes INTEGER DEFAULT 0;
