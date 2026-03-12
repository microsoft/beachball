package commands

import (
	"github.com/microsoft/beachball/internal/logging"
	"github.com/microsoft/beachball/internal/types"
	"github.com/microsoft/beachball/internal/validation"
)

// Check runs the check command.
func Check(parsed types.ParsedOptions) error {
	_, err := validation.Validate(parsed, validation.ValidateOptions{
		CheckChangeNeeded: true,
	})
	if err != nil {
		return err
	}

	logging.Info.Println("No change files are needed")
	return nil
}
