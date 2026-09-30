package repository

import (
	"context"
	"os"
	"testing"

	"github.com/pilotworks/dockor/internal/crypto"
	"github.com/pilotworks/dockor/internal/models"
)

func TestUserRepository(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "dockor-user-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	db, err := NewDB(tempDir + "/test.db")
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	defer db.Close()

	repo := NewRepository(db)
	ctx := context.Background()

	// 1. EnsureDefaultAdmin creates admin user
	if err := repo.EnsureDefaultAdmin(ctx); err != nil {
		t.Fatalf("EnsureDefaultAdmin failed: %v", err)
	}

	admin, err := repo.GetUserByUsername(ctx, "admin")
	if err != nil {
		t.Fatalf("GetUserByUsername failed: %v", err)
	}
	if admin.Role != models.RoleAdmin {
		t.Fatalf("expected role admin, got %s", admin.Role)
	}
	if !crypto.CheckPasswordHash("admin123", admin.PasswordHash) {
		t.Fatalf("admin password hash verification failed")
	}

	// 2. Create secondary developer user
	devPassHash, _ := crypto.HashPassword("devpass123")
	devUser := &models.User{
		ID:           "usr_dev_1",
		Username:     "developer",
		Email:        "dev@dockor.local",
		PasswordHash: devPassHash,
		Role:         models.RoleDeveloper,
	}
	if err := repo.CreateUser(ctx, devUser); err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	// 3. ListUsers
	users, err := repo.ListUsers(ctx)
	if err != nil {
		t.Fatalf("ListUsers failed: %v", err)
	}
	if len(users) != 2 {
		t.Fatalf("expected 2 users, got %d", len(users))
	}

	// 4. UpdateUser role and email
	devUser.Email = "newdev@dockor.local"
	devUser.Role = models.RoleViewer
	if err := repo.UpdateUser(ctx, devUser); err != nil {
		t.Fatalf("UpdateUser failed: %v", err)
	}

	fetched, err := repo.GetUserByID(ctx, devUser.ID)
	if err != nil {
		t.Fatalf("GetUserByID failed: %v", err)
	}
	if fetched.Email != "newdev@dockor.local" || fetched.Role != models.RoleViewer {
		t.Fatalf("UpdateUser values mismatch: %+v", fetched)
	}

	// 5. UpdateUserPassword
	newHash, _ := crypto.HashPassword("updatedpassword")
	if err := repo.UpdateUserPassword(ctx, devUser.ID, newHash); err != nil {
		t.Fatalf("UpdateUserPassword failed: %v", err)
	}
	updated, _ := repo.GetUserByID(ctx, devUser.ID)
	if !crypto.CheckPasswordHash("updatedpassword", updated.PasswordHash) {
		t.Fatalf("updated password verification failed")
	}

	// 6. DeleteUser
	if err := repo.DeleteUser(ctx, devUser.ID); err != nil {
		t.Fatalf("DeleteUser failed: %v", err)
	}
	_, err = repo.GetUserByID(ctx, devUser.ID)
	if err == nil {
		t.Fatalf("expected error getting deleted user")
	}
}
