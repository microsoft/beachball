package validation_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
	"github.com/microsoft/beachball/internal/validation"
)

func TestAreChangeFilesDeleted_FalseWhenNoChangeFilesDeleted(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	// Create a change file on master and push it
	opts := types.DefaultOptions()
	opts.Path = repo.RootPath()
	opts.Branch = defaultRemoteBranch
	opts.Fetch = false

	testutil.GenerateChangeFiles(t, []string{"foo"}, &opts, repo)
	repo.Push()

	// Checkout a new branch — no deletions
	repo.Checkout("-b", "test-no-delete", defaultBranch)

	result := validation.AreChangeFilesDeleted(&opts)
	if result {
		t.Fatal("expected false when no change files are deleted")
	}
}

func TestAreChangeFilesDeleted_TrueWhenChangeFilesDeleted(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	// Create a change file on master and push it
	opts := types.DefaultOptions()
	opts.Path = repo.RootPath()
	opts.Branch = defaultRemoteBranch
	opts.Fetch = false

	testutil.GenerateChangeFiles(t, []string{"foo"}, &opts, repo)
	repo.Push()

	// Checkout a new branch and delete the change files using git rm
	repo.Checkout("-b", "test-delete", defaultBranch)

	changePath := filepath.Join(repo.RootPath(), opts.ChangeDir)
	repo.Git([]string{"rm", "-r", changePath})
	repo.Git([]string{"commit", "-m", "Delete change files"})

	// Recreate the directory so git can run from it
	os.MkdirAll(changePath, 0o755)

	result := validation.AreChangeFilesDeleted(&opts)
	if !result {
		t.Fatal("expected true when change files are deleted")
	}
}

func TestAreChangeFilesDeleted_WorksWithCustomChangeDir(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	opts := types.DefaultOptions()
	opts.Path = repo.RootPath()
	opts.Branch = defaultRemoteBranch
	opts.Fetch = false
	opts.ChangeDir = "custom-changes"

	testutil.GenerateChangeFiles(t, []string{"foo"}, &opts, repo)
	repo.Push()

	repo.Checkout("-b", "test-custom-delete", defaultBranch)

	changePath := filepath.Join(repo.RootPath(), opts.ChangeDir)
	repo.Git([]string{"rm", "-r", changePath})
	repo.Git([]string{"commit", "-m", "Delete custom change files"})

	// Recreate the directory so git can run from it
	os.MkdirAll(changePath, 0o755)

	result := validation.AreChangeFilesDeleted(&opts)
	if !result {
		t.Fatal("expected true when custom change files are deleted")
	}
}
