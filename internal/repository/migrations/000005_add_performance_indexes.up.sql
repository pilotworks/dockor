CREATE INDEX IF NOT EXISTS idx_stacks_created_at ON stacks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stacks_node_created ON stacks(node_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stacks_webhook_token ON stacks(webhook_token);
CREATE INDEX IF NOT EXISTS idx_registries_is_default ON registries(is_default);
