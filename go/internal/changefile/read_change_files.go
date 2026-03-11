package changefile

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/microsoft/beachball/internal/git"
	"github.com/microsoft/beachball/internal/logging"
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
			logging.Warn.Printf("Error reading change file %s: %v", filePath, err)
			continue
		}

		// Try to parse as multi or single change file
		var changes []types.ChangeFileInfo

		var multi types.ChangeInfoMultiple
		if err := json.Unmarshal(data, &multi); err == nil && len(multi.Changes) > 0 {
			changes = multi.Changes
		} else {
			var single types.ChangeFileInfo
			if err := json.Unmarshal(data, &single); err == nil && single.PackageName != "" {
				changes = []types.ChangeFileInfo{single}
			} else {
				logging.Warn.Printf("%s does not appear to be a change file", filePath)
				continue
			}
		}

		// Filter changes: warn about nonexistent/private packages, include only valid in-scope ones
		for _, change := range changes {
			info, exists := packageInfos[change.PackageName]
			var warningType string
			if !exists {
				warningType = "nonexistent"
			} else if info.Private {
				warningType = "private"
			}

			if warningType != "" {
				resolution := "delete this file"
				if options.GroupChanges {
					resolution = "remove the entry from this file"
				}
				logging.Warn.Printf("Change detected for %s package %s; %s: %s",
					warningType, change.PackageName, resolution, filePath)
				continue
			}

			if scopedPackages[change.PackageName] {
				changeSet = append(changeSet, types.ChangeSetEntry{
					Change:     change,
					ChangeFile: file,
				})
			}
		}
	}

	return changeSet
}
