package validation_test

import (
	"testing"

	"github.com/microsoft/beachball/internal/options"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
	"github.com/microsoft/beachball/internal/validation"
)

const defaultBranch = "master"
const defaultRemoteBranch = "origin/master"

func TestSucceedsWithNoChanges(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test", defaultBranch)

	repoOpts := types.DefaultOptions()
	repoOpts.Branch = defaultRemoteBranch
	repoOpts.Fetch = false

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), types.CliOptions{}, repoOpts)
	result, err := validation.Validate(parsed, validation.ValidateOptions{
		CheckChangeNeeded: true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.IsChangeNeeded {
		t.Fatal("expected no change needed")
	}
}

func TestExitsWithErrorIfChangeFilesNeeded(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test", defaultBranch)
	repo.CommitChange("packages/foo/test.js")

	repoOpts := types.DefaultOptions()
	repoOpts.Branch = defaultRemoteBranch
	repoOpts.Fetch = false

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), types.CliOptions{}, repoOpts)
	_, err := validation.Validate(parsed, validation.ValidateOptions{
		CheckChangeNeeded: true,
	})
	if err == nil {
		t.Fatal("expected error but got nil")
	}
}

func TestReturnsWithoutErrorIfAllowMissingChangeFiles(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test", defaultBranch)
	repo.CommitChange("packages/foo/test.js")

	repoOpts := types.DefaultOptions()
	repoOpts.Branch = defaultRemoteBranch
	repoOpts.Fetch = false

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), types.CliOptions{}, repoOpts)
	result, err := validation.Validate(parsed, validation.ValidateOptions{
		CheckChangeNeeded:       true,
		AllowMissingChangeFiles: true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.IsChangeNeeded {
		t.Fatal("expected change needed")
	}
}
