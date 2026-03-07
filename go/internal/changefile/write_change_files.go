package changefile

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"

	"github.com/google/uuid"
	"github.com/microsoft/beachball/internal/git"
	"github.com/microsoft/beachball/internal/logging"
	"github.com/microsoft/beachball/internal/types"
)

var nonAlphanumRe = regexp.MustCompile(`[^a-zA-Z0-9@]`)

// WriteChangeFiles writes change files for the given changes.
func WriteChangeFiles(options *types.BeachballOptions, changes []types.ChangeFileInfo) error {
	changePath := GetChangePath(options)
	if err := os.MkdirAll(changePath, 0o755); err != nil {
		return fmt.Errorf("failed to create change directory: %w", err)
	}

	var filePaths []string

	if options.GroupChanges {
		// Write all changes to a single grouped file
		id := uuid.New().String()
		filename := fmt.Sprintf("change-%s.json", id)
		filePath := filepath.Join(changePath, filename)

		grouped := types.ChangeInfoMultiple{Changes: changes}
		data, err := json.MarshalIndent(grouped, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal grouped changes: %w", err)
		}

		if err := os.WriteFile(filePath, append(data, '\n'), 0o644); err != nil {
			return fmt.Errorf("failed to write change file: %w", err)
		}

		filePaths = append(filePaths, filePath)
		logging.Info.Printf("Wrote change file: %s", filename)
	} else {
		for _, change := range changes {
			id := uuid.New().String()
			sanitized := nonAlphanumRe.ReplaceAllString(change.PackageName, "-")
			filename := fmt.Sprintf("%s-%s.json", sanitized, id)
			filePath := filepath.Join(changePath, filename)

			data, err := json.MarshalIndent(change, "", "  ")
			if err != nil {
				return fmt.Errorf("failed to marshal change: %w", err)
			}

			if err := os.WriteFile(filePath, append(data, '\n'), 0o644); err != nil {
				return fmt.Errorf("failed to write change file: %w", err)
			}

			filePaths = append(filePaths, filePath)
			logging.Info.Printf("Wrote change file: %s", filename)
		}
	}

	if len(filePaths) > 0 {
		if err := git.Stage(filePaths, options.Path); err != nil {
			return fmt.Errorf("failed to stage change files: %w", err)
		}

		if options.Commit {
			msg := "Change files"
			if err := git.Commit(msg, options.Path); err != nil {
				return fmt.Errorf("failed to commit change files: %w", err)
			}
			logging.Info.Println("Committed change files")
		}
	}

	return nil
}
