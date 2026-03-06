package changefile_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
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
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	files := testutil.GetChangeFiles(&opts)
	if len(files) != 2 {
		t.Fatalf("expected 2 change files, got %d", len(files))
	}

	// Verify file contents
	foundFoo := false
	foundBar := false
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			t.Fatalf("failed to read %s: %v", f, err)
		}
		var change types.ChangeFileInfo
		if err := json.Unmarshal(data, &change); err != nil {
			t.Fatalf("failed to parse %s: %v", f, err)
		}
		switch change.PackageName {
		case "foo":
			foundFoo = true
			if change.Type != types.ChangeTypePatch {
				t.Fatalf("expected patch for foo, got %s", change.Type)
			}
			if change.Comment != "fix foo" {
				t.Fatalf("expected 'fix foo', got %q", change.Comment)
			}
		case "bar":
			foundBar = true
			if change.Type != types.ChangeTypeMinor {
				t.Fatalf("expected minor for bar, got %s", change.Type)
			}
			if change.Comment != "add bar feature" {
				t.Fatalf("expected 'add bar feature', got %q", change.Comment)
			}
		default:
			t.Fatalf("unexpected package: %s", change.PackageName)
		}
	}
	if !foundFoo || !foundBar {
		t.Fatalf("expected both foo and bar change files, foundFoo=%v foundBar=%v", foundFoo, foundBar)
	}

	// Verify files are committed (default Commit=true)
	status := repo.Status()
	if status != "" {
		t.Fatalf("expected clean working tree after commit, got: %s", status)
	}
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
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify the custom directory was used
	customPath := filepath.Join(repo.RootPath(), "my-changes")
	entries, err := os.ReadDir(customPath)
	if err != nil {
		t.Fatalf("failed to read custom change dir: %v", err)
	}
	jsonCount := 0
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".json" {
			jsonCount++
		}
	}
	if jsonCount != 1 {
		t.Fatalf("expected 1 json file in my-changes, got %d", jsonCount)
	}

	// Default change dir should not exist
	defaultPath := filepath.Join(repo.RootPath(), "change")
	if _, err := os.Stat(defaultPath); err == nil {
		t.Fatal("expected default change dir to not exist")
	}
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
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify files exist
	files := testutil.GetChangeFiles(&opts)
	if len(files) != 1 {
		t.Fatalf("expected 1 change file, got %d", len(files))
	}

	// Verify HEAD hash is unchanged (no commit was made)
	headAfter := repo.Git([]string{"rev-parse", "HEAD"})
	if headBefore != headAfter {
		t.Fatalf("expected HEAD to be unchanged, before=%s after=%s", headBefore, headAfter)
	}
}
