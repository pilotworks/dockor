package repository

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
}

func NewDB(dbPath string) (*DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	// Connect with WAL mode and high-performance PRAGMAs
	dsn := fmt.Sprintf("%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)&_pragma=synchronous(NORMAL)&_pragma=cache_size(-64000)&_pragma=temp_store(MEMORY)&_pragma=mmap_size(268435456)", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	db.SetMaxOpenConns(10) // Concurrent reads supported in WAL mode
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping sqlite database: %w", err)
	}

	d := &DB{db}
	migrator := NewMigrator(db)
	if err := migrator.Migrate(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to run database migrations: %w", err)
	}

	return d, nil
}
