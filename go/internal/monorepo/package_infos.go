package monorepo

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/bmatcuk/doublestar/v4"
	"github.com/microsoft/beachball/internal/types"
)

// GetPackageInfos discovers all packages in the workspace.
func GetPackageInfos(options *types.BeachballOptions) (types.PackageInfos, error) {
	rootPath := options.Path
	rootPkgPath := filepath.Join(rootPath, "package.json")

	data, err := os.ReadFile(rootPkgPath)
	if err != nil {
		return nil, err
	}

	var rootPkg types.PackageJson
	if err := json.Unmarshal(data, &rootPkg); err != nil {
		return nil, err
	}

	infos := make(types.PackageInfos)

	if len(rootPkg.Workspaces) == 0 {
		// Single package repo
		info := packageInfoFromJSON(&rootPkg, rootPkgPath)
		infos[info.Name] = info
		return infos, nil
	}

	// Monorepo: add root package
	rootInfo := packageInfoFromJSON(&rootPkg, rootPkgPath)
	infos[rootInfo.Name] = rootInfo

	// Glob for workspace packages
	for _, pattern := range rootPkg.Workspaces {
		pkgPattern := filepath.Join(rootPath, pattern, "package.json")
		// Use doublestar for glob matching
		matches, err := doublestar.FilepathGlob(pkgPattern)
		if err != nil {
			continue
		}
		for _, match := range matches {
			if strings.Contains(match, "node_modules") {
				continue
			}
			pkgData, err := os.ReadFile(match)
			if err != nil {
				continue
			}
			var pkg types.PackageJson
			if err := json.Unmarshal(pkgData, &pkg); err != nil {
				continue
			}
			absMatch, _ := filepath.Abs(match)
			info := packageInfoFromJSON(&pkg, absMatch)
			infos[info.Name] = info
		}
	}

	return infos, nil
}

func packageInfoFromJSON(pkg *types.PackageJson, jsonPath string) *types.PackageInfo {
	absPath, _ := filepath.Abs(jsonPath)
	return &types.PackageInfo{
		Name:            pkg.Name,
		Version:         pkg.Version,
		Private:         pkg.Private,
		PackageJSONPath: absPath,
		PackageOptions:  pkg.Beachball,
	}
}
