package security

import (
	"bytes"
	"testing"
	"time"
)

func TestCipherRoundTrip(t *testing.T) {
	c, err := NewCipher(bytes.Repeat([]byte{7}, 32))
	if err != nil {
		t.Fatal(err)
	}
	ct := c.Encrypt("sk-secret")
	if bytes.Contains(ct, []byte("sk-secret")) {
		t.Fatal("ciphertext contains plaintext")
	}
	pt, err := c.Decrypt(ct)
	if err != nil || pt != "sk-secret" {
		t.Fatalf("Decrypt = %q, %v", pt, err)
	}
	ct[len(ct)-1] ^= 1
	if _, err := c.Decrypt(ct); err == nil {
		t.Fatal("tampered ciphertext decrypted")
	}
}

func TestCertificateDetectsTampering(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	issued := time.Date(2026, 9, 24, 14, 0, 0, 0, time.UTC)
	in := CertificateInput{
		SubmissionHash: "a3f9d21", IdeaID: "lpg-route-optimizer", AuthorUsername: "junior_dev",
		RepoURL: "https://github.com/a/b", TestsPassed: 24, TestsTotal: 24,
		IssuedAt: issued, ValidUntil: issued.Add(365 * 24 * time.Hour),
	}
	stamp := SignCertificate(secret, in)
	if !VerifyCertificate(secret, in, stamp) {
		t.Fatal("valid certificate rejected")
	}
	// Username case must not matter; the ledger treats handles case-insensitively.
	in2 := in
	in2.AuthorUsername = "Junior_Dev"
	if !VerifyCertificate(secret, in2, stamp) {
		t.Fatal("certificate should be case-insensitive on username")
	}

	tampered := in
	tampered.RepoURL = "https://github.com/evil/b"
	if VerifyCertificate(secret, tampered, stamp) {
		t.Fatal("tampered repo URL accepted")
	}
	if VerifyCertificate([]byte("another-secret-another-secret-xx"), in, stamp) {
		t.Fatal("certificate verified under a different secret")
	}
}

func TestHashTokenIsStableAndDistinct(t *testing.T) {
	a, b := NewToken(), NewToken()
	if a == b {
		t.Fatal("tokens collided")
	}
	if !bytes.Equal(HashToken(a), HashToken(a)) || bytes.Equal(HashToken(a), HashToken(b)) {
		t.Fatal("HashToken not deterministic/distinct")
	}
	if got := len(RandomHex(7)); got != 7 {
		t.Fatalf("RandomHex(7) length = %d", got)
	}
}
