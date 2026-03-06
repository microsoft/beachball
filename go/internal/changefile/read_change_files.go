package changefile

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/microsoft/beachball/internal/git"
	"github.com/microsoft/beachball/internal/types"
)

// GetChangePath returns the path to the change directory.
func GetChangePath(options *types.BeachballOptions) string {
	return filepath.Join(options.Path, options.ChangeDir)
}

// ReadChangeFiles reads all change files and returns a ChangeSet.
func ReadChangeFiles(options *types.BeachballOptions, packageInfos types.PackageInfos, scopedPackages types.ScopedPackages) types.ChangeSet {
	changePath := GetChangePath(options)
	if _, err := os.Stat(changePath); os.IsNotExist(err) {
		return nil
	}

	// Get change files from git diff
	changeFiles, err := git.GetChangesBetweenRefs(options.Branch, "A", "*.json", changePath)
	if err != nil {
		return nil
	}

	var changeSet types.ChangeSet

	for _, file := range changeFiles {
		if !strings.HasSuffix(file, ".json") {
			continue
		}

		filePath := filepath.Join(changePath, file)
		data, err := os.ReadFile(filePath)
		if err != nil {
			continue
		}

		// Try multi format first
		var multi types.ChangeInfoMultiple
		if err := json.Unmarshal(data, &multi); err == nil && len(multi.Changes) > 0 {
			for _, change := range multi.Changes {
				if _, ok := packageInfos[change.PackageName]; ok {
					if scopedPackages[change.PackageName] {
						changeSet = append(changeSet, types.ChangeSetEntry{
							Change:     change,
							ChangeFile: file,
						})
					}
				}
			}
			continue
		}

		// Try single format
		var single types.ChangeFileInfo
		if err := json.Unmarshal(data, &single); err == nil && single.PackageName != "" {
			if _, ok := packageInfos[single.PackageName]; ok {
				if scopedPackages[single.PackageName] {
					changeSet = append(changeSet, types.ChangeSetEntry{
						Change:     single,
						ChangeFile: file,
					})
				}
			}
		}
	}

	return changeSet
}
