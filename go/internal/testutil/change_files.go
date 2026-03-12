package testutil

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/microsoft/beachball/internal/types"
)

const FakeEmail = "test@test.com"

// WriteChangeFilesFn is the function used by GenerateChangeFiles to write change files.
// Tests must set this to changefile.WriteChangeFiles to break the import cycle.
// Example: testutil.WriteChangeFilesFn = changefile.WriteChangeFiles
var WriteChangeFilesFn func(options *types.BeachballOptions, changes []types.ChangeFileInfo) error

// GetChange creates a ChangeFileInfo with sensible defaults.
// Mirrors the TS getChange fixture helper.
func GetChange(packageName string, comment string, changeType types.ChangeType) types.ChangeFileInfo {
	if comment == "" {
		comment = packageName + " comment"
	}
	if changeType == "" {
		changeType = types.ChangeTypeMinor
	}
	return types.ChangeFileInfo{
		Type:                changeType,
		Comment:             comment,
		PackageName:         packageName,
		Email:               FakeEmail,
		DependentChangeType: types.ChangeTypePatch,
	}
}

// GenerateChanges creates ChangeFileInfo entries from package names with defaults.
// Mirrors the TS generateChanges fixture helper.
func GenerateChanges(packages []string) []types.ChangeFileInfo {
	changes := make([]types.ChangeFileInfo, len(packages))
	for i, pkg := range packages {
		changes[i] = GetChange(pkg, "", "")
	}
	return changes
}

// GenerateChangeFiles creates change files for the given packages using the real
// WriteChangeFiles implementation. Mirrors the TS generateChangeFiles fixture helper.
// WriteChangeFilesFn must be set before calling this function.
func GenerateChangeFiles(t *testing.T, packages []string, options *types.BeachballOptions, repo *Repository) {
	t.Helper()

	if WriteChangeFilesFn == nil {
		t.Fatal("testutil.WriteChangeFilesFn must be set (e.g. testutil.WriteChangeFilesFn = changefile.WriteChangeFiles)")
	}

	changes := make([]types.ChangeFileInfo, len(packages))
	for i, pkg := range packages {
		changes[i] = GetChange(pkg, "test change", types.ChangeTypePatch)
	}

	if err := WriteChangeFilesFn(options, changes); err != nil {
		t.Fatalf("failed to write change files: %v", err)
	}
}

// GetChangeFiles returns the list of change file paths.
func GetChangeFiles(options *types.BeachballOptions) []string {
	changePath := filepath.Join(options.Path, options.ChangeDir)
	entries, err := os.ReadDir(changePath)
	if err != nil {
		return nil
	}

	var files []string
	for _, entry := range entries {
		if filepath.Ext(entry.Name()) == ".json" {
			files = append(files, filepath.Join(changePath, entry.Name()))
		}
	}
	return files
}
