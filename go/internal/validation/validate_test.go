package validation_test

import (
	"testing"

	"github.com/microsoft/beachball/internal/options"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
	"github.com/microsoft/beachball/internal/validation"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// get default options for this file (fetch disabled)
func getDefaultOptions() types.BeachballOptions {
	defaultOptions := types.DefaultOptions()
	defaultOptions.Branch = testutil.DefaultRemoteBranch
	defaultOptions.Fetch = false

	return defaultOptions
}

// TS: "succeeds with no changes"
func TestSucceedsWithNoChanges(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test", testutil.DefaultBranch)

	buf := testutil.CaptureLogging(t)
	repoOpts := getDefaultOptions()

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), types.CliOptions{}, repoOpts)
	result, err := validation.Validate(parsed, validation.ValidateOptions{
		CheckChangeNeeded: true,
	})
	require.NoError(t, err)
	assert.False(t, result.IsChangeNeeded)
	assert.Contains(t, buf.String(), "Validating options and change files...")
}

// TS: "exits with error by default if change files are needed"
func TestExitsWithErrorIfChangeFilesNeeded(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test", testutil.DefaultBranch)
	repo.CommitChange("packages/foo/test.js")

	buf := testutil.CaptureLogging(t)
	repoOpts := getDefaultOptions()

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), types.CliOptions{}, repoOpts)
	_, err := validation.Validate(parsed, validation.ValidateOptions{
		CheckChangeNeeded: true,
	})
	assert.Error(t, err)
	assert.Contains(t, buf.String(), "ERROR: Change files are needed!")
	assert.Contains(t, buf.String(), "Found changes in the following packages")
}

// TS: "returns and does not log an error if change files are needed and allowMissingChangeFiles is true"
func TestReturnsWithoutErrorIfAllowMissingChangeFiles(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test", testutil.DefaultBranch)
	repo.CommitChange("packages/foo/test.js")

	buf := testutil.CaptureLogging(t)
	repoOpts := getDefaultOptions()

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), types.CliOptions{}, repoOpts)
	result, err := validation.Validate(parsed, validation.ValidateOptions{
		CheckChangeNeeded:       true,
		AllowMissingChangeFiles: true,
	})
	require.NoError(t, err)
	assert.True(t, result.IsChangeNeeded)
	assert.NotContains(t, buf.String(), "ERROR:")
}
