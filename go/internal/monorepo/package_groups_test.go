package monorepo_test

import (
	"sort"
	"testing"

	"github.com/microsoft/beachball/internal/monorepo"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
	"github.com/stretchr/testify/assert"
)

var root = testutil.FakeRoot()

func TestGetPackageGroups_ReturnsEmptyIfNoGroups(t *testing.T) {
	infos := testutil.MakePackageInfos(root, map[string]string{
		"packages/foo": "foo",
	})
	result := monorepo.GetPackageGroups(infos, root, nil)
	assert.Empty(t, result)
}

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
	sort.Strings(grp.Packages)
	assert.Equal(t, []string{"bar", "foo"}, grp.Packages)
}

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
	sort.Strings(grp.Packages)
	assert.Equal(t, []string{"ui-button", "ui-input"}, grp.Packages)
}

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
	sort.Strings(grp.Packages)
	assert.Equal(t, []string{"ui-button", "ui-input"}, grp.Packages)
}

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
	sort.Strings(grp.Packages)
	assert.Equal(t, []string{"bar", "foo"}, grp.Packages)
}

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
	sort.Strings(grp.Packages)
	assert.Equal(t, []string{"bar", "foo"}, grp.Packages)
}

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
	sort.Strings(grp.Packages)
	assert.Equal(t, []string{"ui-button", "ui-input"}, grp.Packages)
}

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
