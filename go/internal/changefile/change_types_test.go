package changefile_test

import (
	"testing"

	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/types"
)

func TestGetDisallowedChangeTypes_ReturnsNilForUnknownPackage(t *testing.T) {
	infos := types.PackageInfos{}
	groups := types.PackageGroups{}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("unknown-pkg", infos, groups, opts)
	if result != nil {
		t.Fatalf("expected nil, got: %v", result)
	}
}

func TestGetDisallowedChangeTypes_ReturnsNilWhenNoSettings(t *testing.T) {
	infos := types.PackageInfos{
		"foo": &types.PackageInfo{
			Name:    "foo",
			Version: "1.0.0",
		},
	}
	groups := types.PackageGroups{}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("foo", infos, groups, opts)
	if result != nil {
		t.Fatalf("expected nil, got: %v", result)
	}
}

func TestGetDisallowedChangeTypes_ReturnsPackageLevelDisallowedTypes(t *testing.T) {
	infos := types.PackageInfos{
		"foo": &types.PackageInfo{
			Name:    "foo",
			Version: "1.0.0",
			PackageOptions: &types.PackageOptions{
				DisallowedChangeTypes: []string{"major"},
			},
		},
	}
	groups := types.PackageGroups{}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("foo", infos, groups, opts)
	if len(result) != 1 || result[0] != "major" {
		t.Fatalf("expected [major], got: %v", result)
	}
}

func TestGetDisallowedChangeTypes_ReturnsGroupLevelDisallowedTypes(t *testing.T) {
	infos := types.PackageInfos{
		"foo": &types.PackageInfo{
			Name:    "foo",
			Version: "1.0.0",
		},
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
	if len(result) != 2 || result[0] != "major" || result[1] != "minor" {
		t.Fatalf("expected [major minor], got: %v", result)
	}
}

func TestGetDisallowedChangeTypes_ReturnsNilIfNotInGroup(t *testing.T) {
	infos := types.PackageInfos{
		"bar": &types.PackageInfo{
			Name:    "bar",
			Version: "1.0.0",
		},
	}
	groups := types.PackageGroups{
		"grp1": &types.PackageGroup{
			Name:                  "grp1",
			Packages:              []string{"foo"},
			DisallowedChangeTypes: []string{"major"},
		},
	}
	opts := &types.BeachballOptions{}

	result := changefile.GetDisallowedChangeTypes("bar", infos, groups, opts)
	if result != nil {
		t.Fatalf("expected nil, got: %v", result)
	}
}

func TestGetDisallowedChangeTypes_PrefersPackageOverGroup(t *testing.T) {
	infos := types.PackageInfos{
		"foo": &types.PackageInfo{
			Name:    "foo",
			Version: "1.0.0",
			PackageOptions: &types.PackageOptions{
				DisallowedChangeTypes: []string{"major"},
			},
		},
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
	if len(result) != 1 || result[0] != "major" {
		t.Fatalf("expected [major], got: %v", result)
	}
}
