package repository

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"github.com/pilotworks/dockor/internal/crypto"
	"github.com/pilotworks/dockor/internal/models"
)

type Repository struct {
	db *DB
}

func NewRepository(db *DB) *Repository {
	return &Repository{db: db}
}

// EnsureDefaultAdmin creates an initial admin user if no users exist or upgrades plaintext hashes
func (r *Repository) EnsureDefaultAdmin(ctx context.Context) error {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}
	if count == 0 {
		now := time.Now().UTC()
		hashed, err := crypto.HashPassword("admin123")
		if err != nil {
			return err
		}
		_, err = r.db.ExecContext(ctx, `
			INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			"usr_admin", "admin", "admin@dockor.local", hashed, string(models.RoleAdmin), now, now,
		)
		if err != nil {
			return err
		}
		return nil
	}

	// Upgrade legacy plaintext password if present
	var id, passHash string
	err = r.db.QueryRowContext(ctx, "SELECT id, password_hash FROM users WHERE username = 'admin'").Scan(&id, &passHash)
	if err == nil && passHash == "admin123" {
		hashed, err := crypto.HashPassword("admin123")
		if err == nil {
			_, _ = r.db.ExecContext(ctx, "UPDATE users SET password_hash = ? WHERE id = ?", hashed, id)
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
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			id, name, hostname, ip_address, docker_version, status, is_local,
			cpu_cores, total_memory, COALESCE(endpoint, ''),
			COALESCE(agent_version, ''), COALESCE(os, ''), COALESCE(arch, ''),
			COALESCE(containers_running, 0), COALESCE(containers_total, 0),
			COALESCE(cpu_usage_percent, 0.0), COALESCE(memory_usage_bytes, 0),
			last_seen_at, created_at
		FROM nodes ORDER BY is_local DESC, name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []models.Node
	for rows.Next() {
		var n models.Node
		var isLocal int
		err := rows.Scan(
			&n.ID, &n.Name, &n.Hostname, &n.IPAddress, &n.DockerVersion, &n.Status, &isLocal,
			&n.CPUCores, &n.TotalMemory, &n.Endpoint,
			&n.AgentVersion, &n.OS, &n.Arch,
			&n.ContainersRunning, &n.ContainersTotal,
			&n.CPUUsagePercent, &n.MemoryUsageBytes,
			&n.LastSeenAt, &n.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		n.IsLocal = isLocal == 1
		nodes = append(nodes, n)
	}
	return nodes, rows.Err()
}

// UpsertRemoteNode registers or updates a remote node connected via dockor-agent
func (r *Repository) UpsertRemoteNode(ctx context.Context, n *models.Node) error {
	now := time.Now().UTC()
	var count int
	_ = r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM nodes WHERE id = ?", n.ID).Scan(&count)
	if count == 0 {
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO nodes (
				id, name, hostname, ip_address, docker_version, status, is_local,
				cpu_cores, total_memory, endpoint, agent_version, os, arch,
				containers_running, containers_total, cpu_usage_percent, memory_usage_bytes,
				last_seen_at, created_at
			)
			VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			n.ID, n.Name, n.Hostname, n.IPAddress, n.DockerVersion, string(n.Status),
			n.CPUCores, n.TotalMemory, n.Endpoint, n.AgentVersion, n.OS, n.Arch,
			n.ContainersRunning, n.ContainersTotal, n.CPUUsagePercent, n.MemoryUsageBytes,
			now, now,
		)
		return err
	}

	_, err := r.db.ExecContext(ctx, `
		UPDATE nodes SET
			name = ?, hostname = ?, ip_address = ?, docker_version = ?, status = ?,
			cpu_cores = ?, total_memory = ?, endpoint = ?, agent_version = ?, os = ?, arch = ?,
			last_seen_at = ?
		WHERE id = ?`,
		n.Name, n.Hostname, n.IPAddress, n.DockerVersion, string(n.Status),
		n.CPUCores, n.TotalMemory, n.Endpoint, n.AgentVersion, n.OS, n.Arch,
		now, n.ID,
	)
	return err
}

func (r *Repository) GetNode(ctx context.Context, id string) (*models.Node, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT
			id, name, hostname, ip_address, docker_version, status, is_local,
			cpu_cores, total_memory, COALESCE(endpoint, ''),
			COALESCE(agent_version, ''), COALESCE(os, ''), COALESCE(arch, ''),
			COALESCE(containers_running, 0), COALESCE(containers_total, 0),
			COALESCE(cpu_usage_percent, 0.0), COALESCE(memory_usage_bytes, 0),
			last_seen_at, created_at
		FROM nodes WHERE id = ?`, id)

	var n models.Node
	var isLocal int
	err := row.Scan(
		&n.ID, &n.Name, &n.Hostname, &n.IPAddress, &n.DockerVersion, &n.Status, &isLocal,
		&n.CPUCores, &n.TotalMemory, &n.Endpoint,
		&n.AgentVersion, &n.OS, &n.Arch,
		&n.ContainersRunning, &n.ContainersTotal,
		&n.CPUUsagePercent, &n.MemoryUsageBytes,
		&n.LastSeenAt, &n.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("node not found")
		}
		return nil, err
	}
	n.IsLocal = isLocal == 1
	return &n, nil
}

func (r *Repository) UpdateNodeStatus(ctx context.Context, id string, status models.NodeStatus) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx, "UPDATE nodes SET status = ?, last_seen_at = ? WHERE id = ?", string(status), now, id)
	return err
}

func (r *Repository) UpdateNodeTelemetry(ctx context.Context, id string, cpuPercent float64, memUsed int64, running int, total int, dockerVer string) error {
	now := time.Now().UTC()
	query := `
		UPDATE nodes SET
			status = 'online',
			cpu_usage_percent = ?,
			memory_usage_bytes = ?,
			containers_running = ?,
			containers_total = ?,
			docker_version = CASE WHEN ? != '' THEN ? ELSE docker_version END,
			last_seen_at = ?
		WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, cpuPercent, memUsed, running, total, dockerVer, dockerVer, now, id)
	return err
}

func (r *Repository) MarkDisconnectedNodes(ctx context.Context, timeout time.Duration) (int64, error) {
	threshold := time.Now().UTC().Add(-timeout)
	res, err := r.db.ExecContext(ctx, `
		UPDATE nodes
		SET status = 'disconnected'
		WHERE is_local = 0 AND status != 'disconnected' AND last_seen_at < ?`, threshold)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// Enrollment Tokens
func (r *Repository) CreateEnrollmentToken(ctx context.Context, token string, ttl time.Duration) error {
	now := time.Now().UTC()
	expiresAt := now.Add(ttl)
	_, err := r.db.ExecContext(ctx, "INSERT INTO agent_enrollment_tokens (token, created_at, expires_at) VALUES (?, ?, ?)", token, now, expiresAt)
	return err
}

func (r *Repository) ValidateAndConsumeEnrollmentToken(ctx context.Context, token string) (bool, error) {
	now := time.Now().UTC()
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM agent_enrollment_tokens WHERE token = ? AND expires_at > ? AND used_at IS NULL", token, now).Scan(&count)
	if err != nil {
		return false, err
	}
	if count == 0 {
		return false, nil
	}
	_, _ = r.db.ExecContext(ctx, "UPDATE agent_enrollment_tokens SET used_at = ? WHERE token = ?", now, token)
	return true, nil
}

func generateToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// Stacks
func (r *Repository) ListStacks(ctx context.Context, nodeID string) ([]models.Stack, error) {
	query := "SELECT id, name, node_id, status, template_id, compose_yaml, env_vars, COALESCE(webhook_token, ''), created_at, updated_at FROM stacks"
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
		err := rows.Scan(&s.ID, &s.Name, &s.NodeID, &s.Status, &tmplID, &s.ComposeYAML, &envStr, &s.WebhookToken, &s.CreatedAt, &s.UpdatedAt)
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
	if stack.WebhookToken == "" {
		stack.WebhookToken = generateToken()
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO stacks (id, name, node_id, status, template_id, compose_yaml, env_vars, webhook_token, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		stack.ID, stack.Name, stack.NodeID, string(stack.Status), stack.TemplateID, stack.ComposeYAML, string(envBytes), stack.WebhookToken, stack.CreatedAt, stack.UpdatedAt,
	)
	return err
}

func (r *Repository) GetStack(ctx context.Context, id string) (*models.Stack, error) {
	row := r.db.QueryRowContext(ctx, "SELECT id, name, node_id, status, template_id, compose_yaml, env_vars, COALESCE(webhook_token, ''), created_at, updated_at FROM stacks WHERE id = ?", id)
	var s models.Stack
	var envStr sql.NullString
	var tmplID sql.NullString
	err := row.Scan(&s.ID, &s.Name, &s.NodeID, &s.Status, &tmplID, &s.ComposeYAML, &envStr, &s.WebhookToken, &s.CreatedAt, &s.UpdatedAt)
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

func (r *Repository) UpdateStackWebhookToken(ctx context.Context, id string, token string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx, "UPDATE stacks SET webhook_token = ?, updated_at = ? WHERE id = ?", token, now, id)
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

func (r *Repository) DeleteNode(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM nodes WHERE id = ? AND is_local = 0", id)
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

// Registries
func (r *Repository) ListRegistries(ctx context.Context) ([]models.Registry, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, name, server_address, username, encrypted_password, is_default, created_at, updated_at FROM registries ORDER BY is_default DESC, name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Registry
	for rows.Next() {
		var reg models.Registry
		var isDef int
		err := rows.Scan(&reg.ID, &reg.Name, &reg.ServerAddress, &reg.Username, &reg.EncryptedPassword, &isDef, &reg.CreatedAt, &reg.UpdatedAt)
		if err != nil {
			return nil, err
		}
		reg.IsDefault = isDef == 1
		reg.HasPassword = reg.EncryptedPassword != ""
		list = append(list, reg)
	}
	return list, rows.Err()
}

func (r *Repository) GetRegistry(ctx context.Context, id string) (*models.Registry, error) {
	var reg models.Registry
	var isDef int
	err := r.db.QueryRowContext(ctx, "SELECT id, name, server_address, username, encrypted_password, is_default, created_at, updated_at FROM registries WHERE id = ?", id).
		Scan(&reg.ID, &reg.Name, &reg.ServerAddress, &reg.Username, &reg.EncryptedPassword, &isDef, &reg.CreatedAt, &reg.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("registry not found")
		}
		return nil, err
	}
	reg.IsDefault = isDef == 1
	reg.HasPassword = reg.EncryptedPassword != ""
	return &reg, nil
}

func (r *Repository) GetRegistryByServerAddress(ctx context.Context, serverAddress string) (*models.Registry, error) {
	var reg models.Registry
	var isDef int
	err := r.db.QueryRowContext(ctx, "SELECT id, name, server_address, username, encrypted_password, is_default, created_at, updated_at FROM registries WHERE server_address = ? OR server_address LIKE ? LIMIT 1",
		serverAddress, "%"+serverAddress+"%").
		Scan(&reg.ID, &reg.Name, &reg.ServerAddress, &reg.Username, &reg.EncryptedPassword, &isDef, &reg.CreatedAt, &reg.UpdatedAt)
	if err != nil {
		return nil, err
	}
	reg.IsDefault = isDef == 1
	reg.HasPassword = reg.EncryptedPassword != ""
	return &reg, nil
}

func (r *Repository) CreateRegistry(ctx context.Context, reg *models.Registry) error {
	now := time.Now().UTC()
	if reg.ID == "" {
		reg.ID = "reg_" + hex.EncodeToString(func() []byte { b := make([]byte, 8); rand.Read(b); return b }())
	}
	reg.CreatedAt = now
	reg.UpdatedAt = now

	isDef := 0
	if reg.IsDefault {
		isDef = 1
		// If setting as default, clear other defaults
		_, _ = r.db.ExecContext(ctx, "UPDATE registries SET is_default = 0")
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO registries (id, name, server_address, username, encrypted_password, is_default, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		reg.ID, reg.Name, reg.ServerAddress, reg.Username, reg.EncryptedPassword, isDef, now, now,
	)
	return err
}

func (r *Repository) UpdateRegistry(ctx context.Context, reg *models.Registry) error {
	now := time.Now().UTC()
	reg.UpdatedAt = now

	isDef := 0
	if reg.IsDefault {
		isDef = 1
		_, _ = r.db.ExecContext(ctx, "UPDATE registries SET is_default = 0 WHERE id != ?", reg.ID)
	}

	if reg.EncryptedPassword != "" {
		_, err := r.db.ExecContext(ctx, `
			UPDATE registries SET name = ?, server_address = ?, username = ?, encrypted_password = ?, is_default = ?, updated_at = ?
			WHERE id = ?`,
			reg.Name, reg.ServerAddress, reg.Username, reg.EncryptedPassword, isDef, now, reg.ID,
		)
		return err
	}

	_, err := r.db.ExecContext(ctx, `
		UPDATE registries SET name = ?, server_address = ?, username = ?, is_default = ?, updated_at = ?
		WHERE id = ?`,
		reg.Name, reg.ServerAddress, reg.Username, isDef, now, reg.ID,
	)
	return err
}

func (r *Repository) DeleteRegistry(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM registries WHERE id = ?", id)
	return err
}

// User Management Methods

func (r *Repository) GetUserByID(ctx context.Context, id string) (*models.User, error) {
	row := r.db.QueryRowContext(ctx, "SELECT id, username, email, password_hash, role, created_at, updated_at FROM users WHERE id = ?", id)
	var u models.User
	var role string
	err := row.Scan(&u.ID, &u.Username, &u.Email, &u.PasswordHash, &role, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	u.Role = models.UserRole(role)
	return &u, nil
}

func (r *Repository) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	row := r.db.QueryRowContext(ctx, "SELECT id, username, email, password_hash, role, created_at, updated_at FROM users WHERE username = ?", username)
	var u models.User
	var role string
	err := row.Scan(&u.ID, &u.Username, &u.Email, &u.PasswordHash, &role, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	u.Role = models.UserRole(role)
	return &u, nil
}

func (r *Repository) ListUsers(ctx context.Context) ([]models.User, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, username, email, password_hash, role, created_at, updated_at FROM users ORDER BY created_at ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		var role string
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.PasswordHash, &role, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		u.Role = models.UserRole(role)
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *Repository) CreateUser(ctx context.Context, user *models.User) error {
	now := time.Now().UTC()
	user.CreatedAt = now
	user.UpdatedAt = now
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		user.ID, user.Username, user.Email, user.PasswordHash, string(user.Role), user.CreatedAt, user.UpdatedAt,
	)
	return err
}

func (r *Repository) UpdateUser(ctx context.Context, user *models.User) error {
	user.UpdatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx, `
		UPDATE users SET email = ?, role = ?, updated_at = ?
		WHERE id = ?`,
		user.Email, string(user.Role), user.UpdatedAt, user.ID,
	)
	return err
}

func (r *Repository) UpdateUserPassword(ctx context.Context, id, passwordHash string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx, `
		UPDATE users SET password_hash = ?, updated_at = ?
		WHERE id = ?`,
		passwordHash, now, id,
	)
	return err
}

func (r *Repository) DeleteUser(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM users WHERE id = ?", id)
	return err
}

func (r *Repository) CountUsers(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	return count, err
}

// Proxy Routes Management

func (r *Repository) ListProxyRoutes(ctx context.Context) ([]models.ProxyRoute, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, domain, target_url, COALESCE(container_id, ''), COALESCE(stack_id, ''), ssl_mode, enabled, COALESCE(email, ''), created_at, updated_at
		FROM proxy_routes ORDER BY domain ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var routes []models.ProxyRoute
	for rows.Next() {
		var pr models.ProxyRoute
		var enabledInt int
		err := rows.Scan(
			&pr.ID, &pr.Domain, &pr.TargetURL, &pr.ContainerID, &pr.StackID,
			&pr.SSLMode, &enabledInt, &pr.Email, &pr.CreatedAt, &pr.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		pr.Enabled = enabledInt == 1
		routes = append(routes, pr)
	}
	return routes, rows.Err()
}

func (r *Repository) GetProxyRoute(ctx context.Context, id string) (*models.ProxyRoute, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, domain, target_url, COALESCE(container_id, ''), COALESCE(stack_id, ''), ssl_mode, enabled, COALESCE(email, ''), created_at, updated_at
		FROM proxy_routes WHERE id = ?`, id)

	var pr models.ProxyRoute
	var enabledInt int
	err := row.Scan(
		&pr.ID, &pr.Domain, &pr.TargetURL, &pr.ContainerID, &pr.StackID,
		&pr.SSLMode, &enabledInt, &pr.Email, &pr.CreatedAt, &pr.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("proxy route not found")
		}
		return nil, err
	}
	pr.Enabled = enabledInt == 1
	return &pr, nil
}

func (r *Repository) GetProxyRouteByDomain(ctx context.Context, domain string) (*models.ProxyRoute, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, domain, target_url, COALESCE(container_id, ''), COALESCE(stack_id, ''), ssl_mode, enabled, COALESCE(email, ''), created_at, updated_at
		FROM proxy_routes WHERE domain = ?`, domain)

	var pr models.ProxyRoute
	var enabledInt int
	err := row.Scan(
		&pr.ID, &pr.Domain, &pr.TargetURL, &pr.ContainerID, &pr.StackID,
		&pr.SSLMode, &enabledInt, &pr.Email, &pr.CreatedAt, &pr.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	pr.Enabled = enabledInt == 1
	return &pr, nil
}

func (r *Repository) CreateProxyRoute(ctx context.Context, route *models.ProxyRoute) error {
	now := time.Now().UTC()
	if route.ID == "" {
		route.ID = "prx_" + hex.EncodeToString(func() []byte { b := make([]byte, 8); rand.Read(b); return b }())
	}
	route.CreatedAt = now
	route.UpdatedAt = now

	enabledInt := 0
	if route.Enabled {
		enabledInt = 1
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO proxy_routes (id, domain, target_url, container_id, stack_id, ssl_mode, enabled, email, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		route.ID, route.Domain, route.TargetURL, route.ContainerID, route.StackID,
		string(route.SSLMode), enabledInt, route.Email, route.CreatedAt, route.UpdatedAt,
	)
	return err
}

func (r *Repository) UpdateProxyRoute(ctx context.Context, route *models.ProxyRoute) error {
	now := time.Now().UTC()
	route.UpdatedAt = now

	enabledInt := 0
	if route.Enabled {
		enabledInt = 1
	}

	_, err := r.db.ExecContext(ctx, `
		UPDATE proxy_routes
		SET domain = ?, target_url = ?, container_id = ?, stack_id = ?, ssl_mode = ?, enabled = ?, email = ?, updated_at = ?
		WHERE id = ?`,
		route.Domain, route.TargetURL, route.ContainerID, route.StackID,
		string(route.SSLMode), enabledInt, route.Email, route.UpdatedAt, route.ID,
	)
	return err
}

func (r *Repository) DeleteProxyRoute(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM proxy_routes WHERE id = ?", id)
	return err
}

func (r *Repository) ToggleProxyRoute(ctx context.Context, id string, enabled bool) error {
	now := time.Now().UTC()
	enabledInt := 0
	if enabled {
		enabledInt = 1
	}
	_, err := r.db.ExecContext(ctx, "UPDATE proxy_routes SET enabled = ?, updated_at = ? WHERE id = ?", enabledInt, now, id)
	return err
}

