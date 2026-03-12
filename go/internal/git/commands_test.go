package git

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

// setupGitDir creates a temp directory with git init and user config.
func setupGitDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	mustGit(t, dir, "init")
	mustGit(t, dir, "config", "user.email", "test@test.com")
	mustGit(t, dir, "config", "user.name", "Test")
	return dir
}

// mustGit runs a git command and fails the test if it doesn't succeed.
func mustGit(t *testing.T, cwd string, args ...string) string {
	t.Helper()
	result, err := Git(args, cwd)
	if err != nil {
		t.Fatalf("git %v failed: %v", args, err)
	}
	if !result.Success {
		t.Fatalf("git %v failed (exit %d): %s", args, result.ExitCode, result.Stderr)
	}
	return result.Stdout
}

// writeFile creates a file in the given directory.
func writeFile(t *testing.T, dir, name, content string) {
	t.Helper()
	full := filepath.Join(dir, name)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

// writePackageJSON writes a package.json with optional fields.
func writePackageJSON(t *testing.T, dir string, fields map[string]any) {
	t.Helper()
	if fields == nil {
		fields = map[string]any{"name": "test-pkg", "version": "1.0.0"}
	} else {
		if _, ok := fields["name"]; !ok {
			fields["name"] = "test-pkg"
		}
		if _, ok := fields["version"]; !ok {
			fields["version"] = "1.0.0"
		}
	}
	data, err := json.MarshalIndent(fields, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "package.json"), data, 0o644); err != nil {
		t.Fatal(err)
	}
}

// --- getUntrackedChanges.test.ts ---

// TS: "returns untracked files using object params"
func TestGetUntrackedChanges_ReturnsUntrackedFiles(t *testing.T) {
	cwd := setupGitDir(t)

	writeFile(t, cwd, "untracked1.txt", "content1")
	writeFile(t, cwd, "untracked2.js", "content2")

	result, err := GetUntrackedChanges(cwd)
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(result)
	expected := []string{"untracked1.txt", "untracked2.js"}
	if !slicesEqual(result, expected) {
		t.Errorf("got %v, want %v", result, expected)
	}
}

// TS: "does not include tracked files"
func TestGetUntrackedChanges_DoesNotIncludeTrackedFiles(t *testing.T) {
	cwd := setupGitDir(t)

	// Commit a file
	writeFile(t, cwd, "committed.txt", "committed content")
	mustGit(t, cwd, "add", "committed.txt")
	mustGit(t, cwd, "commit", "-m", "add committed file")

	// Stage a file
	writeFile(t, cwd, "staged.txt", "staged content")
	mustGit(t, cwd, "add", "staged.txt")

	// Create an untracked file
	writeFile(t, cwd, "untracked.txt", "untracked content")

	result, err := GetUntrackedChanges(cwd)
	if err != nil {
		t.Fatal(err)
	}
	if !slicesEqual(result, []string{"untracked.txt"}) {
		t.Errorf("got %v, want [untracked.txt]", result)
	}
}

// TS: "returns empty array when no untracked files"
func TestGetUntrackedChanges_ReturnsEmptyWhenNone(t *testing.T) {
	cwd := setupGitDir(t)

	result, err := GetUntrackedChanges(cwd)
	if err != nil {
		t.Fatal(err)
	}
	if len(result) != 0 {
		t.Errorf("got %v, want empty", result)
	}
}

// TS: "respects gitignore patterns"
func TestGetUntrackedChanges_RespectsGitignore(t *testing.T) {
	cwd := setupGitDir(t)

	writeFile(t, cwd, ".gitignore", "*.log\n")
	writeFile(t, cwd, "file.txt", "content")
	writeFile(t, cwd, "error.log", "log content")

	result, err := GetUntrackedChanges(cwd)
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(result)
	expected := []string{".gitignore", "file.txt"}
	if !slicesEqual(result, expected) {
		t.Errorf("got %v, want %v", result, expected)
	}
}

// --- getStagedChanges.test.ts ---

// TS: "returns staged file changes"
func TestGetStagedChanges_ReturnsStagedChanges(t *testing.T) {
	cwd := setupGitDir(t)

	writeFile(t, cwd, "feature.ts", "original")
	mustGit(t, cwd, "add", "feature.ts")
	mustGit(t, cwd, "commit", "-m", "initial")

	// Modify and stage, and add another file
	writeFile(t, cwd, "feature.ts", "modified")
	writeFile(t, cwd, "stuff/new-file.ts", "new content")
	mustGit(t, cwd, "add", "feature.ts", "stuff/new-file.ts")

	result, err := GetStagedChanges(cwd)
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(result)
	expected := []string{"feature.ts", "stuff/new-file.ts"}
	if !slicesEqual(result, expected) {
		t.Errorf("got %v, want %v", result, expected)
	}
}

// TS: "does not include unstaged changes"
func TestGetStagedChanges_DoesNotIncludeUnstaged(t *testing.T) {
	cwd := setupGitDir(t)

	writeFile(t, cwd, "staged.js", "original")
	writeFile(t, cwd, "unstaged.js", "original")
	mustGit(t, cwd, "add", "-A")
	mustGit(t, cwd, "commit", "-m", "initial")

	writeFile(t, cwd, "staged.js", "modified")
	writeFile(t, cwd, "unstaged.js", "modified")
	writeFile(t, cwd, "another-file.js", "new content")

	mustGit(t, cwd, "add", "staged.js")

	result, err := GetStagedChanges(cwd)
	if err != nil {
		t.Fatal(err)
	}
	if !slicesEqual(result, []string{"staged.js"}) {
		t.Errorf("got %v, want [staged.js]", result)
	}
}

// TS: "returns empty array when nothing is staged"
func TestGetStagedChanges_ReturnsEmptyWhenNothingStaged(t *testing.T) {
	cwd := setupGitDir(t)

	writeFile(t, cwd, "file.ts", "content")
	mustGit(t, cwd, "add", "file.ts")
	mustGit(t, cwd, "commit", "-m", "initial")

	writeFile(t, cwd, "file.ts", "modified")
	writeFile(t, cwd, "another-file.ts", "new content")

	result, err := GetStagedChanges(cwd)
	if err != nil {
		t.Fatal(err)
	}
	if len(result) != 0 {
		t.Errorf("got %v, want empty", result)
	}
}

// --- getChangesBetweenRefs.test.ts ---

// TS: "returns changes between ref and HEAD"
func TestGetChangesBetweenRefs_ReturnChanges(t *testing.T) {
	cwd := setupGitDir(t)

	writeFile(t, cwd, "file1.ts", "initial")
	mustGit(t, cwd, "add", "file1.ts")
	mustGit(t, cwd, "commit", "-m", "commit1")
	firstCommit := mustGit(t, cwd, "rev-parse", "HEAD")

	writeFile(t, cwd, "file2.ts", "new file")
	writeFile(t, cwd, "file3.ts", "new file")
	mustGit(t, cwd, "add", "-A")
	mustGit(t, cwd, "commit", "-m", "commit2")

	result, err := GetChangesBetweenRefs(firstCommit, "", "", cwd)
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(result)
	expected := []string{"file2.ts", "file3.ts"}
	if !slicesEqual(result, expected) {
		t.Errorf("got %v, want %v", result, expected)
	}
}

// TS: "supports additional diff options" (adapted for diffFilter param)
func TestGetChangesBetweenRefs_SupportsDiffFilter(t *testing.T) {
	cwd := setupGitDir(t)

	writeFile(t, cwd, "file.ts", "initial")
	mustGit(t, cwd, "add", "file.ts")
	mustGit(t, cwd, "commit", "-m", "commit1")

	// Modify and add a new file
	writeFile(t, cwd, "file.ts", "modified")
	writeFile(t, cwd, "newfile.ts", "new file")
	mustGit(t, cwd, "add", "-A")
	mustGit(t, cwd, "commit", "-m", "commit2")

	// Only modified files
	result, err := GetChangesBetweenRefs("HEAD~1", "M", "", cwd)
	if err != nil {
		t.Fatal(err)
	}
	if !slicesEqual(result, []string{"file.ts"}) {
		t.Errorf("got %v, want [file.ts]", result)
	}
}

// TS: "supports pattern filtering"
func TestGetChangesBetweenRefs_SupportsPatternFiltering(t *testing.T) {
	cwd := setupGitDir(t)

	writeFile(t, cwd, "file.ts", "initial")
	mustGit(t, cwd, "add", "file.ts")
	mustGit(t, cwd, "commit", "-m", "commit1")

	writeFile(t, cwd, "code.ts", "code")
	writeFile(t, cwd, "readme.md", "docs")
	mustGit(t, cwd, "add", "-A")
	mustGit(t, cwd, "commit", "-m", "commit2")

	result, err := GetChangesBetweenRefs("HEAD~1", "", "*.ts", cwd)
	if err != nil {
		t.Fatal(err)
	}
	if !slicesEqual(result, []string{"code.ts"}) {
		t.Errorf("got %v, want [code.ts]", result)
	}
}

// --- getDefaultRemote.test.ts ---

// TS: "handles no repository field or remotes"
func TestGetDefaultRemote_NoRemotes(t *testing.T) {
	cwd := setupGitDir(t)
	writePackageJSON(t, cwd, nil)

	result := GetDefaultRemote(cwd)
	if result != "origin" {
		t.Errorf("got %q, want %q", result, "origin")
	}
}

// TS: "defaults to upstream remote without repository field"
func TestGetDefaultRemote_PrefersUpstream(t *testing.T) {
	cwd := setupGitDir(t)
	writePackageJSON(t, cwd, nil)

	mustGit(t, cwd, "remote", "add", "first", "https://github.com/kenotron/workspace-tools.git")
	mustGit(t, cwd, "remote", "add", "origin", "https://github.com/ecraig12345/workspace-tools.git")
	mustGit(t, cwd, "remote", "add", "upstream", "https://github.com/microsoft/workspace-tools.git")

	result := GetDefaultRemote(cwd)
	if result != "upstream" {
		t.Errorf("got %q, want %q", result, "upstream")
	}
}

// TS: "defaults to origin remote without repository field or upstream remote"
func TestGetDefaultRemote_PrefersOriginOverOther(t *testing.T) {
	cwd := setupGitDir(t)
	writePackageJSON(t, cwd, nil)

	mustGit(t, cwd, "remote", "add", "first", "https://github.com/kenotron/workspace-tools.git")
	mustGit(t, cwd, "remote", "add", "origin", "https://github.com/microsoft/workspace-tools.git")

	result := GetDefaultRemote(cwd)
	if result != "origin" {
		t.Errorf("got %q, want %q", result, "origin")
	}
}

// TS: "defaults to first remote without repository field, origin, or upstream"
func TestGetDefaultRemote_FallsBackToFirst(t *testing.T) {
	cwd := setupGitDir(t)
	writePackageJSON(t, cwd, nil)

	mustGit(t, cwd, "remote", "add", "first", "https://github.com/kenotron/workspace-tools.git")
	mustGit(t, cwd, "remote", "add", "second", "https://github.com/microsoft/workspace-tools.git")

	result := GetDefaultRemote(cwd)
	if result != "first" {
		t.Errorf("got %q, want %q", result, "first")
	}
}

// TS: "finds remote matching repository string"
func TestGetDefaultRemote_MatchesRepositoryString(t *testing.T) {
	cwd := setupGitDir(t)
	writePackageJSON(t, cwd, map[string]any{
		"repository": "https://github.com/microsoft/workspace-tools.git",
	})

	mustGit(t, cwd, "remote", "add", "first", "https://github.com/kenotron/workspace-tools.git")
	mustGit(t, cwd, "remote", "add", "second", "https://github.com/microsoft/workspace-tools.git")

	result := GetDefaultRemote(cwd)
	if result != "second" {
		t.Errorf("got %q, want %q", result, "second")
	}
}

// TS: "finds remote matching repository object"
func TestGetDefaultRemote_MatchesRepositoryObject(t *testing.T) {
	cwd := setupGitDir(t)
	writePackageJSON(t, cwd, map[string]any{
		"repository": map[string]string{
			"url":  "https://github.com/microsoft/workspace-tools.git",
			"type": "git",
		},
	})

	mustGit(t, cwd, "remote", "add", "first", "https://github.com/kenotron/workspace-tools.git")
	mustGit(t, cwd, "remote", "add", "second", "https://github.com/microsoft/workspace-tools.git")

	result := GetDefaultRemote(cwd)
	if result != "second" {
		t.Errorf("got %q, want %q", result, "second")
	}
}

// TS: "works with SSH remote format"
func TestGetDefaultRemote_SSHRemoteFormat(t *testing.T) {
	cwd := setupGitDir(t)
	writePackageJSON(t, cwd, map[string]any{
		"repository": map[string]string{
			"url":  "https://github.com/microsoft/workspace-tools",
			"type": "git",
		},
	})

	mustGit(t, cwd, "remote", "add", "first", "git@github.com:kenotron/workspace-tools.git")
	mustGit(t, cwd, "remote", "add", "second", "git@github.com:microsoft/workspace-tools.git")

	result := GetDefaultRemote(cwd)
	if result != "second" {
		t.Errorf("got %q, want %q", result, "second")
	}
}

// TS: "works with shorthand repository format"
func TestGetDefaultRemote_ShorthandRepositoryFormat(t *testing.T) {
	cwd := setupGitDir(t)
	writePackageJSON(t, cwd, map[string]any{
		"repository": map[string]string{
			"url":  "github:microsoft/workspace-tools",
			"type": "git",
		},
	})

	mustGit(t, cwd, "remote", "add", "first", "https://github.com/kenotron/workspace-tools.git")
	mustGit(t, cwd, "remote", "add", "second", "https://github.com/microsoft/workspace-tools.git")

	result := GetDefaultRemote(cwd)
	if result != "second" {
		t.Errorf("got %q, want %q", result, "second")
	}
}

// ADO/VSO tests from TS are omitted: ADO/VSO URL parsing not implemented.
// See: "works with VSO repository and mismatched remote format"
// See: "works with ADO repository and mismatched remote format"

// --- getRepositoryName.test.ts ---

// TS: "works with HTTPS URLs"
func TestGetRepositoryName_HTTPS(t *testing.T) {
	result := getRepositoryName("https://github.com/microsoft/workspace-tools")
	if result != "microsoft/workspace-tools" {
		t.Errorf("got %q, want %q", result, "microsoft/workspace-tools")
	}
}

// TS: "works with HTTPS URLs with .git"
func TestGetRepositoryName_HTTPSWithGit(t *testing.T) {
	result := getRepositoryName("https://github.com/microsoft/workspace-tools.git")
	if result != "microsoft/workspace-tools" {
		t.Errorf("got %q, want %q", result, "microsoft/workspace-tools")
	}
}

// TS: "works with SSH URLs"
func TestGetRepositoryName_SSH(t *testing.T) {
	result := getRepositoryName("git@github.com:microsoft/workspace-tools.git")
	if result != "microsoft/workspace-tools" {
		t.Errorf("got %q, want %q", result, "microsoft/workspace-tools")
	}
}

// TS: "works with git:// URLs"
func TestGetRepositoryName_GitProtocol(t *testing.T) {
	result := getRepositoryName("git://github.com/microsoft/workspace-tools")
	if result != "microsoft/workspace-tools" {
		t.Errorf("got %q, want %q", result, "microsoft/workspace-tools")
	}
}

func TestGetRepositoryName_Empty(t *testing.T) {
	if result := getRepositoryName(""); result != "" {
		t.Errorf("got %q, want empty", result)
	}
}

// ADO/VSO tests from TS are omitted: ADO/VSO URL parsing not implemented.
// See getRepositoryName.test.ts "ADO" and "VSO" describe blocks.

// --- helpers ---

func slicesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
