package monorepo_test

import (
	"path/filepath"
	"sort"
	"testing"

	"github.com/microsoft/beachball/internal/monorepo"
	"github.com/microsoft/beachball/internal/types"
)

func makeInfos(root string, folders map[string]string) types.PackageInfos {
	infos := make(types.PackageInfos)
	for folder, name := range folders {
		infos[name] = &types.PackageInfo{
			Name:            name,
			Version:         "1.0.0",
			PackageJSONPath: filepath.Join(root, folder, "package.json"),
		}
	}
	return infos
}

func TestGetPackageGroups_ReturnsEmptyIfNoGroups(t *testing.T) {
	infos := makeInfos("/repo", map[string]string{
		"packages/foo": "foo",
	})
	result := monorepo.GetPackageGroups(infos, "/repo", nil)
	if len(result) != 0 {
		t.Fatalf("expected empty map, got: %v", result)
	}
}

func TestGetPackageGroups_ReturnsGroupsBasedOnSpecificFolders(t *testing.T) {
	infos := makeInfos("/repo", map[string]string{
		"packages/foo": "foo",
		"packages/bar": "bar",
		"packages/baz": "baz",
	})
	groups := []types.VersionGroupOptions{
		{
			Name:    "grp1",
			Include: []string{"packages/foo", "packages/bar"},
		},
	}
	result := monorepo.GetPackageGroups(infos, "/repo", groups)
	if len(result) != 1 {
		t.Fatalf("expected 1 group, got %d", len(result))
	}
	grp := result["grp1"]
	if grp == nil {
		t.Fatal("expected grp1 to exist")
	}
	sort.Strings(grp.Packages)
	if len(grp.Packages) != 2 {
		t.Fatalf("expected 2 packages, got %d: %v", len(grp.Packages), grp.Packages)
	}
	if grp.Packages[0] != "bar" || grp.Packages[1] != "foo" {
		t.Fatalf("expected [bar foo], got: %v", grp.Packages)
	}
}

func TestGetPackageGroups_HandlesSingleLevelGlobs(t *testing.T) {
	infos := makeInfos("/repo", map[string]string{
		"packages/ui-button":  "ui-button",
		"packages/ui-input":   "ui-input",
		"packages/core-utils": "core-utils",
	})
	groups := []types.VersionGroupOptions{
		{
			Name:    "ui",
			Include: []string{"packages/ui-*"},
		},
	}
	result := monorepo.GetPackageGroups(infos, "/repo", groups)
	grp := result["ui"]
	if grp == nil {
		t.Fatal("expected ui group to exist")
	}
	sort.Strings(grp.Packages)
	if len(grp.Packages) != 2 {
		t.Fatalf("expected 2 packages, got %d: %v", len(grp.Packages), grp.Packages)
	}
	if grp.Packages[0] != "ui-button" || grp.Packages[1] != "ui-input" {
		t.Fatalf("expected [ui-button ui-input], got: %v", grp.Packages)
	}
}

func TestGetPackageGroups_HandlesMultiLevelGlobs(t *testing.T) {
	infos := makeInfos("/repo", map[string]string{
		"packages/ui/button": "ui-button",
		"packages/ui/input":  "ui-input",
		"packages/core":      "core",
	})
	groups := []types.VersionGroupOptions{
		{
			Name:    "ui",
			Include: []string{"packages/ui/**"},
		},
	}
	result := monorepo.GetPackageGroups(infos, "/repo", groups)
	grp := result["ui"]
	if grp == nil {
		t.Fatal("expected ui group to exist")
	}
	sort.Strings(grp.Packages)
	if len(grp.Packages) != 2 {
		t.Fatalf("expected 2 packages, got %d: %v", len(grp.Packages), grp.Packages)
	}
	if grp.Packages[0] != "ui-button" || grp.Packages[1] != "ui-input" {
		t.Fatalf("expected [ui-button ui-input], got: %v", grp.Packages)
	}
}

func TestGetPackageGroups_HandlesMultipleIncludePatterns(t *testing.T) {
	infos := makeInfos("/repo", map[string]string{
		"packages/foo": "foo",
		"libs/bar":     "bar",
		"other/baz":    "baz",
	})
	groups := []types.VersionGroupOptions{
		{
			Name:    "mixed",
			Include: []string{"packages/*", "libs/*"},
		},
	}
	result := monorepo.GetPackageGroups(infos, "/repo", groups)
	grp := result["mixed"]
	if grp == nil {
		t.Fatal("expected mixed group to exist")
	}
	sort.Strings(grp.Packages)
	if len(grp.Packages) != 2 {
		t.Fatalf("expected 2 packages, got %d: %v", len(grp.Packages), grp.Packages)
	}
	if grp.Packages[0] != "bar" || grp.Packages[1] != "foo" {
		t.Fatalf("expected [bar foo], got: %v", grp.Packages)
	}
}

func TestGetPackageGroups_HandlesExcludePatterns(t *testing.T) {
	infos := makeInfos("/repo", map[string]string{
		"packages/foo":      "foo",
		"packages/bar":      "bar",
		"packages/internal": "internal",
	})
	groups := []types.VersionGroupOptions{
		{
			Name:    "public",
			Include: []string{"packages/*"},
			Exclude: []string{"packages/internal"},
		},
	}
	result := monorepo.GetPackageGroups(infos, "/repo", groups)
	grp := result["public"]
	if grp == nil {
		t.Fatal("expected public group to exist")
	}
	sort.Strings(grp.Packages)
	if len(grp.Packages) != 2 {
		t.Fatalf("expected 2 packages, got %d: %v", len(grp.Packages), grp.Packages)
	}
	if grp.Packages[0] != "bar" || grp.Packages[1] != "foo" {
		t.Fatalf("expected [bar foo], got: %v", grp.Packages)
	}
}

func TestGetPackageGroups_HandlesGlobExclude(t *testing.T) {
	infos := makeInfos("/repo", map[string]string{
		"packages/ui/button":  "ui-button",
		"packages/ui/input":   "ui-input",
		"packages/core/utils": "core-utils",
	})
	groups := []types.VersionGroupOptions{
		{
			Name:    "non-core",
			Include: []string{"packages/**"},
			Exclude: []string{"packages/core/*"},
		},
	}
	result := monorepo.GetPackageGroups(infos, "/repo", groups)
	grp := result["non-core"]
	if grp == nil {
		t.Fatal("expected non-core group to exist")
	}
	sort.Strings(grp.Packages)
	if len(grp.Packages) != 2 {
		t.Fatalf("expected 2 packages, got %d: %v", len(grp.Packages), grp.Packages)
	}
	if grp.Packages[0] != "ui-button" || grp.Packages[1] != "ui-input" {
		t.Fatalf("expected [ui-button ui-input], got: %v", grp.Packages)
	}
}

func TestGetPackageGroups_OmitsEmptyGroups(t *testing.T) {
	infos := makeInfos("/repo", map[string]string{
		"packages/foo": "foo",
	})
	groups := []types.VersionGroupOptions{
		{
			Name:    "empty",
			Include: []string{"nonexistent/*"},
		},
	}
	result := monorepo.GetPackageGroups(infos, "/repo", groups)
	grp := result["empty"]
	if grp == nil {
		t.Fatal("expected empty group key to exist")
	}
	if len(grp.Packages) != 0 {
		t.Fatalf("expected 0 packages, got %d: %v", len(grp.Packages), grp.Packages)
	}
}
