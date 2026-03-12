package testutil

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/microsoft/beachball/internal/git"
)

// RepositoryFactory creates test git repositories.
type RepositoryFactory struct {
	t            *testing.T
	bareDir      string
	fixtureType  string
	customRoot   map[string]any
	customGroups map[string]map[string]map[string]any
}

// NewRepositoryFactory creates a factory for the given fixture type.
func NewRepositoryFactory(t *testing.T, fixtureType string) *RepositoryFactory {
	t.Helper()

	bareDir, err := os.MkdirTemp("", "beachball-bare-*")
	if err != nil {
		t.Fatalf("failed to create bare dir: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(bareDir) })

	f := &RepositoryFactory{
		t:           t,
		bareDir:     bareDir,
		fixtureType: fixtureType,
	}

	f.initBareRepo()
	return f
}

// NewCustomRepositoryFactory creates a factory with custom package definitions.
func NewCustomRepositoryFactory(t *testing.T, rootPkg map[string]any, groups map[string]map[string]map[string]any) *RepositoryFactory {
	t.Helper()

	bareDir, err := os.MkdirTemp("", "beachball-bare-*")
	if err != nil {
		t.Fatalf("failed to create bare dir: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(bareDir) })

	f := &RepositoryFactory{
		t:            t,
		bareDir:      bareDir,
		fixtureType:  "custom",
		customRoot:   rootPkg,
		customGroups: groups,
	}

	f.initBareRepo()
	return f
}

func (f *RepositoryFactory) initBareRepo() {
	// Initialize bare repo with master as default branch
	git.Git([]string{"init", "--bare", "--initial-branch=master", f.bareDir}, f.bareDir)

	// Create a temporary clone to add initial content
	tmpDir, err := os.MkdirTemp("", "beachball-init-*")
	if err != nil {
		f.t.Fatalf("failed to create init dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	cloneDir := filepath.Join(tmpDir, "repo")
	git.Git([]string{"clone", f.bareDir, cloneDir}, tmpDir)

	// Configure git for commits
	git.Git([]string{"config", "user.email", "test@test.com"}, cloneDir)
	git.Git([]string{"config", "user.name", "Test"}, cloneDir)

	// Set up fixtures
	switch f.fixtureType {
	case "single":
		SetupSinglePackage(cloneDir)
	case "monorepo":
		SetupMonorepo(cloneDir)
	case "multi-project":
		SetupMultiProject(cloneDir)
	case "custom":
		SetupCustomMonorepo(cloneDir, f.customRoot, f.customGroups)
	}

	// Commit and push
	git.Git([]string{"add", "-A"}, cloneDir)
	git.Git([]string{"commit", "-m", "Initial commit"}, cloneDir)
	git.Git([]string{"push", "origin", "HEAD"}, cloneDir)
}

// CloneRepository creates a new clone of the bare repo.
func (f *RepositoryFactory) CloneRepository() *Repository {
	cloneDir, err := os.MkdirTemp("", "beachball-clone-*")
	if err != nil {
		f.t.Fatalf("failed to create clone dir: %v", err)
	}
	f.t.Cleanup(func() { os.RemoveAll(cloneDir) })

	repoDir := filepath.Join(cloneDir, "repo")
	git.Git([]string{"clone", f.bareDir, repoDir}, cloneDir)
	git.Git([]string{"config", "user.email", "test@test.com"}, repoDir)
	git.Git([]string{"config", "user.name", "Test"}, repoDir)

	return NewRepository(f.t, repoDir)
}
