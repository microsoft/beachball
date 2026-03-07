package changefile_test

import (
	"sort"
	"testing"

	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/monorepo"
	"github.com/microsoft/beachball/internal/options"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const defaultBranch = "master"
const defaultRemoteBranch = "origin/master"

func getOptionsAndPackages(t *testing.T, repo *testutil.Repository, overrides *types.BeachballOptions, extraCli *types.CliOptions) (types.BeachballOptions, types.PackageInfos, types.ScopedPackages) {
	t.Helper()

	cli := types.CliOptions{}
	if extraCli != nil {
		cli = *extraCli
	}

	repoOpts := types.DefaultOptions()
	if overrides != nil {
		repoOpts = *overrides
	}
	repoOpts.Branch = defaultRemoteBranch
	repoOpts.Fetch = false

	parsed := options.GetParsedOptionsForTest(repo.RootPath(), cli, repoOpts)
	packageInfos, err := monorepo.GetPackageInfos(&parsed.Options)
	require.NoError(t, err, "failed to get package infos")
	scopedPackages := monorepo.GetScopedPackages(&parsed.Options, packageInfos)
	return parsed.Options, packageInfos, scopedPackages
}

func checkOutTestBranch(repo *testutil.Repository, name string) {
	repo.Checkout("-b", name, defaultBranch)
}

// ===== Basic tests =====

func TestReturnsEmptyListWhenNoChanges(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	opts, infos, scoped := getOptionsAndPackages(t, repo, nil, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Empty(t, result)
}

func TestReturnsPackageNameWhenChangesInBranch(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	checkOutTestBranch(repo, "changes_in_branch")
	repo.CommitChange("packages/foo/myFilename")

	opts, infos, scoped := getOptionsAndPackages(t, repo, nil, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Equal(t, []string{"foo"}, result)
}

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

func TestReturnsAllPackagesWithAllTrue(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	overrides := types.DefaultOptions()
	overrides.All = true
	opts, infos, scoped := getOptionsAndPackages(t, repo, &overrides, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	sort.Strings(result)
	assert.Equal(t, []string{"a", "b", "bar", "baz", "foo"}, result)
}

// ===== Single package tests =====

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

func TestRespectsIgnorePatterns(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()

	overrides := types.DefaultOptions()
	overrides.IgnorePatterns = []string{"*.test.js", "tests/**", "yarn.lock"}
	overrides.Verbose = true

	opts, infos, scoped := getOptionsAndPackages(t, repo, &overrides, nil)

	repo.WriteFile("src/foo.test.js")
	repo.WriteFile("tests/stuff.js")
	repo.WriteFileContent("yarn.lock", "changed")
	repo.Git([]string{"add", "-A"})

	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Empty(t, result)
}

// ===== Monorepo tests =====

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

func TestExcludesPackagesWithExistingChangeFiles(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	repo.Checkout("-b", "test")
	repo.CommitChange("packages/foo/test.js")

	overrides := types.DefaultOptions()
	overrides.Verbose = true
	opts, infos, scoped := getOptionsAndPackages(t, repo, &overrides, nil)
	testutil.GenerateChangeFiles(t, []string{"foo"}, &opts, repo)

	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Empty(t, result)

	// Change bar => bar is the only changed package returned
	repo.StageChange("packages/bar/test.js")
	result2, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Equal(t, []string{"bar"}, result2)
}

func TestIgnoresPackageChangesAsAppropriate(t *testing.T) {
	rootPkg := map[string]interface{}{
		"name":       "test-monorepo",
		"version":    "1.0.0",
		"private":    true,
		"workspaces": []string{"packages/*"},
	}

	packages := map[string]map[string]interface{}{
		"private-pkg": {"name": "private-pkg", "version": "1.0.0", "private": true},
		"no-publish": {
			"name": "no-publish", "version": "1.0.0",
			"beachball": map[string]interface{}{"shouldPublish": false},
		},
		"out-of-scope": {"name": "out-of-scope", "version": "1.0.0"},
		"ignore-pkg":   {"name": "ignore-pkg", "version": "1.0.0"},
		"publish-me":   {"name": "publish-me", "version": "1.0.0"},
	}

	groups := map[string]map[string]map[string]interface{}{
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

	overrides := types.DefaultOptions()
	overrides.Scope = []string{"!packages/out-of-scope"}
	overrides.IgnorePatterns = []string{"**/jest.config.js"}
	overrides.Verbose = true

	opts, infos, scoped := getOptionsAndPackages(t, repo, &overrides, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	require.NoError(t, err)
	assert.Equal(t, []string{"publish-me"}, result)
}

func TestDetectsChangedFilesInMultiRootMonorepo(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "multi-project")
	repo := factory.CloneRepository()

	repo.StageChange("project-a/packages/foo/test.js")

	// Test from project-a root
	pathA := repo.PathTo("project-a")
	optsA := types.DefaultOptions()
	optsA.Path = pathA
	optsA.Branch = defaultRemoteBranch
	optsA.Fetch = false

	parsedA := options.GetParsedOptionsForTest(pathA, types.CliOptions{}, optsA)
	infosA, err := monorepo.GetPackageInfos(&parsedA.Options)
	require.NoError(t, err, "failed to get package infos")
	scopedA := monorepo.GetScopedPackages(&parsedA.Options, infosA)
	resultA, err := changefile.GetChangedPackages(&parsedA.Options, infosA, scopedA)
	require.NoError(t, err)
	assert.Equal(t, []string{"@project-a/foo"}, resultA)

	// Test from project-b root
	pathB := repo.PathTo("project-b")
	optsB := types.DefaultOptions()
	optsB.Path = pathB
	optsB.Branch = defaultRemoteBranch
	optsB.Fetch = false

	parsedB := options.GetParsedOptionsForTest(pathB, types.CliOptions{}, optsB)
	infosB, err := monorepo.GetPackageInfos(&parsedB.Options)
	require.NoError(t, err, "failed to get package infos")
	scopedB := monorepo.GetScopedPackages(&parsedB.Options, infosB)
	resultB, err := changefile.GetChangedPackages(&parsedB.Options, infosB, scopedB)
	require.NoError(t, err)
	assert.Empty(t, resultB)
}
