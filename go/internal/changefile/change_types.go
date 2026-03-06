package changefile

import "github.com/microsoft/beachball/internal/types"

// GetDisallowedChangeTypes returns the disallowed change types for a package.
func GetDisallowedChangeTypes(
	pkgName string,
	packageInfos types.PackageInfos,
	packageGroups types.PackageGroups,
	options *types.BeachballOptions,
) []string {
	// Check package-level disallowed types
	if info, ok := packageInfos[pkgName]; ok && info.PackageOptions != nil {
		if len(info.PackageOptions.DisallowedChangeTypes) > 0 {
			return info.PackageOptions.DisallowedChangeTypes
		}
	}

	// Check group-level disallowed types
	for _, group := range packageGroups {
		for _, name := range group.Packages {
			if name == pkgName && len(group.DisallowedChangeTypes) > 0 {
				return group.DisallowedChangeTypes
			}
		}
	}

	return nil
}
