package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/pilotworks/dockor/internal/models"
)

type Repository struct {
	db *DB
}

func NewRepository(db *DB) *Repository {
	return &Repository{db: db}
}

// EnsureDefaultAdmin creates an initial admin user if no users exist
func (r *Repository) EnsureDefaultAdmin(ctx context.Context) error {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}
	if count == 0 {
		now := time.Now().UTC()
		// In production this will be hashed with bcrypt; for initial scaffold we store a standard hash
		_, err = r.db.ExecContext(ctx, `
			INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			"usr_admin", "admin", "admin@dockor.local", "admin123", string(models.RoleAdmin), now, now,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

// UpsertLocalNode registers or updates the local node with real daemon details
func (r *Repository) UpsertLocalNode(ctx context.Context, n *models.Node) error {
	now := time.Now().UTC()
	var count int
	_ = r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM nodes WHERE id = ?", n.ID).Scan(&count)
	if count == 0 {
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO nodes (id, name, hostname, ip_address, docker_version, status, is_local, cpu_cores, total_memory, endpoint, last_seen_at, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			n.ID, n.Name, n.Hostname, n.IPAddress, n.DockerVersion, string(n.Status), 1, n.CPUCores, n.TotalMemory, n.Endpoint, now, now,
		)
		return err
	}

	_, err := r.db.ExecContext(ctx, `
		UPDATE nodes SET name = ?, hostname = ?, ip_address = ?, docker_version = ?, status = ?, cpu_cores = ?, total_memory = ?, endpoint = ?, last_seen_at = ?
		WHERE id = ?`,
		n.Name, n.Hostname, n.IPAddress, n.DockerVersion, string(n.Status), n.CPUCores, n.TotalMemory, n.Endpoint, now, n.ID,
	)
	return err
}

// Nodes
func (r *Repository) ListNodes(ctx context.Context) ([]models.Node, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, name, hostname, ip_address, docker_version, status, is_local, cpu_cores, total_memory, COALESCE(endpoint, ''), last_seen_at, created_at FROM nodes ORDER BY is_local DESC, name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []models.Node
	for rows.Next() {
		var n models.Node
		var isLocal int
		err := rows.Scan(&n.ID, &n.Name, &n.Hostname, &n.IPAddress, &n.DockerVersion, &n.Status, &isLocal, &n.CPUCores, &n.TotalMemory, &n.Endpoint, &n.LastSeenAt, &n.CreatedAt)
		if err != nil {
			return nil, err
		}
		n.IsLocal = isLocal == 1
		nodes = append(nodes, n)
	}
	return nodes, rows.Err()
}

// Stacks
func (r *Repository) ListStacks(ctx context.Context, nodeID string) ([]models.Stack, error) {
	query := "SELECT id, name, node_id, status, template_id, compose_yaml, env_vars, created_at, updated_at FROM stacks"
	var args []interface{}
	if nodeID != "" {
		query += " WHERE node_id = ?"
		args = append(args, nodeID)
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stacks []models.Stack
	for rows.Next() {
		var s models.Stack
		var envStr sql.NullString
		var tmplID sql.NullString
		err := rows.Scan(&s.ID, &s.Name, &s.NodeID, &s.Status, &tmplID, &s.ComposeYAML, &envStr, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if tmplID.Valid {
			s.TemplateID = tmplID.String
		}
		if envStr.Valid && envStr.String != "" {
			_ = json.Unmarshal([]byte(envStr.String), &s.EnvVars)
		}
		stacks = append(stacks, s)
	}
	return stacks, rows.Err()
}

func (r *Repository) CreateStack(ctx context.Context, stack *models.Stack) error {
	envBytes, _ := json.Marshal(stack.EnvVars)
	now := time.Now().UTC()
	stack.CreatedAt = now
	stack.UpdatedAt = now

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO stacks (id, name, node_id, status, template_id, compose_yaml, env_vars, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		stack.ID, stack.Name, stack.NodeID, string(stack.Status), stack.TemplateID, stack.ComposeYAML, string(envBytes), stack.CreatedAt, stack.UpdatedAt,
	)
	return err
}

func (r *Repository) GetStack(ctx context.Context, id string) (*models.Stack, error) {
	row := r.db.QueryRowContext(ctx, "SELECT id, name, node_id, status, template_id, compose_yaml, env_vars, created_at, updated_at FROM stacks WHERE id = ?", id)
	var s models.Stack
	var envStr sql.NullString
	var tmplID sql.NullString
	err := row.Scan(&s.ID, &s.Name, &s.NodeID, &s.Status, &tmplID, &s.ComposeYAML, &envStr, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if tmplID.Valid {
		s.TemplateID = tmplID.String
	}
	if envStr.Valid && envStr.String != "" {
		_ = json.Unmarshal([]byte(envStr.String), &s.EnvVars)
	}
	return &s, nil
}

func (r *Repository) UpdateStack(ctx context.Context, stack *models.Stack) error {
	envBytes, _ := json.Marshal(stack.EnvVars)
	stack.UpdatedAt = time.Now().UTC()

	_, err := r.db.ExecContext(ctx, `
		UPDATE stacks
		SET name = ?, status = ?, compose_yaml = ?, env_vars = ?, updated_at = ?
		WHERE id = ?`,
		stack.Name, string(stack.Status), stack.ComposeYAML, string(envBytes), stack.UpdatedAt, stack.ID,
	)
	return err
}

func (r *Repository) UpdateStackStatus(ctx context.Context, id string, status models.StackStatus) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx, "UPDATE stacks SET status = ?, updated_at = ? WHERE id = ?", string(status), now, id)
	return err
}

func (r *Repository) DeleteStack(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM stacks WHERE id = ?", id)
	return err
}

// Catalogs
func (r *Repository) ListCatalogs(ctx context.Context) ([]models.Catalog, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, name, url, branch, is_official, status, last_synced_at FROM catalogs ORDER BY is_official DESC, name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var catalogs []models.Catalog
	for rows.Next() {
		var c models.Catalog
		var isOff int
		err := rows.Scan(&c.ID, &c.Name, &c.URL, &c.Branch, &isOff, &c.Status, &c.LastSyncedAt)
		if err != nil {
			return nil, err
		}
		c.IsOfficial = isOff == 1
		catalogs = append(catalogs, c)
	}
	return catalogs, rows.Err()
}
