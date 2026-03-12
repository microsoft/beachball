package commands_test

import (
	"strings"
	"testing"

	"github.com/microsoft/beachball/internal/commands"
	"github.com/microsoft/beachball/internal/jsonutil"
	"github.com/microsoft/beachball/internal/options"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
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

// TS: "does not create change files when there are no changes"
func TestDoesNotCreateChangeFilesWhenNoChanges(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "no-changes-test", testutil.DefaultBranch)

	buf := testutil.CaptureLogging(t)
	repoOpts := getDefaultOptions()

	cli := types.CliOptions{
		Command:    "change",
		Message:    "test change",
		ChangeType: "patch",
	}

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), cli, repoOpts)
	err := commands.Change(parsed)
	require.NoError(t, err)

	files := testutil.GetChangeFiles(&parsed.Options)
	assert.Empty(t, files)
	assert.Contains(t, buf.String(), "No change files are needed")
}

// TS: "creates and commits a change file" (non-interactive equivalent)
func TestCreatesChangeFileWithTypeAndMessage(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "creates-change-test", testutil.DefaultBranch)
	repo.CommitChange("file.js")

	repoOpts := getDefaultOptions()
	repoOpts.Commit = false

	commitFalse := false
	cli := types.CliOptions{
		Command:    "change",
		Message:    "test description",
		ChangeType: "patch",
		Commit:     &commitFalse,
	}

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), cli, repoOpts)
	err := commands.Change(parsed)
	require.NoError(t, err)

	files := testutil.GetChangeFiles(&parsed.Options)
	require.Len(t, files, 1)

	change, err := jsonutil.ReadJSON[types.ChangeFileInfo](files[0])
	require.NoError(t, err)

	assert.Equal(t, types.ChangeTypePatch, change.Type)
	assert.Equal(t, "test description", change.Comment)
	assert.Equal(t, "foo", change.PackageName)
	assert.Equal(t, types.ChangeTypePatch, change.DependentChangeType)
}

// TS: "creates and stages a change file"
func TestCreatesAndStagesChangeFile(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "stages-change-test", testutil.DefaultBranch)
	repo.CommitChange("file.js")

	buf := testutil.CaptureLogging(t)
	repoOpts := getDefaultOptions()
	repoOpts.Commit = false

	commitFalse := false
	cli := types.CliOptions{
		Command:    "change",
		Message:    "stage me please",
		ChangeType: "patch",
		Commit:     &commitFalse,
	}

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), cli, repoOpts)
	err := commands.Change(parsed)
	require.NoError(t, err)

	// Verify file is staged (git status shows "A ")
	status := repo.Status()
	assert.Contains(t, status, "A ")

	files := testutil.GetChangeFiles(&parsed.Options)
	require.Len(t, files, 1)

	change, _ := jsonutil.ReadJSON[types.ChangeFileInfo](files[0])
	assert.Equal(t, "stage me please", change.Comment)
	assert.Equal(t, "foo", change.PackageName)
	assert.Contains(t, buf.String(), "git staged these change files:")
}

// TS: "creates and commits a change file"
func TestCreatesAndCommitsChangeFile(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "commits-change-test", testutil.DefaultBranch)
	repo.CommitChange("file.js")

	buf := testutil.CaptureLogging(t)
	repoOpts := getDefaultOptions()

	cli := types.CliOptions{
		Command:    "change",
		Message:    "commit me please",
		ChangeType: "patch",
	}

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), cli, repoOpts)
	err := commands.Change(parsed)
	require.NoError(t, err)

	// Verify clean git status (committed)
	status := repo.Status()
	assert.Empty(t, status)

	files := testutil.GetChangeFiles(&parsed.Options)
	require.Len(t, files, 1)

	change, _ := jsonutil.ReadJSON[types.ChangeFileInfo](files[0])
	assert.Equal(t, "commit me please", change.Comment)
	assert.Contains(t, buf.String(), "git committed these change files:")
}

// TS: "creates and commits a change file with changeDir set"
func TestCreatesAndCommitsChangeFileWithChangeDir(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "changedir-test", testutil.DefaultBranch)
	repo.CommitChange("file.js")

	buf := testutil.CaptureLogging(t)
	repoOpts := getDefaultOptions()
	repoOpts.ChangeDir = "changeDir"

	cli := types.CliOptions{
		Command:    "change",
		Message:    "commit me please",
		ChangeType: "patch",
	}

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), cli, repoOpts)
	err := commands.Change(parsed)
	require.NoError(t, err)

	status := repo.Status()
	assert.Empty(t, status)

	files := testutil.GetChangeFiles(&parsed.Options)
	require.Len(t, files, 1)

	// Verify file is in custom directory
	assert.True(t, strings.Contains(files[0], "changeDir"), "expected file in changeDir, got: %s", files[0])

	change, _ := jsonutil.ReadJSON[types.ChangeFileInfo](files[0])
	assert.Equal(t, "commit me please", change.Comment)
	assert.Contains(t, buf.String(), "git committed these change files:")
}

// TS: "creates a change file when there are no changes but package name is provided"
func TestCreatesChangeFileWhenNoChangesButPackageProvided(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "package-flag-test", testutil.DefaultBranch)

	buf := testutil.CaptureLogging(t)
	repoOpts := getDefaultOptions()
	repoOpts.Commit = false

	commitFalse := false
	cli := types.CliOptions{
		Command:    "change",
		Message:    "forced change",
		ChangeType: "patch",
		Package:    []string{"foo"},
		Commit:     &commitFalse,
	}

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), cli, repoOpts)
	err := commands.Change(parsed)
	require.NoError(t, err)

	files := testutil.GetChangeFiles(&parsed.Options)
	require.Len(t, files, 1)

	change, _ := jsonutil.ReadJSON[types.ChangeFileInfo](files[0])
	assert.Equal(t, "foo", change.PackageName)
	assert.Contains(t, buf.String(), "git staged these change files:")
}

// TS: "creates and commits change files for multiple packages"
func TestCreatesAndCommitsChangeFilesForMultiplePackages(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "multi-pkg-test", testutil.DefaultBranch)
	repo.CommitChange("packages/foo/file.js")
	repo.CommitChange("packages/bar/file.js")

	buf := testutil.CaptureLogging(t)
	repoOpts := getDefaultOptions()

	cli := types.CliOptions{
		Command:    "change",
		Message:    "multi-package change",
		ChangeType: "minor",
	}

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), cli, repoOpts)
	err := commands.Change(parsed)
	require.NoError(t, err)

	status := repo.Status()
	assert.Empty(t, status)

	files := testutil.GetChangeFiles(&parsed.Options)
	require.Len(t, files, 2)

	packageNames := map[string]bool{}
	for _, f := range files {
		change, _ := jsonutil.ReadJSON[types.ChangeFileInfo](f)
		packageNames[change.PackageName] = true
		assert.Equal(t, types.ChangeTypeMinor, change.Type)
		assert.Equal(t, "multi-package change", change.Comment)
	}

	assert.True(t, packageNames["foo"], "expected foo")
	assert.True(t, packageNames["bar"], "expected bar")
	assert.Contains(t, buf.String(), "git committed these change files:")
}

// TS: "creates and commits grouped change file for multiple packages"
func TestCreatesAndCommitsGroupedChangeFile(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "grouped-test", testutil.DefaultBranch)
	repo.CommitChange("packages/foo/file.js")
	repo.CommitChange("packages/bar/file.js")

	buf := testutil.CaptureLogging(t)
	repoOpts := getDefaultOptions()
	repoOpts.GroupChanges = true

	cli := types.CliOptions{
		Command:    "change",
		Message:    "grouped change",
		ChangeType: "minor",
	}

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), cli, repoOpts)
	err := commands.Change(parsed)
	require.NoError(t, err)

	status := repo.Status()
	assert.Empty(t, status)

	files := testutil.GetChangeFiles(&parsed.Options)
	require.Len(t, files, 1)

	grouped, err := jsonutil.ReadJSON[types.ChangeInfoMultiple](files[0])
	require.NoError(t, err)

	assert.Len(t, grouped.Changes, 2)

	packageNames := map[string]bool{}
	for _, change := range grouped.Changes {
		packageNames[change.PackageName] = true
		assert.Equal(t, types.ChangeTypeMinor, change.Type)
		assert.Equal(t, "grouped change", change.Comment)
	}

	assert.True(t, packageNames["foo"], "expected foo")
	assert.True(t, packageNames["bar"], "expected bar")
	assert.Contains(t, buf.String(), "git committed these change files:")
}
