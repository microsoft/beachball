package monorepo

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/bmatcuk/doublestar/v4"
	"github.com/microsoft/beachball/internal/logging"
	"github.com/microsoft/beachball/internal/types"
)

// GetPackageInfos discovers all packages in the workspace.
func GetPackageInfos(options *types.BeachballOptions) (types.PackageInfos, error) {
	rootPath := options.Path
	infos := make(types.PackageInfos)

	manager := DetectWorkspaceManager(rootPath)
	patterns, literal := GetWorkspacePatterns(rootPath, manager)

	if len(patterns) == 0 {
		// Single package repo: read the root package.json directly
		rootPkgPath := filepath.Join(rootPath, "package.json")
		data, err := os.ReadFile(rootPkgPath)
		if err != nil {
			return nil, err
		}
		var rootPkg types.PackageJson
		if err := json.Unmarshal(data, &rootPkg); err != nil {
			return nil, err
		}
		info := packageInfoFromJSON(&rootPkg, rootPkgPath)
		infos[info.Name] = info
		return infos, nil
	}

	// Monorepo: add root package if it exists
	rootPkgPath := filepath.Join(rootPath, "package.json")
	if data, err := os.ReadFile(rootPkgPath); err == nil {
		var rootPkg types.PackageJson
		if err := json.Unmarshal(data, &rootPkg); err == nil && rootPkg.Name != "" {
			rootInfo := packageInfoFromJSON(&rootPkg, rootPkgPath)
			infos[rootInfo.Name] = rootInfo
		}
	}

	if literal {
		// Rush: patterns are literal paths
		for _, p := range patterns {
			pkgPath := filepath.Join(rootPath, p, "package.json")
			if err := addPackageInfo(infos, pkgPath, rootPath); err != nil {
				return nil, err
			}
		}
	} else {
		// Glob-based managers (npm, yarn, pnpm, lerna)
		for _, pattern := range patterns {
			pkgPattern := filepath.Join(rootPath, pattern, "package.json")
			matches, err := doublestar.FilepathGlob(pkgPattern)
			if err != nil {
				continue
			}
			for _, match := range matches {
				if strings.Contains(match, "node_modules") || strings.Contains(match, "__fixtures__") {
					continue
				}
				if err := addPackageInfo(infos, match, rootPath); err != nil {
					return nil, err
				}
			}
		}
	}

	return infos, nil
}

// addPackageInfo reads a package.json and adds it to infos. Returns error on duplicate names.
func addPackageInfo(infos types.PackageInfos, pkgJsonPath string, rootPath string) error {
	pkgData, err := os.ReadFile(pkgJsonPath)
	if err != nil {
		return nil // skip missing files silently
	}
	var pkg types.PackageJson
	if err := json.Unmarshal(pkgData, &pkg); err != nil {
		return nil // skip unparseable files silently
	}
	absMatch, _ := filepath.Abs(pkgJsonPath)
	info := packageInfoFromJSON(&pkg, absMatch)

	if existing, ok := infos[info.Name]; ok {
		rootRel1, _ := filepath.Rel(rootPath, existing.PackageJSONPath)
		rootRel2, _ := filepath.Rel(rootPath, absMatch)
		logging.Error.Printf("Two packages have the same name %q. Please rename one of these packages:\n%s",
			info.Name, logging.BulletedList([]string{rootRel1, rootRel2}))
		return fmt.Errorf("duplicate package name: %s", info.Name)
	}
	infos[info.Name] = info
	return nil
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
