package store

import (
	"maps"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
)

// migrationsDir is relative to this package; `go test` runs with the package
// directory as the working directory.
const migrationsDir = "../db/migrations"

var (
	// addColumn matches `add column [if not exists] <name>` in any migration.
	addColumn = regexp.MustCompile(`(?i)add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)`)
	// tableColumn matches the indented body of a create table statement. The
	// baseline migration predates the split this package grew, so columns added
	// before it are declared inline rather than by ALTER.
	tableColumn = regexp.MustCompile(`(?m)^\s{2,}(\w+)\s+\w`)
	// profileAlias matches every column the read path names as p.<column>.
	profileAlias = regexp.MustCompile(`\bp\.(\w+)`)
	// jobAlias matches every column the job read path names as j.<column>.
	jobAlias = regexp.MustCompile(`\bj\.(\w+)`)
	// assignment matches a bare `column = ...` in the update path, which does
	// not go through the p. alias.
	assignment = regexp.MustCompile(`(?m)^\s*(\w+)\s*=\s*(?:coalesce\(\$|now\(\)|\$|case|excluded)`)
	// setAssignment matches a column written in an UPDATE ... SET list: the
	// first one after `set`, or a later one after a comma. Job updates name
	// their columns bare, because Postgres will not accept a qualified target.
	setAssignment = regexp.MustCompile(`(?i)(?:\bset\b\s+|,\s*)(\w+)\s*=`)
)

// declaredColumns replays the migration files well enough to know which
// columns public.<table> ends up with. It is not a SQL parser: it reads create
// table bodies and add column statements, which is how every column in this
// schema has been introduced.
func declaredColumns(t *testing.T, table string) map[string]bool {
	t.Helper()

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		t.Fatalf("read migrations: %v", err)
	}

	columns := map[string]bool{}
	for _, entry := range slices.SortedFunc(slices.Values(entries), func(a, b os.DirEntry) int {
		return strings.Compare(a.Name(), b.Name())
	}) {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".sql" {
			continue
		}
		sql, err := os.ReadFile(filepath.Join(migrationsDir, entry.Name()))
		if err != nil {
			t.Fatalf("read %s: %v", entry.Name(), err)
		}
		text := string(sql)

		if at := strings.Index(text, "create table if not exists public."+table+" ("); at >= 0 {
			body := text[at:]
			if end := strings.Index(body, "\n);"); end >= 0 {
				body = body[:end]
			}
			for _, m := range tableColumn.FindAllStringSubmatch(body, -1) {
				columns[m[1]] = true
			}
		}
		for _, m := range addColumn.FindAllStringSubmatch(text, -1) {
			columns[m[1]] = true
		}
	}
	return columns
}

// TestProfileQueriesOnlyTouchMigratedColumns guards the deploy ordering.
//
// The API runs migrations on boot, so a release where the code lands before its
// migration does not fail loudly: it fails on the first authenticated request,
// for every user, because profileSelect names a column that does not exist yet.
// That is a total outage surfacing as a 500 rather than a startup error, and it
// is invisible until someone signs in.
//
// This is a static check rather than a live one precisely because it has to hold
// before the database has been migrated, which is the window that matters.
func TestProfileQueriesOnlyTouchMigratedColumns(t *testing.T) {
	t.Parallel()

	declared := declaredColumns(t, "profiles")
	if len(declared) == 0 {
		t.Fatal("no columns found; the migration reader is broken, not the schema")
	}

	referenced := map[string]bool{}
	for _, m := range profileAlias.FindAllStringSubmatch(profileSelect, -1) {
		referenced[m[1]] = true
	}
	for _, m := range assignment.FindAllStringSubmatch(updateProfileSQL, -1) {
		referenced[m[1]] = true
	}

	for _, column := range slices.Sorted(maps.Keys(referenced)) {
		if !declared[column] {
			t.Errorf("public.profiles has no column %q, but the profile queries read or write it; "+
				"its migration must ship before this code does", column)
		}
	}
}

// TestJobQueriesOnlyTouchMigratedColumns is the same deploy-ordering guard as
// TestProfileQueriesOnlyTouchMigratedColumns, for public.jobs.
//
// jobSelect is on every job read, including the public board, so a column it
// names that no migration declares is a 500 on every listing request. The new
// deleted_at is the case this was written for: the code that reads it has to
// ship with 0008, not ahead of it.
func TestJobQueriesOnlyTouchMigratedColumns(t *testing.T) {
	t.Parallel()

	declared := declaredColumns(t, "jobs")
	if len(declared) == 0 {
		t.Fatal("no columns found; the migration reader is broken, not the schema")
	}

	referenced := map[string]bool{}
	for _, m := range jobAlias.FindAllStringSubmatch(jobSelect, -1) {
		referenced[m[1]] = true
	}
	for _, sql := range []string{setJobActiveSQL, deleteJobSQL} {
		for _, m := range setAssignment.FindAllStringSubmatch(sql, -1) {
			referenced[m[1]] = true
		}
	}

	// The guard is only meaningful if it actually saw the columns.
	for _, want := range []string{"deleted_at", "is_active"} {
		if !referenced[want] {
			t.Errorf("the job queries were not recognised as touching %q; the reader or regex is broken, not the schema", want)
		}
	}

	for _, column := range slices.Sorted(maps.Keys(referenced)) {
		if !declared[column] {
			t.Errorf("public.jobs has no column %q, but the job queries read or write it; "+
				"its migration must ship before this code does", column)
		}
	}
}
