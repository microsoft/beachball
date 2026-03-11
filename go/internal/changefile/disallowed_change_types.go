package changefile

import (
	"slices"

	"github.com/microsoft/beachball/internal/types"
)

// GetDisallowedChangeTypes returns the disallowed change types for a package.
// Priority: group > package-level > main options (matching TS behavior).
func GetDisallowedChangeTypes(
	pkgName string,
	packageInfos types.PackageInfos,
	packageGroups types.PackageGroups,
	opts *types.BeachballOptions,
) []types.ChangeType {
	// Check group-level disallowed types first (group takes priority)
	for _, group := range packageGroups {
		if group.DisallowedChangeTypes != nil && slices.Contains(group.Packages, pkgName) {
			return group.DisallowedChangeTypes
		}
	}

	// Package is not in a group, so get its own option or the main option
	// TODO: slightly different behavior than JS getPackageOption--it's almost impossible to emulate exactly
	info := packageInfos[pkgName]
	if info != nil && info.PackageOptions != nil && info.PackageOptions.DisallowedChangeTypes != nil {
		return info.PackageOptions.DisallowedChangeTypes
	}

	return opts.DisallowedChangeTypes
}
