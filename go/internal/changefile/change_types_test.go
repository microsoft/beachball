package changefile_test

import (
	"testing"

	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
	"github.com/stretchr/testify/assert"
)

var testRoot = testutil.FakeRoot()

func TestGetDisallowedChangeTypes_ReturnsNilForUnknownPackage(t *testing.T) {
	infos := types.PackageInfos{}
	groups := types.PackageGroups{}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("unknown-pkg", infos, groups, opts)
	assert.Nil(t, result)
}

func TestGetDisallowedChangeTypes_ReturnsNilWhenNoSettings(t *testing.T) {
	infos := testutil.MakePackageInfosSimple(testRoot, "foo")
	groups := types.PackageGroups{}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("foo", infos, groups, opts)
	assert.Nil(t, result)
}

func TestGetDisallowedChangeTypes_ReturnsPackageLevelDisallowedTypes(t *testing.T) {
	infos := testutil.MakePackageInfosSimple(testRoot, "foo")
	infos["foo"].PackageOptions = &types.PackageOptions{
		DisallowedChangeTypes: []string{"major"},
	}
	groups := types.PackageGroups{}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("foo", infos, groups, opts)
	assert.Equal(t, []string{"major"}, result)
}

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

func TestGetDisallowedChangeTypes_ReturnsNilIfNotInGroup(t *testing.T) {
	infos := testutil.MakePackageInfosSimple(testRoot, "bar")
	groups := types.PackageGroups{
		"grp1": &types.PackageGroup{
			Name:                  "grp1",
			Packages:              []string{"foo"},
			DisallowedChangeTypes: []string{"major"},
		},
	}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("bar", infos, groups, opts)
	assert.Nil(t, result)
}

func TestGetDisallowedChangeTypes_PrefersPackageOverGroup(t *testing.T) {
	infos := testutil.MakePackageInfosSimple(testRoot, "foo")
	infos["foo"].PackageOptions = &types.PackageOptions{
		DisallowedChangeTypes: []string{"major"},
	}
	groups := types.PackageGroups{
		"grp1": &types.PackageGroup{
			Name:                  "grp1",
			Packages:              []string{"foo"},
			DisallowedChangeTypes: []string{"minor"},
		},
	}
	opts := &types.BeachballOptions{}

	// The implementation checks package-level first, so it should return "major"
	result := changefile.GetDisallowedChangeTypes("foo", infos, groups, opts)
	assert.Equal(t, []string{"major"}, result)
}
