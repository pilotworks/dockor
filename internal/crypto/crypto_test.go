package crypto

import (
	"testing"
)

func TestEncryptDecrypt(t *testing.T) {
	key := "my-super-secret-key-12345"
	original := "ghp_PersonalAccessTokenSecret123!"

	ciphertext, err := Encrypt(original, key)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if ciphertext == original {
		t.Fatalf("Ciphertext equals original text!")
	}

	decrypted, err := Decrypt(ciphertext, key)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if decrypted != original {
		t.Fatalf("Expected %q, got %q", original, decrypted)
	}

	// Wrong key should fail
	_, err = Decrypt(ciphertext, "wrong-key")
	if err == nil {
		t.Fatalf("Expected error when decrypting with wrong key")
	}
}
