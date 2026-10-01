CREATE TABLE IF NOT EXISTS proxy_routes (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    target_url TEXT NOT NULL,
    container_id TEXT,
    stack_id TEXT,
    ssl_mode TEXT NOT NULL DEFAULT 'letsencrypt',
    enabled INTEGER NOT NULL DEFAULT 1,
    email TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proxy_routes_domain ON proxy_routes(domain);
CREATE INDEX IF NOT EXISTS idx_proxy_routes_enabled ON proxy_routes(enabled);
CREATE INDEX IF NOT EXISTS idx_proxy_routes_container_id ON proxy_routes(container_id);
CREATE INDEX IF NOT EXISTS idx_proxy_routes_stack_id ON proxy_routes(stack_id);
