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
