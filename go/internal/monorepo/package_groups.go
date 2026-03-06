package monorepo

import (
	"path/filepath"

	"github.com/bmatcuk/doublestar/v4"
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

	return result
}