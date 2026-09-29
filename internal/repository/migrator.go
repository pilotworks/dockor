package repository

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"log"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

type Migration struct {
	Version int
	Name    string
	SQL     string
}

type Migrator struct {
	db *sql.DB
}

func NewMigrator(db *sql.DB) *Migrator {
	return &Migrator{db: db}
}

// Migrate executes all pending embedded migrations inside atomic transactions
func (m *Migrator) Migrate(ctx context.Context) error {
	// 1. Ensure schema_migrations tracking table exists
	initQuery := `
	CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		applied_at TIMESTAMP NOT NULL
	);`
	if _, err := m.db.ExecContext(ctx, initQuery); err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	// 2. Query already applied migration versions
	rows, err := m.db.QueryContext(ctx, "SELECT version FROM schema_migrations")
	if err != nil {
		return fmt.Errorf("failed to query applied migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[int]bool)
	for rows.Next() {
		var v int
		if err := rows.Scan(&v); err != nil {
			return err
		}
		applied[v] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}

	// 3. Discover and parse all embedded migration files
	migrations, err := m.loadEmbeddedMigrations()
	if err != nil {
		return fmt.Errorf("failed to load embedded migrations: %w", err)
	}

	// 4. Run each unapplied migration inside a transaction
	var appliedCount int
	for _, mg := range migrations {
		if applied[mg.Version] {
			continue
		}

		if err := m.applyMigration(ctx, mg); err != nil {
			return fmt.Errorf("failed to apply migration %06d_%s: %w", mg.Version, mg.Name, err)
		}
		appliedCount++
		log.Printf("[DB Migrator] Applied migration: %06d_%s", mg.Version, mg.Name)
	}

	if appliedCount > 0 {
		log.Printf("[DB Migrator] Successfully executed %d new database migration(s)", appliedCount)
	}

	return nil
}

func (m *Migrator) applyMigration(ctx context.Context, mg Migration) error {
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Execute migration SQL
	if _, err := tx.ExecContext(ctx, mg.SQL); err != nil {
		return fmt.Errorf("exec error: %w", err)
	}

	// Record migration in tracking table
	insertQuery := "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
	if _, err := tx.ExecContext(ctx, insertQuery, mg.Version, mg.Name, time.Now().UTC()); err != nil {
		return fmt.Errorf("failed to record migration status: %w", err)
	}

	return tx.Commit()
}

func (m *Migrator) loadEmbeddedMigrations() ([]Migration, error) {
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return nil, err
	}

	var migrations []Migration
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".up.sql") {
			continue
		}

		parts := strings.SplitN(entry.Name(), "_", 2)
		if len(parts) < 2 {
			continue
		}

		ver, err := strconv.Atoi(parts[0])
		if err != nil {
			continue
		}

		name := strings.TrimSuffix(parts[1], ".up.sql")
		filePath := filepath.Join("migrations", entry.Name())
		content, err := migrationFS.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("failed to read file %s: %w", filePath, err)
		}

		migrations = append(migrations, Migration{
			Version: ver,
			Name:    name,
			SQL:     string(content),
		})
	}

	// Sort migrations ascending by version
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	return migrations, nil
}
