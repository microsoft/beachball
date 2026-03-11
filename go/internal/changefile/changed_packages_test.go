package changefile_test

import (
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

// get default options for this file (fetch disabled)
func getDefaultOptions() types.BeachballOptions {
	defaultOptions := types.DefaultOptions()
	defaultOptions.Branch = testutil.DefaultRemoteBranch
	defaultOptions.Fetch = false

	return defaultOptions
}

func getOptionsAndPackages(t *testing.T, repo *testutil.Repository, overrides *types.BeachballOptions, extraCli *types.CliOptions) (types.BeachballOptions, types.PackageInfos, types.ScopedPackages) {
	t.Helper()

	cli := types.CliOptions{}
	if extraCli != nil {
		cli = *extraCli
	}

	repoOpts := getDefaultOptions()
	if overrides != nil {
		repoOpts = *overrides
	}

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), cli, repoOpts)
	packageInfos, err := monorepo.GetPackageInfos(&parsed.Options)
	require.NoError(t, err, "failed to get package infos")
	scopedPackages := monorepo.GetScopedPackages(&parsed.Options, packageInfos)
	return parsed.Options, packageInfos, scopedPackages
}

func checkOutTestBranch(repo *testutil.Repository, name string) {
	repo.Checkout("-b", name, testutil.DefaultBranch)
}

// ===== Basic tests (TS: getChangedPackages (basic)) =====

// TS: "returns empty list when no changes have been made"
func TestReturnsEmptyListWhenNoChanges(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	opts, infos, scoped := getOptionsAndPackages(t, repo, nil, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Empty(t, result)
}

// TS: "returns package name when changes exist in a new branch"
func TestReturnsPackageNameWhenChangesInBranch(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	checkOutTestBranch(repo, "changes_in_branch")
	repo.CommitChange("packages/foo/myFilename")

	buf := testutil.CaptureLogging(t)
	overrides := getDefaultOptions()
	overrides.Verbose = true
	opts, infos, scoped := getOptionsAndPackages(t, repo, &overrides, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Equal(t, []string{"foo"}, result)
	assert.Contains(t, buf.String(), "Checking for changes against")
}

// TS: "returns empty list when changes are CHANGELOG files"
func TestReturnsEmptyListForChangelogChanges(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	checkOutTestBranch(repo, "changelog_changes")
	repo.CommitChange("packages/foo/CHANGELOG.md")

	opts, infos, scoped := getOptionsAndPackages(t, repo, nil, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Empty(t, result)
}

// TS: "returns the given package name(s) as-is"
func TestReturnsGivenPackageNamesAsIs(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	cli := types.CliOptions{Package: []string{"foo"}}
	opts, infos, scoped := getOptionsAndPackages(t, repo, nil, &cli)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Equal(t, []string{"foo"}, result)

	cli2 := types.CliOptions{Package: []string{"foo", "bar", "nope"}}
	opts2, infos2, scoped2 := getOptionsAndPackages(t, repo, nil, &cli2)
	result2, err := changefile.GetChangedPackages(&opts2, infos2, scoped2)
	require.NoError(t, err)
	assert.Equal(t, []string{"foo", "bar", "nope"}, result2)
}

// TS: "returns all packages with all: true"
func TestReturnsAllPackagesWithAllTrue(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	overrides := getDefaultOptions()
	overrides.All = true
	opts, infos, scoped := getOptionsAndPackages(t, repo, &overrides, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	slices.Sort(result)
	assert.Equal(t, []string{"a", "b", "bar", "baz", "foo"}, result)
}

// ===== Single package tests (TS: getChangedPackages) =====

// TS: "detects changed files in single-package repo"
func TestDetectsChangedFilesInSinglePackageRepo(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()

	opts, infos, scoped := getOptionsAndPackages(t, repo, nil, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Empty(t, result)

	repo.StageChange("foo.js")
	result2, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Equal(t, []string{"foo"}, result2)
}

// TS: "respects ignorePatterns option"
func TestRespectsIgnorePatterns(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()

	overrides := getDefaultOptions()
	overrides.IgnorePatterns = []string{"*.test.js", "tests/**", "yarn.lock"}
	overrides.Verbose = true

	opts, infos, scoped := getOptionsAndPackages(t, repo, &overrides, nil)

	repo.WriteFile("src/foo.test.js")
	repo.WriteFile("tests/stuff.js")
	repo.WriteFileContent("yarn.lock", "changed")
	repo.Git([]string{"add", "-A"})

	buf := testutil.CaptureVerboseLogging(t)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Empty(t, result)
	output := buf.String()
	assert.Contains(t, output, "ignored by pattern")
	assert.Contains(t, output, "All files were ignored")
}

// ===== Monorepo tests =====

// TS: "detects changed files in monorepo"
func TestDetectsChangedFilesInMonorepo(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	opts, infos, scoped := getOptionsAndPackages(t, repo, nil, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Empty(t, result)

	repo.StageChange("packages/foo/test.js")
	result2, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Equal(t, []string{"foo"}, result2)
}

// TS: "excludes packages that already have change files"
func TestExcludesPackagesWithExistingChangeFiles(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test")
	repo.CommitChange("packages/foo/test.js")

	overrides := getDefaultOptions()
	overrides.Verbose = true
	opts, infos, scoped := getOptionsAndPackages(t, repo, &overrides, nil)
	testutil.GenerateChangeFiles(t, []string{"foo"}, &opts, repo)

	buf := testutil.CaptureVerboseLogging(t)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Empty(t, result)
	output := buf.String()
	assert.Contains(t, output, "already has change files for these packages")
	assert.Contains(t, output, "Found 1 file in 1 package that should be published")

	// Change bar => bar is the only changed package returned
	repo.StageChange("packages/bar/test.js")
	result2, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Equal(t, []string{"bar"}, result2)
}

// TS: "ignores change files that exist in target remote branch"
func TestIgnoresChangeFilesThatExistInTargetRemoteBranch(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()

	overrides := getDefaultOptions()
	overrides.Verbose = true
	opts, infos, scoped := getOptionsAndPackages(t, repo, &overrides, nil)

	// create and push a change file in master
	testutil.GenerateChangeFiles(t, []string{"foo"}, &opts, repo)
	repo.Push()

	// create a new branch and stage a new file
	repo.Checkout("-b", "test")
	repo.StageChange("test.js")

	buf := testutil.CaptureVerboseLogging(t)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Equal(t, []string{"foo"}, result)
	// The change file from master should not appear in the exclusion list
	assert.NotContains(t, buf.String(), "already has change files")
}

// TS: "ignores package changes as appropriate"
func TestIgnoresPackageChangesAsAppropriate(t *testing.T) {
	rootPkg := map[string]any{
		"name":       "test-monorepo",
		"version":    "1.0.0",
		"private":    true,
		"workspaces": []string{"packages/*"},
	}

	packages := map[string]map[string]any{
		"private-pkg": {"name": "private-pkg", "version": "1.0.0", "private": true},
		"no-publish": {
			"name": "no-publish", "version": "1.0.0",
			"beachball": map[string]any{"shouldPublish": false},
		},
		"out-of-scope": {"name": "out-of-scope", "version": "1.0.0"},
		"ignore-pkg":   {"name": "ignore-pkg", "version": "1.0.0"},
		"publish-me":   {"name": "publish-me", "version": "1.0.0"},
	}

	groups := map[string]map[string]map[string]any{
		"packages": packages,
	}

	factory := testutil.NewCustomRepositoryFactory(t, rootPkg, groups)
	repo := factory.CloneRepository()

	repo.StageChange("packages/private-pkg/test.js")
	repo.StageChange("packages/no-publish/test.js")
	repo.StageChange("packages/out-of-scope/test.js")
	repo.StageChange("packages/ignore-pkg/jest.config.js")
	repo.StageChange("packages/ignore-pkg/CHANGELOG.md")
	repo.StageChange("packages/publish-me/test.js")

	overrides := getDefaultOptions()
	overrides.Scope = []string{"!packages/out-of-scope"}
	overrides.IgnorePatterns = []string{"**/jest.config.js"}
	overrides.Verbose = true

	buf := testutil.CaptureVerboseLogging(t)
	opts, infos, scoped := getOptionsAndPackages(t, repo, &overrides, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Equal(t, []string{"publish-me"}, result)
	output := buf.String()
	assert.Contains(t, output, "private-pkg is private")
	assert.Contains(t, output, "no-publish has beachball.shouldPublish=false")
	assert.Contains(t, output, "out-of-scope is out of scope")
	assert.Contains(t, output, "ignored by pattern")
}

// TS: "detects changed files in multi-root monorepo repo"
func TestDetectsChangedFilesInMultiRootMonorepo(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "multi-project")
	repo := factory.CloneRepository()

	repo.StageChange("project-a/packages/foo/test.js")

	// Test from project-a root
	pathA := repo.PathTo("project-a")
	optsA := getDefaultOptions()
	optsA.Path = pathA

	parsedA := options.GetParsedOptionsForTest(pathA, types.CliOptions{}, optsA)
	infosA, err := monorepo.GetPackageInfos(&parsedA.Options)
	require.NoError(t, err, "failed to get package infos")
	scopedA := monorepo.GetScopedPackages(&parsedA.Options, infosA)
	resultA, err := changefile.GetChangedPackages(&parsedA.Options, infosA, scopedA)
	require.NoError(t, err)
	assert.Equal(t, []string{"@project-a/foo"}, resultA)

	// Test from project-b root
	pathB := repo.PathTo("project-b")
	optsB := getDefaultOptions()
	optsB.Path = pathB

	parsedB := options.GetParsedOptionsForTest(pathB, types.CliOptions{}, optsB)
	infosB, err := monorepo.GetPackageInfos(&parsedB.Options)
	require.NoError(t, err, "failed to get package infos")
	scopedB := monorepo.GetScopedPackages(&parsedB.Options, infosB)
	resultB, err := changefile.GetChangedPackages(&parsedB.Options, infosB, scopedB)
	require.NoError(t, err)
	assert.Empty(t, resultB)
}
