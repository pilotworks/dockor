package repository

import (
	"context"
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func TestMigrator(t *testing.T) {
	ctx := context.Background()

	// 1. Create in-memory SQLite database
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}
	defer db.Close()

	migrator := NewMigrator(db)

	// 2. Run first migration
	if err := migrator.Migrate(ctx); err != nil {
		t.Fatalf("first migration run failed: %v", err)
	}

	// 3. Verify schema_migrations table contains version 1
	var version int
	var name string
	err = db.QueryRowContext(ctx, "SELECT version, name FROM schema_migrations WHERE version = 1").Scan(&version, &name)
	if err != nil {
		t.Fatalf("failed to query schema_migrations: %v", err)
	}
	if version != 1 || name != "init_schema" {
		t.Errorf("expected version 1 (init_schema), got %d (%s)", version, name)
	}

	// 4. Verify tables were created
	tables := []string{"users", "nodes", "stacks", "catalogs"}
	for _, tbl := range tables {
		var count int
		err := db.QueryRowContext(ctx, "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?", tbl).Scan(&count)
		if err != nil || count != 1 {
			t.Errorf("expected table '%s' to exist, err: %v", tbl, err)
		}
	}

	// 5. Test idempotency: re-running Migrate should succeed cleanly without re-executing
	if err := migrator.Migrate(ctx); err != nil {
		t.Fatalf("second migration run failed: %v", err)
	}
}
