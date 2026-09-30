package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
)

// DeriveKey derives a consistent 32-byte (256-bit) AES key from secret string
func DeriveKey(secret string) []byte {
	hash := sha256.Sum256([]byte(secret))
	return hash[:]
}

// Encrypt encrypts plaintext using AES-256-GCM and returns standard base64 string
func Encrypt(plaintext, secretKey string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	key := DeriveKey(secretKey)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts base64-encoded AES-256-GCM ciphertext using secretKey
func Decrypt(encodedCiphertext, secretKey string) (string, error) {
	if encodedCiphertext == "" {
		return "", nil
	}
	data, err := base64.StdEncoding.DecodeString(encodedCiphertext)
	if err != nil {
		return "", err
	}

	key := DeriveKey(secretKey)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("malformed ciphertext: length smaller than nonce size")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}
