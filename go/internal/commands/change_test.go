package commands_test

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/microsoft/beachball/internal/commands"
	"github.com/microsoft/beachball/internal/options"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const defaultBranch = "master"
const defaultRemoteBranch = "origin/master"

func TestDoesNotCreateChangeFilesWhenNoChanges(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "no-changes-test", defaultBranch)

	repoOpts := types.DefaultOptions()
	repoOpts.Branch = defaultRemoteBranch
	repoOpts.Fetch = false

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
}

func TestCreatesChangeFileWithTypeAndMessage(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "creates-change-test", defaultBranch)
	repo.CommitChange("file.js")

	repoOpts := types.DefaultOptions()
	repoOpts.Branch = defaultRemoteBranch
	repoOpts.Fetch = false
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

	data, err := os.ReadFile(files[0])
	require.NoError(t, err)

	var change types.ChangeFileInfo
	require.NoError(t, json.Unmarshal(data, &change))

	assert.Equal(t, types.ChangeTypePatch, change.Type)
	assert.Equal(t, "test description", change.Comment)
	assert.Equal(t, "foo", change.PackageName)
	assert.Equal(t, types.ChangeTypePatch, change.DependentChangeType)
}

func TestCreatesAndStagesChangeFile(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "stages-change-test", defaultBranch)
	repo.CommitChange("file.js")

	repoOpts := types.DefaultOptions()
	repoOpts.Branch = defaultRemoteBranch
	repoOpts.Fetch = false
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

	data, _ := os.ReadFile(files[0])
	var change types.ChangeFileInfo
	json.Unmarshal(data, &change)
	assert.Equal(t, "stage me please", change.Comment)
	assert.Equal(t, "foo", change.PackageName)
}

func TestCreatesAndCommitsChangeFile(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "commits-change-test", defaultBranch)
	repo.CommitChange("file.js")

	repoOpts := types.DefaultOptions()
	repoOpts.Branch = defaultRemoteBranch
	repoOpts.Fetch = false

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

	data, _ := os.ReadFile(files[0])
	var change types.ChangeFileInfo
	json.Unmarshal(data, &change)
	assert.Equal(t, "commit me please", change.Comment)
}

func TestCreatesAndCommitsChangeFileWithChangeDir(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "changedir-test", defaultBranch)
	repo.CommitChange("file.js")

	repoOpts := types.DefaultOptions()
	repoOpts.Branch = defaultRemoteBranch
	repoOpts.Fetch = false
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

	data, _ := os.ReadFile(files[0])
	var change types.ChangeFileInfo
	json.Unmarshal(data, &change)
	assert.Equal(t, "commit me please", change.Comment)
}

func TestCreatesChangeFileWhenNoChangesButPackageProvided(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "package-flag-test", defaultBranch)

	repoOpts := types.DefaultOptions()
	repoOpts.Branch = defaultRemoteBranch
	repoOpts.Fetch = false
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

	data, _ := os.ReadFile(files[0])
	var change types.ChangeFileInfo
	json.Unmarshal(data, &change)
	assert.Equal(t, "foo", change.PackageName)
}

func TestCreatesAndCommitsChangeFilesForMultiplePackages(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "multi-pkg-test", defaultBranch)
	repo.CommitChange("packages/foo/file.js")
	repo.CommitChange("packages/bar/file.js")

	repoOpts := types.DefaultOptions()
	repoOpts.Branch = defaultRemoteBranch
	repoOpts.Fetch = false

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
		data, _ := os.ReadFile(f)
		var change types.ChangeFileInfo
		json.Unmarshal(data, &change)
		packageNames[change.PackageName] = true
		assert.Equal(t, types.ChangeTypeMinor, change.Type)
		assert.Equal(t, "multi-package change", change.Comment)
	}

	assert.True(t, packageNames["foo"], "expected foo")
	assert.True(t, packageNames["bar"], "expected bar")
}

func TestCreatesAndCommitsGroupedChangeFile(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "grouped-test", defaultBranch)
	repo.CommitChange("packages/foo/file.js")
	repo.CommitChange("packages/bar/file.js")

	repoOpts := types.DefaultOptions()
	repoOpts.Branch = defaultRemoteBranch
	repoOpts.Fetch = false
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

	data, _ := os.ReadFile(files[0])
	var grouped types.ChangeInfoMultiple
	require.NoError(t, json.Unmarshal(data, &grouped))

	assert.Len(t, grouped.Changes, 2)

	packageNames := map[string]bool{}
	for _, change := range grouped.Changes {
		packageNames[change.PackageName] = true
		assert.Equal(t, types.ChangeTypeMinor, change.Type)
		assert.Equal(t, "grouped change", change.Comment)
	}

	assert.True(t, packageNames["foo"], "expected foo")
	assert.True(t, packageNames["bar"], "expected bar")
}
