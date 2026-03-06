package testutil

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"testing"

	"github.com/google/uuid"
	"github.com/microsoft/beachball/internal/types"
)

var nonAlphanumRe = regexp.MustCompile(`[^a-zA-Z0-9@]`)

// GenerateChangeFiles creates change files for the given packages and commits them.
func GenerateChangeFiles(t *testing.T, packages []string, options *types.BeachballOptions, repo *Repository) {
	t.Helper()

	changePath := filepath.Join(options.Path, options.ChangeDir)
	os.MkdirAll(changePath, 0o755)

	for _, pkg := range packages {
		id := uuid.New().String()
		sanitized := nonAlphanumRe.ReplaceAllString(pkg, "-")
		filename := sanitized + "-" + id + ".json"
		filePath := filepath.Join(changePath, filename)

		change := types.ChangeFileInfo{
			Type:                types.ChangeTypePatch,
			Comment:             "test change",
			PackageName:         pkg,
			Email:               "test@test.com",
			DependentChangeType: types.ChangeTypePatch,
		}

		data, _ := json.MarshalIndent(change, "", "  ")
		if err := os.WriteFile(filePath, data, 0o644); err != nil {
			t.Fatalf("failed to write change file: %v", err)
		}
	}

	repo.Git([]string{"add", "-A"})
	if options.Commit {
		repo.Git([]string{"commit", "-m", "Change files"})
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
