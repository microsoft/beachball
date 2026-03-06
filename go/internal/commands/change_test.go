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
	if err := commands.Change(parsed); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify file is staged (git status shows "A ")
	status := repo.Status()
	if !strings.Contains(status, "A ") {
		t.Fatalf("expected staged file (A prefix), got status: %q", status)
	}

	files := testutil.GetChangeFiles(&parsed.Options)
	if len(files) != 1 {
		t.Fatalf("expected 1 change file, got %d", len(files))
	}

	data, _ := os.ReadFile(files[0])
	var change types.ChangeFileInfo
	json.Unmarshal(data, &change)
	if change.Comment != "stage me please" {
		t.Fatalf("expected 'stage me please', got %q", change.Comment)
	}
	if change.PackageName != "foo" {
		t.Fatalf("expected 'foo', got %q", change.PackageName)
	}
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
	if err := commands.Change(parsed); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify clean git status (committed)
	status := repo.Status()
	if status != "" {
		t.Fatalf("expected clean status after commit, got: %q", status)
	}

	files := testutil.GetChangeFiles(&parsed.Options)
	if len(files) != 1 {
		t.Fatalf("expected 1 change file, got %d", len(files))
	}

	data, _ := os.ReadFile(files[0])
	var change types.ChangeFileInfo
	json.Unmarshal(data, &change)
	if change.Comment != "commit me please" {
		t.Fatalf("expected 'commit me please', got %q", change.Comment)
	}
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
	if err := commands.Change(parsed); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	status := repo.Status()
	if status != "" {
		t.Fatalf("expected clean status after commit, got: %q", status)
	}

	files := testutil.GetChangeFiles(&parsed.Options)
	if len(files) != 1 {
		t.Fatalf("expected 1 change file, got %d", len(files))
	}

	// Verify file is in custom directory
	if !strings.Contains(files[0], "changeDir") {
		t.Fatalf("expected file in changeDir, got: %s", files[0])
	}

	data, _ := os.ReadFile(files[0])
	var change types.ChangeFileInfo
	json.Unmarshal(data, &change)
	if change.Comment != "commit me please" {
		t.Fatalf("expected 'commit me please', got %q", change.Comment)
	}
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
	if err := commands.Change(parsed); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	files := testutil.GetChangeFiles(&parsed.Options)
	if len(files) != 1 {
		t.Fatalf("expected 1 change file, got %d", len(files))
	}

	data, _ := os.ReadFile(files[0])
	var change types.ChangeFileInfo
	json.Unmarshal(data, &change)
	if change.PackageName != "foo" {
		t.Fatalf("expected 'foo', got %q", change.PackageName)
	}
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
	if err := commands.Change(parsed); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	status := repo.Status()
	if status != "" {
		t.Fatalf("expected clean status, got: %q", status)
	}

	files := testutil.GetChangeFiles(&parsed.Options)
	if len(files) != 2 {
		t.Fatalf("expected 2 change files, got %d", len(files))
	}

	packageNames := map[string]bool{}
	for _, f := range files {
		data, _ := os.ReadFile(f)
		var change types.ChangeFileInfo
		json.Unmarshal(data, &change)
		packageNames[change.PackageName] = true
		if change.Type != types.ChangeTypeMinor {
			t.Fatalf("expected minor, got %s for %s", change.Type, change.PackageName)
		}
		if change.Comment != "multi-package change" {
			t.Fatalf("expected 'multi-package change', got %q", change.Comment)
		}
	}

	if !packageNames["foo"] || !packageNames["bar"] {
		t.Fatalf("expected foo and bar, got %v", packageNames)
	}
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
	if err := commands.Change(parsed); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	status := repo.Status()
	if status != "" {
		t.Fatalf("expected clean status, got: %q", status)
	}

	files := testutil.GetChangeFiles(&parsed.Options)
	if len(files) != 1 {
		t.Fatalf("expected 1 grouped change file, got %d", len(files))
	}

	data, _ := os.ReadFile(files[0])
	var grouped types.ChangeInfoMultiple
	if err := json.Unmarshal(data, &grouped); err != nil {
		t.Fatalf("failed to parse grouped change file: %v", err)
	}

	if len(grouped.Changes) != 2 {
		t.Fatalf("expected 2 changes in grouped file, got %d", len(grouped.Changes))
	}

	packageNames := map[string]bool{}
	for _, change := range grouped.Changes {
		packageNames[change.PackageName] = true
		if change.Type != types.ChangeTypeMinor {
			t.Fatalf("expected minor, got %s for %s", change.Type, change.PackageName)
		}
		if change.Comment != "grouped change" {
			t.Fatalf("expected 'grouped change', got %q", change.Comment)
		}
	}

	if !packageNames["foo"] || !packageNames["bar"] {
		t.Fatalf("expected foo and bar, got %v", packageNames)
	}
}
