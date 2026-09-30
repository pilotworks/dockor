package crypto

import (
	"testing"
	"time"
)

func TestPasswordHashing(t *testing.T) {
	password := "SecretP@ssw0rd!"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}

	if hash == password {
		t.Fatalf("hash should not match plaintext password")
	}

	if !CheckPasswordHash(password, hash) {
		t.Fatalf("password should verify correctly against hash")
	}

	if CheckPasswordHash("WrongPassword", hash) {
		t.Fatalf("wrong password should fail check")
	}
}

func TestJWTGenerationAndValidation(t *testing.T) {
	secret := "test-secret-key-12345"
	claims := JWTClaims{
		Subject:   "usr_123",
		Username:  "johndoe",
		Email:     "john@example.com",
		Role:      "developer",
		ExpiresAt: time.Now().UTC().Add(1 * time.Hour).Unix(),
	}

	token, err := GenerateJWT(claims, secret)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	parsed, err := ValidateJWT(token, secret)
	if err != nil {
		t.Fatalf("failed to validate valid token: %v", err)
	}

	if parsed.Subject != claims.Subject || parsed.Username != claims.Username || parsed.Role != claims.Role {
		t.Fatalf("parsed claims mismatch: got %+v, want %+v", parsed, claims)
	}

	// Validate with wrong secret
	_, err = ValidateJWT(token, "wrong-secret")
	if err == nil {
		t.Fatalf("expected error validating with wrong secret")
	}

	// Expired token
	expiredClaims := JWTClaims{
		Subject:   "usr_expired",
		Username:  "expired",
		ExpiresAt: time.Now().UTC().Add(-1 * time.Minute).Unix(),
	}
	expiredToken, err := GenerateJWT(expiredClaims, secret)
	if err != nil {
		t.Fatalf("failed to generate expired token: %v", err)
	}

	_, err = ValidateJWT(expiredToken, secret)
	if err != ErrTokenExpired {
		t.Fatalf("expected ErrTokenExpired, got %v", err)
	}
}
