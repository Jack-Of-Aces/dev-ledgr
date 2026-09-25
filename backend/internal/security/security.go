// Package security holds token, encryption and ledger-signing primitives.
package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

// NewToken returns a 256-bit random URL-safe token.
func NewToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err) // crypto/rand never fails on supported platforms
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

// HashToken is what gets persisted for session and magic-link tokens, so a
// database leak does not expose usable credentials.
func HashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

// RandomHex returns n random hex characters.
func RandomHex(n int) string {
	b := make([]byte, (n+1)/2)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)[:n]
}

// Cipher encrypts small secrets (BYOK API keys) with AES-256-GCM.
type Cipher struct{ aead cipher.AEAD }

func NewCipher(key []byte) (*Cipher, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Cipher{aead: aead}, nil
}

func (c *Cipher) Encrypt(plaintext string) []byte {
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		panic(err)
	}
	return c.aead.Seal(nonce, nonce, []byte(plaintext), nil)
}

func (c *Cipher) Decrypt(ciphertext []byte) (string, error) {
	n := c.aead.NonceSize()
	if len(ciphertext) < n {
		return "", errors.New("ciphertext too short")
	}
	pt, err := c.aead.Open(nil, ciphertext[:n], ciphertext[n:], nil)
	if err != nil {
		return "", err
	}
	return string(pt), nil
}

// CertificateInput is the canonical content a ledger certificate commits to.
type CertificateInput struct {
	SubmissionHash string
	IdeaID         string
	AuthorUsername string
	RepoURL        string
	CommitSHA      string
	TestsPassed    int
	TestsTotal     int
	IssuedAt       time.Time
	ValidUntil     time.Time
}

func (in CertificateInput) canonical() string {
	return strings.Join([]string{
		"devledgr-cert-v1",
		in.SubmissionHash,
		in.IdeaID,
		strings.ToLower(in.AuthorUsername),
		in.RepoURL,
		in.CommitSHA,
		fmt.Sprintf("%d/%d", in.TestsPassed, in.TestsTotal),
		in.IssuedAt.UTC().Format(time.RFC3339),
		in.ValidUntil.UTC().Format(time.RFC3339),
	}, "\n")
}

// SignCertificate returns an HMAC-SHA256 stamp over the canonical certificate
// content. Only the server holding the secret can mint a valid stamp, and any
// change to the recorded submission invalidates it.
func SignCertificate(secret []byte, in CertificateInput) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(in.canonical()))
	return hex.EncodeToString(mac.Sum(nil))
}

func VerifyCertificate(secret []byte, in CertificateInput, stamp string) bool {
	expected := SignCertificate(secret, in)
	return hmac.Equal([]byte(expected), []byte(stamp))
}
