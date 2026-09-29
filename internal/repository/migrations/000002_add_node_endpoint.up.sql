-- 000002_add_node_endpoint.up.sql
ALTER TABLE nodes ADD COLUMN endpoint TEXT DEFAULT '';
