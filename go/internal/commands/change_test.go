package commands_test

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/microsoft/beachball/internal/commands"
	"github.com/microsoft/beachball/internal/options"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
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
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	files := testutil.GetChangeFiles(&parsed.Options)
	if len(files) != 0 {
		t.Fatalf("expected no change files, got %d", len(files))
	}
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
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	files := testutil.GetChangeFiles(&parsed.Options)
	if len(files) != 1 {
		t.Fatalf("expected 1 change file, got %d", len(files))
	}

	data, err := os.ReadFile(files[0])
	if err != nil {
		t.Fatalf("failed to read change file: %v", err)
	}

	var change types.ChangeFileInfo
	if err := json.Unmarshal(data, &change); err != nil {
		t.Fatalf("failed to parse change file: %v", err)
	}

	if change.Type != types.ChangeTypePatch {
		t.Fatalf("expected patch, got %s", change.Type)
	}
	if change.Comment != "test description" {
		t.Fatalf("expected 'test description', got %q", change.Comment)
	}
	if change.PackageName != "foo" {
		t.Fatalf("expected 'foo', got %q", change.PackageName)
	}
	if change.DependentChangeType != types.ChangeTypePatch {
		t.Fatalf("expected patch dependent type, got %s", change.DependentChangeType)
	}
}
