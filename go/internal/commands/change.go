package commands

import (
	"fmt"

	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/git"
	"github.com/microsoft/beachball/internal/logging"
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

	if !result.IsChangeNeeded && len(parsed.Options.Package) == 0 {
		logging.Info.Println("No change files are needed")
		return nil
	}

	options := &parsed.Options

	changeType := options.Type
	if changeType == "" {
		return fmt.Errorf("--type is required for non-interactive change")
	}

	message := options.Message
	if message == "" {
		return fmt.Errorf("--message is required for non-interactive change")
	}

	email := git.GetUserEmail(options.Path)

	depChangeType := changeType
	if options.DependentChangeType != "" {
		depChangeType = options.DependentChangeType
	}

	changedPackages := result.ChangedPackages
	if len(changedPackages) == 0 && len(options.Package) > 0 {
		changedPackages = options.Package
	}

	if len(changedPackages) == 0 {
		return nil
	}

	var changes []types.ChangeFileInfo
	for _, pkg := range changedPackages {
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
