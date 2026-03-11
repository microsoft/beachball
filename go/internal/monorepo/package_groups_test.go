package monorepo_test

import (
	"slices"
	"testing"

	"github.com/microsoft/beachball/internal/monorepo"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
	"github.com/stretchr/testify/assert"
)

var root = testutil.FakeRoot()

// TS: "returns empty object if no groups are defined"
func TestGetPackageGroups_ReturnsEmptyIfNoGroups(t *testing.T) {
	infos := testutil.MakePackageInfos(root, map[string]string{
		"packages/foo": "foo",
	})
	result := monorepo.GetPackageGroups(infos, root, nil)
	assert.Empty(t, result)
}

// TS: "returns groups based on specific folders"
func TestGetPackageGroups_ReturnsGroupsBasedOnSpecificFolders(t *testing.T) {
	infos := testutil.MakePackageInfos(root, map[string]string{
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
	result := monorepo.GetPackageGroups(infos, root, groups)
	assert.Len(t, result, 1)
	grp := result["grp1"]
	assert.NotNil(t, grp)
	slices.Sort(grp.Packages)
	assert.Equal(t, []string{"bar", "foo"}, grp.Packages)
}

// TS: "handles single-level globs"
func TestGetPackageGroups_HandlesSingleLevelGlobs(t *testing.T) {
	infos := testutil.MakePackageInfos(root, map[string]string{
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
	result := monorepo.GetPackageGroups(infos, root, groups)
	grp := result["ui"]
	assert.NotNil(t, grp)
	slices.Sort(grp.Packages)
	assert.Equal(t, []string{"ui-button", "ui-input"}, grp.Packages)
}

// TS: "handles multi-level globs"
func TestGetPackageGroups_HandlesMultiLevelGlobs(t *testing.T) {
	infos := testutil.MakePackageInfos(root, map[string]string{
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
	result := monorepo.GetPackageGroups(infos, root, groups)
	grp := result["ui"]
	assert.NotNil(t, grp)
	slices.Sort(grp.Packages)
	assert.Equal(t, []string{"ui-button", "ui-input"}, grp.Packages)
}

// TS: "handles multiple include patterns in a single group"
func TestGetPackageGroups_HandlesMultipleIncludePatterns(t *testing.T) {
	infos := testutil.MakePackageInfos(root, map[string]string{
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
	result := monorepo.GetPackageGroups(infos, root, groups)
	grp := result["mixed"]
	assert.NotNil(t, grp)
	slices.Sort(grp.Packages)
	assert.Equal(t, []string{"bar", "foo"}, grp.Packages)
}

// TS: "handles specific exclude patterns"
func TestGetPackageGroups_HandlesExcludePatterns(t *testing.T) {
	infos := testutil.MakePackageInfos(root, map[string]string{
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
	result := monorepo.GetPackageGroups(infos, root, groups)
	grp := result["public"]
	assert.NotNil(t, grp)
	slices.Sort(grp.Packages)
	assert.Equal(t, []string{"bar", "foo"}, grp.Packages)
}

// TS: "handles glob exclude patterns"
func TestGetPackageGroups_HandlesGlobExclude(t *testing.T) {
	infos := testutil.MakePackageInfos(root, map[string]string{
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
	result := monorepo.GetPackageGroups(infos, root, groups)
	grp := result["non-core"]
	assert.NotNil(t, grp)
	slices.Sort(grp.Packages)
	assert.Equal(t, []string{"ui-button", "ui-input"}, grp.Packages)
}

// TS: "exits with error if package belongs to multiple groups"
func TestGetPackageGroups_ErrorsIfPackageBelongsToMultipleGroups(t *testing.T) {
	infos := testutil.MakePackageInfos(root, map[string]string{
		"packages/shared": "shared",
		"packages/foo":    "foo",
	})
	groups := []types.VersionGroupOptions{
		{
			Name:    "group1",
			Include: []string{"packages/*"},
		},
		{
			Name:    "group2",
			Include: []string{"packages/shared"},
		},
	}

	buf := testutil.CaptureLogging(t)
	monorepo.GetPackageGroups(infos, root, groups)
	assert.Contains(t, buf.String(), "Found package(s) belonging to multiple groups")
	assert.Contains(t, buf.String(), "shared")
}

// TS: "omits empty groups"
func TestGetPackageGroups_OmitsEmptyGroups(t *testing.T) {
	infos := testutil.MakePackageInfos(root, map[string]string{
		"packages/foo": "foo",
	})
	groups := []types.VersionGroupOptions{
		{
			Name:    "empty",
			Include: []string{"nonexistent/*"},
		},
	}
	result := monorepo.GetPackageGroups(infos, root, groups)
	grp := result["empty"]
	assert.NotNil(t, grp)
	assert.Empty(t, grp.Packages)
}
