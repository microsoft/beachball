package changefile_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/monorepo"
	"github.com/microsoft/beachball/internal/options"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func getReadTestOptionsAndPackages(t *testing.T, repo *testutil.Repository, overrides *types.BeachballOptions) (types.BeachballOptions, types.PackageInfos, types.ScopedPackages) {
	t.Helper()
	repoOpts := getDefaultOptions()
	if overrides != nil {
		repoOpts = *overrides
	}
	parsed := options.GetParsedOptionsForTest(repo.RootPath(), types.CliOptions{}, repoOpts)
	packageInfos, err := monorepo.GetPackageInfos(&parsed.Options)
	require.NoError(t, err)
	scopedPackages := monorepo.GetScopedPackages(&parsed.Options, packageInfos)
	return parsed.Options, packageInfos, scopedPackages
}

func getPackageNames(changeSet types.ChangeSet) []string {
	var names []string
	for _, entry := range changeSet {
		names = append(names, entry.Change.PackageName)
	}
	slices.Sort(names)
	return names
}

// TS: "reads change files and returns [them]"
func TestReadChangeFiles_ReadsChangeFiles(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test", testutil.DefaultBranch)
	repo.CommitChange("packages/foo/file.js")

	opts, infos, scoped := getReadTestOptionsAndPackages(t, repo, nil)
	testutil.GenerateChangeFiles(t, []string{"foo", "bar"}, &opts, repo)

	changeSet := changefile.ReadChangeFiles(&opts, infos, scoped)
	assert.Len(t, changeSet, 2)
	assert.Equal(t, []string{"bar", "foo"}, getPackageNames(changeSet))
}

// TS: "reads from a custom changeDir"
func TestReadChangeFiles_ReadsFromCustomChangeDir(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test", testutil.DefaultBranch)
	repo.CommitChange("packages/foo/file.js")

	overrides := getDefaultOptions()
	overrides.ChangeDir = "customChanges"
	opts, infos, scoped := getReadTestOptionsAndPackages(t, repo, &overrides)
	testutil.GenerateChangeFiles(t, []string{"foo"}, &opts, repo)

	changeSet := changefile.ReadChangeFiles(&opts, infos, scoped)
	assert.Equal(t, []string{"foo"}, getPackageNames(changeSet))
}

// TS: "reads a grouped change file"
func TestReadChangeFiles_ReadsGroupedChangeFile(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test", testutil.DefaultBranch)
	repo.CommitChange("packages/foo/file.js")

	overrides := getDefaultOptions()
	overrides.GroupChanges = true
	opts, infos, scoped := getReadTestOptionsAndPackages(t, repo, &overrides)

	// Write a grouped change file manually
	changePath := changefile.GetChangePath(&opts)
	os.MkdirAll(changePath, 0o755)
	grouped := types.ChangeInfoMultiple{
		Changes: []types.ChangeFileInfo{
			{Type: types.ChangeTypeMinor, Comment: "foo change", PackageName: "foo", Email: "test@test.com", DependentChangeType: types.ChangeTypePatch},
			{Type: types.ChangeTypeMinor, Comment: "bar change", PackageName: "bar", Email: "test@test.com", DependentChangeType: types.ChangeTypePatch},
		},
	}
	data, _ := json.MarshalIndent(grouped, "", "  ")
	os.WriteFile(filepath.Join(changePath, "change-grouped.json"), data, 0o644)
	repo.Git([]string{"add", "-A"})
	repo.Git([]string{"commit", "-m", "grouped change file"})

	changeSet := changefile.ReadChangeFiles(&opts, infos, scoped)
	assert.Equal(t, []string{"bar", "foo"}, getPackageNames(changeSet))
}

// TS: "excludes invalid change files"
func TestReadChangeFiles_ExcludesInvalidChangeFiles(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test", testutil.DefaultBranch)
	repo.CommitChange("packages/foo/file.js")

	// Make bar private
	barPkgPath := filepath.Join(repo.RootPath(), "packages", "bar", "package.json")
	barData, _ := os.ReadFile(barPkgPath)
	var barPkg map[string]any
	json.Unmarshal(barData, &barPkg)
	barPkg["private"] = true
	barData, _ = json.MarshalIndent(barPkg, "", "  ")
	os.WriteFile(barPkgPath, barData, 0o644)
	repo.Git([]string{"add", "-A"})
	repo.Git([]string{"commit", "-m", "make bar private"})

	opts, infos, scoped := getReadTestOptionsAndPackages(t, repo, nil)

	// Generate change files: "fake" doesn't exist, "bar" is private, "foo" is valid
	testutil.GenerateChangeFiles(t, []string{"fake", "bar", "foo"}, &opts, repo)

	// Also write a non-change JSON file
	changePath := changefile.GetChangePath(&opts)
	os.WriteFile(filepath.Join(changePath, "not-change.json"), []byte("{}"), 0o644)
	repo.Git([]string{"add", "-A"})
	repo.Git([]string{"commit", "-m", "add invalid file"})

	buf := testutil.CaptureLogging(t)
	changeSet := changefile.ReadChangeFiles(&opts, infos, scoped)
	assert.Equal(t, []string{"foo"}, getPackageNames(changeSet))

	output := buf.String()
	assert.Contains(t, output, "does not appear to be a change file")
	assert.Contains(t, output, "Change detected for nonexistent package fake; delete this file")
	assert.Contains(t, output, "Change detected for private package bar; delete this file")
}

// TS: "excludes invalid changes from grouped change file in monorepo"
func TestReadChangeFiles_ExcludesInvalidChangesFromGroupedFile(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test", testutil.DefaultBranch)
	repo.CommitChange("packages/foo/file.js")

	// Make bar private
	barPkgPath := filepath.Join(repo.RootPath(), "packages", "bar", "package.json")
	barData, _ := os.ReadFile(barPkgPath)
	var barPkg map[string]any
	json.Unmarshal(barData, &barPkg)
	barPkg["private"] = true
	barData, _ = json.MarshalIndent(barPkg, "", "  ")
	os.WriteFile(barPkgPath, barData, 0o644)
	repo.Git([]string{"add", "-A"})
	repo.Git([]string{"commit", "-m", "make bar private"})

	overrides := getDefaultOptions()
	overrides.GroupChanges = true
	opts, infos, scoped := getReadTestOptionsAndPackages(t, repo, &overrides)

	// Write a grouped change file with invalid entries
	changePath := changefile.GetChangePath(&opts)
	os.MkdirAll(changePath, 0o755)
	grouped := types.ChangeInfoMultiple{
		Changes: []types.ChangeFileInfo{
			{Type: types.ChangeTypeMinor, Comment: "fake change", PackageName: "fake", Email: "test@test.com", DependentChangeType: types.ChangeTypePatch},
			{Type: types.ChangeTypeMinor, Comment: "bar change", PackageName: "bar", Email: "test@test.com", DependentChangeType: types.ChangeTypePatch},
			{Type: types.ChangeTypeMinor, Comment: "foo change", PackageName: "foo", Email: "test@test.com", DependentChangeType: types.ChangeTypePatch},
		},
	}
	data, _ := json.MarshalIndent(grouped, "", "  ")
	os.WriteFile(filepath.Join(changePath, "change-grouped.json"), data, 0o644)
	repo.Git([]string{"add", "-A"})
	repo.Git([]string{"commit", "-m", "grouped change file"})

	buf := testutil.CaptureLogging(t)
	changeSet := changefile.ReadChangeFiles(&opts, infos, scoped)
	assert.Equal(t, []string{"foo"}, getPackageNames(changeSet))

	output := buf.String()
	assert.Contains(t, output, "Change detected for nonexistent package fake; remove the entry from this file")
	assert.Contains(t, output, "Change detected for private package bar; remove the entry from this file")
}

// TS: "excludes out of scope change files in monorepo"
func TestReadChangeFiles_ExcludesOutOfScopeChangeFiles(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test", testutil.DefaultBranch)
	repo.CommitChange("packages/foo/file.js")

	overrides := getDefaultOptions()
	overrides.Scope = []string{"packages/foo"}
	opts, infos, scoped := getReadTestOptionsAndPackages(t, repo, &overrides)

	testutil.GenerateChangeFiles(t, []string{"bar", "foo"}, &opts, repo)

	changeSet := changefile.ReadChangeFiles(&opts, infos, scoped)
	assert.Equal(t, []string{"foo"}, getPackageNames(changeSet))
}
