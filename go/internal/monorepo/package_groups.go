package monorepo

import (
	"fmt"
	"path/filepath"
	"slices"

	"github.com/bmatcuk/doublestar/v4"
	"github.com/microsoft/beachball/internal/logging"
	"github.com/microsoft/beachball/internal/types"
)

// GetPackageGroups resolves version group options into actual package groups.
func GetPackageGroups(packageInfos types.PackageInfos, rootPath string, groups []types.VersionGroupOptions) types.PackageGroups {
	result := make(types.PackageGroups)

	for _, g := range groups {
		group := &types.PackageGroup{
			Name:                  g.Name,
			DisallowedChangeTypes: g.DisallowedChangeTypes,
		}

		for name, info := range packageInfos {
			pkgDir := filepath.Dir(info.PackageJSONPath)
			relPath, err := filepath.Rel(rootPath, pkgDir)
			if err != nil {
				continue
			}
			// Normalize to forward slashes for cross-platform glob matching
			relPath = filepath.ToSlash(relPath)

			included := false
			for _, pattern := range g.Include {
				if matched, _ := doublestar.PathMatch(pattern, relPath); matched {
					included = true
					break
				}
			}

			if !included {
				continue
			}

			excluded := false
			for _, pattern := range g.Exclude {
				if matched, _ := doublestar.PathMatch(pattern, relPath); matched {
					excluded = true
					break
				}
			}

			if !excluded {
				group.Packages = append(group.Packages, name)
			}
		}

		result[g.Name] = group
	}

	// Check for packages belonging to multiple groups
	packageToGroups := make(map[string][]string)
	for _, group := range result {
		for _, pkg := range group.Packages {
			packageToGroups[pkg] = append(packageToGroups[pkg], group.Name)
		}
	}

	var errorItems []string
	for pkg, groups := range packageToGroups {
		if len(groups) > 1 {
			slices.Sort(groups)
			errorItems = append(errorItems, fmt.Sprintf("%s: %s", pkg, groups))
		}
	}
	if len(errorItems) > 0 {
		slices.Sort(errorItems)
		logging.Error.Printf("Found package(s) belonging to multiple groups:\n%s",
			logging.BulletedList(errorItems))
	}

	return result
}
