package testutil

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/microsoft/beachball/internal/git"
)

// Repository is a test helper for a cloned git repo.
type Repository struct {
	t       *testing.T
	rootDir string
}

// NewRepository creates a Repository wrapper for a directory.
func NewRepository(t *testing.T, dir string) *Repository {
	return &Repository{t: t, rootDir: dir}
}

// RootPath returns the root directory of the repository.
func (r *Repository) RootPath() string {
	return r.rootDir
}

// PathTo returns an absolute path relative to the repo root.
func (r *Repository) PathTo(parts ...string) string {
	return filepath.Join(append([]string{r.rootDir}, parts...)...)
}

// Git runs a git command in the repository.
func (r *Repository) Git(args []string) string {
	result, err := git.Git(args, r.rootDir)
	if err != nil {
		r.t.Fatalf("git %v failed: %v", args, err)
	}
	if !result.Success {
		r.t.Fatalf("git %v failed (exit %d): %s", args, result.ExitCode, result.Stderr)
	}
	return result.Stdout
}

// Checkout runs git checkout.
func (r *Repository) Checkout(args ...string) {
	r.Git(append([]string{"checkout"}, args...))
}

// WriteFile creates a file at the given path (relative to repo root).
func (r *Repository) WriteFile(relPath string) {
	r.WriteFileContent(relPath, "test content")
}

// WriteFileContent creates a file with specific content.
func (r *Repository) WriteFileContent(relPath, content string) {
	fullPath := filepath.Join(r.rootDir, relPath)
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		r.t.Fatalf("failed to create dir %s: %v", dir, err)
	}
	if err := os.WriteFile(fullPath, []byte(content), 0o644); err != nil {
		r.t.Fatalf("failed to write file %s: %v", fullPath, err)
	}
}

// StageChange creates and stages a file.
func (r *Repository) StageChange(relPath string) {
	r.WriteFile(relPath)
	r.Git([]string{"add", relPath})
}

// CommitChange creates, stages, and commits a file.
func (r *Repository) CommitChange(relPath string) {
	r.StageChange(relPath)
	r.Git([]string{"commit", "-m", "Commit " + relPath})
}

// Push pushes to origin.
func (r *Repository) Push() {
	r.Git([]string{"push", "origin", "HEAD"})
}

// Status returns git status.
func (r *Repository) Status() string {
	return r.Git([]string{"status", "--short"})
}
