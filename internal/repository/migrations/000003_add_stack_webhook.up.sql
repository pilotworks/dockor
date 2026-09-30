-- 000003_add_stack_webhook.up.sql
ALTER TABLE stacks ADD COLUMN webhook_token TEXT DEFAULT '';
