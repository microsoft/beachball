package changefile_test

import (
	"testing"

	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
	"github.com/stretchr/testify/assert"
)

var testRoot = testutil.FakeRoot()

// returns null for unknown package
func TestGetDisallowedChangeTypes_ReturnsNilForUnknownPackage(t *testing.T) {
	infos := types.PackageInfos{}
	groups := types.PackageGroups{}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("unknown-pkg", infos, groups, opts)
	assert.Nil(t, result)
}

// falls back to main option for package without disallowedChangeTypes
func TestGetDisallowedChangeTypes_FallsBackToMainOption(t *testing.T) {
	infos := testutil.MakePackageInfosSimple(testRoot, "foo")
	groups := types.PackageGroups{}
	opts := &types.BeachballOptions{}
	opts.DisallowedChangeTypes = []string{"major"}

	result := changefile.GetDisallowedChangeTypes("foo", infos, groups, opts)
	assert.Equal(t, []string{"major"}, result)
}

// returns disallowedChangeTypes for package
func TestGetDisallowedChangeTypes_ReturnsPackageLevelDisallowedTypes(t *testing.T) {
	infos := testutil.MakePackageInfosSimple(testRoot, "foo")
	infos["foo"].PackageOptions = &types.PackageOptions{
		DisallowedChangeTypes: []string{"major", "minor"},
	}
	groups := types.PackageGroups{}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("foo", infos, groups, opts)
	assert.Equal(t, []string{"major", "minor"}, result)
}

// Not possible (Go doesn't distinguish between null and unset):
// returns null if package disallowedChangeTypes is set to null

// returns empty array if package disallowedChangeTypes is set to empty array
func TestGetDisallowedChangeTypes_ReturnsEmptyArrayForEmptyPackageDisallowedTypes(t *testing.T) {
	infos := testutil.MakePackageInfosSimple(testRoot, "foo")
	infos["foo"].PackageOptions = &types.PackageOptions{
		DisallowedChangeTypes: []string{},
	}
	groups := types.PackageGroups{}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("foo", infos, groups, opts)
	assert.Equal(t, []string{}, result)
}

// returns disallowedChangeTypes for package group
func TestGetDisallowedChangeTypes_ReturnsGroupLevelDisallowedTypes(t *testing.T) {
	infos := testutil.MakePackageInfosSimple(testRoot, "foo")
	groups := types.PackageGroups{
		"grp1": &types.PackageGroup{
			Name:                  "grp1",
			Packages:              []string{"foo"},
			DisallowedChangeTypes: []string{"major", "minor"},
		},
	}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("foo", infos, groups, opts)
	assert.Equal(t, []string{"major", "minor"}, result)
}

// Not possible (Go doesn't distinguish between null and unset):
// returns null if package group disallowedChangeTypes is set to null

// returns empty array if package group disallowedChangeTypes is set to empty array
func TestGetDisallowedChangeTypes_ReturnsEmptyArrayForEmptyGroupDisallowedTypes(t *testing.T) {
	infos := testutil.MakePackageInfosSimple(testRoot, "foo")
	groups := types.PackageGroups{
		"grp1": &types.PackageGroup{
			Name:                  "grp1",
			Packages:              []string{"foo"},
			DisallowedChangeTypes: []string{},
		},
	}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("foo", infos, groups, opts)
	assert.Equal(t, []string{}, result)
}

// returns disallowedChangeTypes for package if not in a group
func TestGetDisallowedChangeTypes_ReturnsPackageDisallowedTypesIfNotInGroup(t *testing.T) {
	infos := testutil.MakePackageInfosSimple(testRoot, "foo")
	infos["foo"].PackageOptions = &types.PackageOptions{
		DisallowedChangeTypes: []string{"patch"},
	}
	groups := types.PackageGroups{
		"grp1": &types.PackageGroup{
			Name:                  "grp1",
			Packages:              []string{"bar"},
			DisallowedChangeTypes: []string{"major", "minor"},
		},
	}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("foo", infos, groups, opts)
	assert.Equal(t, []string{"patch"}, result)
}

// prefers disallowedChangeTypes for group over package
func TestGetDisallowedChangeTypes_PrefersGroupOverPackage(t *testing.T) {
	infos := testutil.MakePackageInfosSimple(testRoot, "foo")
	infos["foo"].PackageOptions = &types.PackageOptions{
		DisallowedChangeTypes: []string{"patch"},
	}
	groups := types.PackageGroups{
		"grp1": &types.PackageGroup{
			Name:                  "grp1",
			Packages:              []string{"foo"},
			DisallowedChangeTypes: []string{"major", "minor"},
		},
	}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("foo", infos, groups, opts)
	assert.Equal(t, []string{"major", "minor"}, result)
}
