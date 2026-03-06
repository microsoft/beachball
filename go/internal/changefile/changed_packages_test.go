package changefile_test

import (
	"sort"
	"testing"

	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/monorepo"
	"github.com/microsoft/beachball/internal/options"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
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
	if err != nil {
		t.Fatalf("failed to get package infos: %v", err)
	}
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
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 0 {
		t.Fatalf("expected empty list, got: %v", result)
	}
}

func TestReturnsPackageNameWhenChangesInBranch(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	checkOutTestBranch(repo, "changes_in_branch")
	repo.CommitChange("packages/foo/myFilename")

	opts, infos, scoped := getOptionsAndPackages(t, repo, nil, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 || result[0] != "foo" {
		t.Fatalf("expected [foo], got: %v", result)
	}
}

func TestReturnsEmptyListForChangelogChanges(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()
	checkOutTestBranch(repo, "changelog_changes")
	repo.CommitChange("packages/foo/CHANGELOG.md")

	opts, infos, scoped := getOptionsAndPackages(t, repo, nil, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 0 {
		t.Fatalf("expected empty list, got: %v", result)
	}
}

func TestReturnsGivenPackageNamesAsIs(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	cli := types.CliOptions{Package: []string{"foo"}}
	opts, infos, scoped := getOptionsAndPackages(t, repo, nil, &cli)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 || result[0] != "foo" {
		t.Fatalf("expected [foo], got: %v", result)
	}

	cli2 := types.CliOptions{Package: []string{"foo", "bar", "nope"}}
	opts2, infos2, scoped2 := getOptionsAndPackages(t, repo, nil, &cli2)
	result2, err := changefile.GetChangedPackages(&opts2, infos2, scoped2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := []string{"foo", "bar", "nope"}
	if len(result2) != len(expected) {
		t.Fatalf("expected %v, got: %v", expected, result2)
	}
	for i, v := range expected {
		if result2[i] != v {
			t.Fatalf("expected %v, got: %v", expected, result2)
		}
	}
}

func TestReturnsAllPackagesWithAllTrue(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	overrides := types.DefaultOptions()
	overrides.All = true
	opts, infos, scoped := getOptionsAndPackages(t, repo, &overrides, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	sort.Strings(result)
	expected := []string{"a", "b", "bar", "baz", "foo"}
	if len(result) != len(expected) {
		t.Fatalf("expected %v, got: %v", expected, result)
	}
	for i, v := range expected {
		if result[i] != v {
			t.Fatalf("expected %v, got: %v", expected, result)
		}
	}
}

// ===== Single package tests =====

func TestDetectsChangedFilesInSinglePackageRepo(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "single")
	repo := factory.CloneRepository()

	opts, infos, scoped := getOptionsAndPackages(t, repo, nil, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 0 {
		t.Fatalf("expected empty, got: %v", result)
	}

	repo.StageChange("foo.js")
	result2, err := changefile.GetChangedPackages(&opts, infos, scoped)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result2) != 1 || result2[0] != "foo" {
		t.Fatalf("expected [foo], got: %v", result2)
	}
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
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 0 {
		t.Fatalf("expected empty, got: %v", result)
	}
}

// ===== Monorepo tests =====

func TestDetectsChangedFilesInMonorepo(t *testing.T) {
	factory := testutil.NewRepositoryFactory(t, "monorepo")
	repo := factory.CloneRepository()

	opts, infos, scoped := getOptionsAndPackages(t, repo, nil, nil)
	result, err := changefile.GetChangedPackages(&opts, infos, scoped)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 0 {
		t.Fatalf("expected empty, got: %v", result)
	}

	repo.StageChange("packages/foo/test.js")
	result2, err := changefile.GetChangedPackages(&opts, infos, scoped)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result2) != 1 || result2[0] != "foo" {
		t.Fatalf("expected [foo], got: %v", result2)
	}
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
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 0 {
		t.Fatalf("expected empty but got: %v", result)
	}

	// Change bar => bar is the only changed package returned
	repo.StageChange("packages/bar/test.js")
	result2, err := changefile.GetChangedPackages(&opts, infos, scoped)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result2) != 1 || result2[0] != "bar" {
		t.Fatalf("expected [bar], got: %v", result2)
	}
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
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 || result[0] != "publish-me" {
		t.Fatalf("expected [publish-me], got: %v", result)
	}
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
	if err != nil {
		t.Fatalf("failed to get package infos: %v", err)
	}
	scopedA := monorepo.GetScopedPackages(&parsedA.Options, infosA)
	resultA, err := changefile.GetChangedPackages(&parsedA.Options, infosA, scopedA)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resultA) != 1 || resultA[0] != "@project-a/foo" {
		t.Fatalf("expected [@project-a/foo], got: %v", resultA)
	}

	// Test from project-b root
	pathB := repo.PathTo("project-b")
	optsB := types.DefaultOptions()
	optsB.Path = pathB
	optsB.Branch = defaultRemoteBranch
	optsB.Fetch = false

	parsedB := options.GetParsedOptionsForTest(pathB, types.CliOptions{}, optsB)
	infosB, err := monorepo.GetPackageInfos(&parsedB.Options)
	if err != nil {
		t.Fatalf("failed to get package infos: %v", err)
	}
	scopedB := monorepo.GetScopedPackages(&parsedB.Options, infosB)
	resultB, err := changefile.GetChangedPackages(&parsedB.Options, infosB, scopedB)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resultB) != 0 {
		t.Fatalf("expected empty, got: %v", resultB)
	}
}
