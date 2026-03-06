package commands

import (
	"fmt"

	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/git"
	"github.com/microsoft/beachball/internal/types"
	"github.com/microsoft/beachball/internal/validation"
)

// Change runs the change command (non-interactive).
func Change(parsed types.ParsedOptions) error {
	result, err := validation.Validate(parsed, validation.ValidateOptions{
		CheckChangeNeeded:       true,
		AllowMissingChangeFiles: true,
	})
	if err != nil {
		return err
	}

	if !result.IsChangeNeeded {
		fmt.Println("No changes detected; no change files are needed.")
		return nil
	}

	options := &parsed.Options

	changeType, err := types.ParseChangeType(options.Type)
	if err != nil {
		return fmt.Errorf("invalid change type %q: %w", options.Type, err)
	}

	message := options.Message
	if message == "" {
		return fmt.Errorf("--message is required for non-interactive change")
	}

	email := git.GetUserEmail(options.Path)

	depChangeType := changeType
	if options.DependentChangeType != "" {
		depChangeType, err = types.ParseChangeType(options.DependentChangeType)
		if err != nil {
			return fmt.Errorf("invalid dependent change type: %w", err)
		}
	}

	var changes []types.ChangeFileInfo
	for _, pkg := range result.ChangedPackages {
		changes = append(changes, types.ChangeFileInfo{
			Type:                changeType,
			Comment:             message,
			PackageName:         pkg,
			Email:               email,
			DependentChangeType: depChangeType,
		})
	}

	return changefile.WriteChangeFiles(options, changes)
}
