package changefile_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWriteChangeFiles_WritesIndividualChangeFiles(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "write-test", defaultBranch)

	opts := types.DefaultOptions()
	opts.Path = repo.RootPath()
	opts.Branch = defaultRemoteBranch
	opts.Fetch = false

	changes := []types.ChangeFileInfo{
		{
			Type:                types.ChangeTypePatch,
			Comment:             "fix foo",
			PackageName:         "foo",
			Email:               "test@test.com",
			DependentChangeType: types.ChangeTypePatch,
		},
		{
			Type:                types.ChangeTypeMinor,
			Comment:             "add bar feature",
			PackageName:         "bar",
			Email:               "test@test.com",
			DependentChangeType: types.ChangeTypePatch,
		},
	}

	err := changefile.WriteChangeFiles(&opts, changes)
	require.NoError(t, err)

	files := testutil.GetChangeFiles(&opts)
	require.Len(t, files, 2)

	// Verify file contents
	foundFoo := false
	foundBar := false
	for _, f := range files {
		data, err := os.ReadFile(f)
		require.NoError(t, err, "failed to read %s", f)
		var change types.ChangeFileInfo
		require.NoError(t, json.Unmarshal(data, &change), "failed to parse %s", f)
		switch change.PackageName {
		case "foo":
			foundFoo = true
			assert.Equal(t, types.ChangeTypePatch, change.Type)
			assert.Equal(t, "fix foo", change.Comment)
		case "bar":
			foundBar = true
			assert.Equal(t, types.ChangeTypeMinor, change.Type)
			assert.Equal(t, "add bar feature", change.Comment)
		default:
			t.Fatalf("unexpected package: %s", change.PackageName)
		}
	}
	assert.True(t, foundFoo, "expected foo change file")
	assert.True(t, foundBar, "expected bar change file")

	// Verify files are committed (default Commit=true)
	status := repo.Status()
	assert.Empty(t, status, "expected clean working tree after commit")
}

func TestWriteChangeFiles_RespectsChangeDirOption(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "custom-dir-test", defaultBranch)

	opts := types.DefaultOptions()
	opts.Path = repo.RootPath()
	opts.Branch = defaultRemoteBranch
	opts.Fetch = false
	opts.ChangeDir = "my-changes"

	changes := []types.ChangeFileInfo{
		{
			Type:                types.ChangeTypePatch,
			Comment:             "test change",
			PackageName:         "foo",
			Email:               "test@test.com",
			DependentChangeType: types.ChangeTypePatch,
		},
	}

	err := changefile.WriteChangeFiles(&opts, changes)
	require.NoError(t, err)

	// Verify the custom directory was used
	customPath := filepath.Join(repo.RootPath(), "my-changes")
	entries, err := os.ReadDir(customPath)
	require.NoError(t, err, "failed to read custom change dir")
	jsonCount := 0
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".json" {
			jsonCount++
		}
	}
	assert.Equal(t, 1, jsonCount)

	// Default change dir should not exist
	defaultPath := filepath.Join(repo.RootPath(), "change")
	_, err = os.Stat(defaultPath)
	assert.True(t, os.IsNotExist(err), "expected default change dir to not exist")
}

func TestWriteChangeFiles_RespectsCommitFalse(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "no-commit-test", defaultBranch)

	// Get the current HEAD hash before writing
	headBefore := repo.Git([]string{"rev-parse", "HEAD"})

	opts := types.DefaultOptions()
	opts.Path = repo.RootPath()
	opts.Branch = defaultRemoteBranch
	opts.Fetch = false
	opts.Commit = false

	changes := []types.ChangeFileInfo{
		{
			Type:                types.ChangeTypePatch,
			Comment:             "uncommitted change",
			PackageName:         "foo",
			Email:               "test@test.com",
			DependentChangeType: types.ChangeTypePatch,
		},
	}

	err := changefile.WriteChangeFiles(&opts, changes)
	require.NoError(t, err)

	// Verify files exist
	files := testutil.GetChangeFiles(&opts)
	assert.Len(t, files, 1)

	// Verify HEAD hash is unchanged (no commit was made)
	headAfter := repo.Git([]string{"rev-parse", "HEAD"})
	assert.Equal(t, headBefore, headAfter, "expected HEAD to be unchanged")
}
