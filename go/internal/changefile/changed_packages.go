package changefile

import (
	"encoding/json"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"slices"

	"github.com/microsoft/beachball/internal/git"
	"github.com/microsoft/beachball/internal/logging"
	"github.com/microsoft/beachball/internal/monorepo"
	"github.com/microsoft/beachball/internal/types"
)

// isPackageIncluded checks whether a package should be included in changed packages.
func isPackageIncluded(info *types.PackageInfo, scopedPackages types.ScopedPackages) (bool, string) {
	if info == nil {
		return false, "no corresponding package found"
	}
	if info.Private {
		return false, fmt.Sprintf("%s is private", info.Name)
	}
	if info.PackageOptions != nil && info.PackageOptions.ShouldPublish != nil && !*info.PackageOptions.ShouldPublish {
		return false, fmt.Sprintf("%s has beachball.shouldPublish=false", info.Name)
	}
	if !scopedPackages[info.Name] {
		return false, fmt.Sprintf("%s is out of scope", info.Name)
	}
	return true, ""
}

// getMatchingPackage finds which package a changed file belongs to.
func getMatchingPackage(file, cwd string, packagesByPath map[string]*types.PackageInfo) *types.PackageInfo {
	absFile := filepath.Join(cwd, file)
	dir := filepath.Dir(absFile)

	for {
		if info, ok := packagesByPath[dir]; ok {
			return info
		}
		if dir == cwd {
			break
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return nil
}

// getAllChangedPackages returns all changed packages regardless of existing change files.
func getAllChangedPackages(options *types.BeachballOptions, packageInfos types.PackageInfos, scopedPackages types.ScopedPackages) ([]string, error) {
	cwd := options.Path
	verbose := options.Verbose

	if options.All {
		if verbose {
			logging.Info.Println("--all option was provided, so including all packages that are in scope (regardless of changes)")
		}
		var result []string
		for _, pkg := range packageInfos {
			included, _ := isPackageIncluded(pkg, scopedPackages)
			if included {
				result = append(result, pkg.Name)
			}
		}
		return result, nil
	}

	logging.Info.Printf("Checking for changes against %q", options.Branch)

	if err := git.EnsureSharedHistory(options); err != nil {
		return nil, err
	}

	// Canonicalize cwd for consistent path matching
	canonicalCwd, err := filepath.EvalSymlinks(cwd)
	if err != nil {
		canonicalCwd = cwd
	}

	changes, err := git.GetBranchChanges(options.Branch, cwd)
	if err != nil {
		return nil, err
	}
	staged, err := git.GetStagedChanges(cwd)
	if err != nil {
		return nil, err
	}
	changes = append(changes, staged...)

	if verbose {
		count := len(changes)
		s := "s"
		if count == 1 {
			s = ""
		}
		logging.Info.Printf("Found %d changed file%s in current branch (before filtering)", count, s)
	}

	if len(changes) == 0 {
		return nil, nil
	}

	// Build ignore patterns
	ignorePatterns := append([]string{}, options.IgnorePatterns...)
	ignorePatterns = append(ignorePatterns, fmt.Sprintf("%s/*.json", options.ChangeDir))
	ignorePatterns = append(ignorePatterns, "CHANGELOG.md", "CHANGELOG.json")

	nonIgnored := monorepo.FilterIgnoredFiles(changes, ignorePatterns, verbose)

	if len(nonIgnored) == 0 {
		if verbose {
			logging.Info.Println("All files were ignored")
		}
		return nil, nil
	}

	// Build map from package directory path to PackageInfo (canonicalized)
	packagesByPath := make(map[string]*types.PackageInfo)
	for _, info := range packageInfos {
		dir := filepath.Dir(info.PackageJSONPath)
		canonical, err := filepath.EvalSymlinks(dir)
		if err != nil {
			canonical = dir
		}
		packagesByPath[canonical] = info
	}

	includedPackages := make(map[string]bool)
	fileCount := 0

	for _, file := range nonIgnored {
		pkgInfo := getMatchingPackage(file, canonicalCwd, packagesByPath)
		included, reason := isPackageIncluded(pkgInfo, scopedPackages)

		if !included {
			if verbose {
				logging.Info.Printf("  - ~~%s~~ (%s)", file, reason)
			}
		} else {
			includedPackages[pkgInfo.Name] = true
			fileCount++
			if verbose {
				logging.Info.Printf("  - %s", file)
			}
		}
	}

	if verbose {
		pkgCount := len(includedPackages)
		fs := "s"
		if fileCount == 1 {
			fs = ""
		}
		ps := "s"
		if pkgCount == 1 {
			ps = ""
		}
		logging.Info.Printf("Found %d file%s in %d package%s that should be published", fileCount, fs, pkgCount, ps)
	}

	var result []string
	for name := range includedPackages {
		result = append(result, name)
	}
	return result, nil
}

// GetChangedPackages returns changed packages that don't already have change files.
func GetChangedPackages(options *types.BeachballOptions, packageInfos types.PackageInfos, scopedPackages types.ScopedPackages) ([]string, error) {
	// If --package is specified, return those names directly
	if len(options.Package) > 0 {
		return options.Package, nil
	}

	changedPackages, err := getAllChangedPackages(options, packageInfos, scopedPackages)
	if err != nil {
		return nil, err
	}

	changePath := GetChangePath(options)
	if _, err := os.Stat(changePath); os.IsNotExist(err) {
		return changedPackages, nil
	}

	// Check which packages already have change files
	changeFiles, err := git.GetChangesBetweenRefs(options.Branch, "A", "*.json", changePath)
	if err != nil {
		changeFiles = nil
	}

	existingPackages := make(map[string]bool)

	for _, file := range changeFiles {
		filePath := filepath.Join(changePath, file)
		data, err := os.ReadFile(filePath)
		if err != nil {
			continue
		}

		var multi types.ChangeInfoMultiple
		if err := json.Unmarshal(data, &multi); err == nil && len(multi.Changes) > 0 {
			for _, change := range multi.Changes {
				existingPackages[change.PackageName] = true
			}
			continue
		}

		var single types.ChangeFileInfo
		if err := json.Unmarshal(data, &single); err == nil && single.PackageName != "" {
			existingPackages[single.PackageName] = true
		}
	}

	if len(existingPackages) > 0 {
		sorted := slices.Sorted(maps.Keys(existingPackages))
		logging.Info.Printf("Your local repository already has change files for these packages:\n%s",
			logging.BulletedList(sorted))
	}

	var result []string
	for _, pkg := range changedPackages {
		if !existingPackages[pkg] {
			result = append(result, pkg)
		}
	}
	return result, nil
}
