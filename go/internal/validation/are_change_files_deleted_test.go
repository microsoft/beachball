package validation_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
	"github.com/microsoft/beachball/internal/validation"
	"github.com/stretchr/testify/assert"
)

// get default options with a specified root path (fetch disabled)
func getDefaultOptionsWithPath(rootPath string) types.BeachballOptions {
	defaultOptions := types.DefaultOptions()
	defaultOptions.Branch = testutil.DefaultRemoteBranch
	defaultOptions.Fetch = false
	defaultOptions.Path = rootPath

	return defaultOptions
}

func TestAreChangeFilesDeleted_FalseWhenNoChangeFilesDeleted(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	// Create a change file on master and push it
	opts := getDefaultOptionsWithPath(repo.RootPath())

	testutil.GenerateChangeFiles(t, []string{"foo"}, &opts, repo)
	repo.Push()

	// Checkout a new branch — no deletions
	repo.Checkout("-b", "test-no-delete", testutil.DefaultBranch)

	result := validation.AreChangeFilesDeleted(&opts)
	assert.False(t, result)
}

func TestAreChangeFilesDeleted_TrueWhenChangeFilesDeleted(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	// Create a change file on master and push it
	opts := getDefaultOptionsWithPath(repo.RootPath())

	testutil.GenerateChangeFiles(t, []string{"foo"}, &opts, repo)
	repo.Push()

	// Checkout a new branch and delete the change files using git rm
	repo.Checkout("-b", "test-delete", testutil.DefaultBranch)

	changePath := filepath.Join(repo.RootPath(), opts.ChangeDir)
	repo.Git([]string{"rm", "-r", changePath})
	repo.Git([]string{"commit", "-m", "Delete change files"})

	// Recreate the directory so git can run from it
	os.MkdirAll(changePath, 0o755)

	result := validation.AreChangeFilesDeleted(&opts)
	assert.True(t, result)
}

func TestAreChangeFilesDeleted_WorksWithCustomChangeDir(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	opts := getDefaultOptionsWithPath(repo.RootPath())
	opts.ChangeDir = "custom-changes"

	testutil.GenerateChangeFiles(t, []string{"foo"}, &opts, repo)
	repo.Push()

	repo.Checkout("-b", "test-custom-delete", testutil.DefaultBranch)

	changePath := filepath.Join(repo.RootPath(), opts.ChangeDir)
	repo.Git([]string{"rm", "-r", changePath})
	repo.Git([]string{"commit", "-m", "Delete custom change files"})

	// Recreate the directory so git can run from it
	os.MkdirAll(changePath, 0o755)

	result := validation.AreChangeFilesDeleted(&opts)
	assert.True(t, result)
}
