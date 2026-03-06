package monorepo

import (
	"path/filepath"
	"strings"

	"github.com/bmatcuk/doublestar/v4"
	"github.com/microsoft/beachball/internal/types"
)

// GetScopedPackages returns the set of packages that are in scope.
func GetScopedPackages(options *types.BeachballOptions, packageInfos types.PackageInfos) types.ScopedPackages {
	scoped := make(types.ScopedPackages)

	if len(options.Scope) == 0 {
		// All packages are in scope
		for name := range packageInfos {
			scoped[name] = true
		}
		return scoped
	}

	// Start with all packages, then apply include/exclude patterns
	included := make(map[string]bool)
	excluded := make(map[string]bool)

	for _, pattern := range options.Scope {
		isExclude := strings.HasPrefix(pattern, "!")
		cleanPattern := pattern
		if isExclude {
			cleanPattern = pattern[1:]
		}

		for name, info := range packageInfos {
			pkgDir := filepath.Dir(info.PackageJSONPath)
			// Try matching the pattern against the relative path from the project root
			relPath, err := filepath.Rel(options.Path, pkgDir)
			if err != nil {
				continue
			}

			matched, _ := doublestar.PathMatch(cleanPattern, relPath)
			if !matched {
				matched, _ = doublestar.PathMatch(cleanPattern, name)
			}

			if matched {
				if isExclude {
					excluded[name] = true
				} else {
					included[name] = true
				}
			}
		}
	}

	hasIncludes := false
	for _, pattern := range options.Scope {
		if !strings.HasPrefix(pattern, "!") {
			hasIncludes = true
			break
		}
	}

	if hasIncludes {
		for name := range included {
			if !excluded[name] {
				scoped[name] = true
			}
		}
	} else {
		// Only excludes: start with all and remove excluded
		for name := range packageInfos {
			if !excluded[name] {
				scoped[name] = true
			}
		}
	}

	return scoped
}
