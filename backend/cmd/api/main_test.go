package main

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/model"
)

func TestWriteUserTable(t *testing.T) {
	t.Parallel()

	users := []model.PlatformUser{
		{
			ID: "1", Username: "michojekunle1_551", Name: "A M D",
			Email: "michojekunle1@gmail.com", Role: model.RoleUser,
			UpdatedAt: time.Date(2026, 9, 28, 13, 0, 0, 0, time.UTC),
		},
		{
			ID: "2", Username: "victor.i1_69", Name: "DevLegdr Graduate",
			Email: "victor.i1@turing.com", Role: model.RoleAdmin,
			UpdatedAt: time.Date(2026, 9, 27, 9, 30, 0, 0, time.UTC),
		},
	}

	var buf bytes.Buffer
	if err := writeUserTable(&buf, users); err != nil {
		t.Fatalf("writeUserTable: %v", err)
	}

	got := buf.String()
	lines := strings.Split(strings.TrimRight(got, "\n"), "\n")
	if len(lines) != 3 {
		t.Fatalf("want a header and 2 rows, got %d lines:\n%s", len(lines), got)
	}

	// The header must name every column the operator needs, and the email in
	// particular: the handle is derived from it, so it is what identifies the
	// account whose stored handle does not match the one they recognise.
	for _, col := range []string{"USERNAME", "NAME", "EMAIL", "ROLE", "UPDATED"} {
		if !strings.Contains(lines[0], col) {
			t.Errorf("header missing %q: %q", col, lines[0])
		}
	}

	// The timestamp is reduced to a date. The operator is identifying an account,
	// not reading audit records, and a full timestamp pushes the columns wide.
	if !strings.Contains(got, "2026-09-28") {
		t.Errorf("want the date 2026-09-28 in:\n%s", got)
	}
	if strings.Contains(got, "13:00:00") {
		t.Errorf("want the time of day dropped, got:\n%s", got)
	}

	if !strings.Contains(lines[1], "michojekunle1_551") ||
		!strings.Contains(lines[1], "michojekunle1@gmail.com") ||
		!strings.Contains(lines[1], string(model.RoleUser)) {
		t.Errorf("row 1 did not carry the handle, email and role:\n%s", lines[1])
	}
	if !strings.Contains(lines[2], "victor.i1_69") ||
		!strings.Contains(lines[2], string(model.RoleAdmin)) {
		t.Errorf("row 2 did not carry the handle and admin role:\n%s", lines[2])
	}
}

// A row must not be able to run the columns together. tabwriter aligns on
// tabs, so a field containing one would split the table.
func TestWriteUserTableAlignsColumns(t *testing.T) {
	t.Parallel()

	users := []model.PlatformUser{{
		ID: "1", Username: "short", Name: "A", Email: "a@b.co",
		Role: model.RoleUser, UpdatedAt: time.Date(2026, 9, 28, 0, 0, 0, 0, time.UTC),
	}}

	var buf bytes.Buffer
	if err := writeUserTable(&buf, users); err != nil {
		t.Fatalf("writeUserTable: %v", err)
	}

	lines := strings.Split(strings.TrimRight(buf.String(), "\n"), "\n")
	if len(lines) != 2 {
		t.Fatalf("want 2 lines, got %d:\n%s", len(lines), buf.String())
	}
	// Header and row must both have 5 space-separated fields.
	for i, line := range lines {
		if fields := len(strings.Fields(line)); fields != 5 {
			t.Errorf("line %d has %d fields, want 5: %q", i, fields, line)
		}
	}
}

func TestWriteUserTableEmpty(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	if err := writeUserTable(&buf, nil); err != nil {
		t.Fatalf("writeUserTable: %v", err)
	}
	// An empty roster still prints the header, so the column meanings are
	// visible. listUsers returns before this point and logs instead, so this
	// only covers direct calls.
	if !strings.Contains(buf.String(), "USERNAME") {
		t.Errorf("want the header even with no users, got %q", buf.String())
	}
}
