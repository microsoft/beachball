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

// TS: "writes individual change files"
func TestWriteChangeFiles_WritesIndividualChangeFiles(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "write-test", testutil.DefaultBranch)

	opts := types.DefaultOptions()
	opts.Path = repo.RootPath()
	opts.Branch = testutil.DefaultRemoteBranch
	opts.Fetch = false

	changes := []types.ChangeFileInfo{
		testutil.GetChange("foo", "fix foo", types.ChangeTypePatch),
		testutil.GetChange("bar", "add bar feature", types.ChangeTypeMinor),
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

// TS: "respects changeDir option"
func TestWriteChangeFiles_RespectsChangeDirOption(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "custom-dir-test", testutil.DefaultBranch)

	opts := types.DefaultOptions()
	opts.Path = repo.RootPath()
	opts.Branch = testutil.DefaultRemoteBranch
	opts.Fetch = false
	opts.ChangeDir = "my-changes"

	changes := []types.ChangeFileInfo{
		testutil.GetChange("foo", "test change", types.ChangeTypePatch),
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

// TS: "respects commit=false"
func TestWriteChangeFiles_RespectsCommitFalse(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "no-commit-test", testutil.DefaultBranch)

	// Get the current HEAD hash before writing
	headBefore := repo.Git([]string{"rev-parse", "HEAD"})

	opts := types.DefaultOptions()
	opts.Path = repo.RootPath()
	opts.Branch = testutil.DefaultRemoteBranch
	opts.Fetch = false
	opts.Commit = false

	changes := []types.ChangeFileInfo{
		testutil.GetChange("foo", "uncommitted change", types.ChangeTypePatch),
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

// TS: "writes grouped change files"
func TestWriteChangeFiles_WritesGroupedChangeFiles(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "grouped-write-test", testutil.DefaultBranch)

	opts := types.DefaultOptions()
	opts.Path = repo.RootPath()
	opts.Branch = testutil.DefaultRemoteBranch
	opts.Fetch = false
	opts.GroupChanges = true

	changes := []types.ChangeFileInfo{
		testutil.GetChange("foo", "fix foo", types.ChangeTypePatch),
		testutil.GetChange("bar", "add bar feature", types.ChangeTypeMinor),
	}

	err := changefile.WriteChangeFiles(&opts, changes)
	require.NoError(t, err)

	// Should be a single grouped file
	files := testutil.GetChangeFiles(&opts)
	require.Len(t, files, 1)

	// Verify it's a grouped format
	data, err := os.ReadFile(files[0])
	require.NoError(t, err)
	var grouped types.ChangeInfoMultiple
	require.NoError(t, json.Unmarshal(data, &grouped))

	assert.Len(t, grouped.Changes, 2)
	packageNames := map[string]bool{}
	for _, change := range grouped.Changes {
		packageNames[change.PackageName] = true
	}
	assert.True(t, packageNames["foo"], "expected foo")
	assert.True(t, packageNames["bar"], "expected bar")

	// Verify committed
	status := repo.Status()
	assert.Empty(t, status, "expected clean working tree after commit")
}
