package validation

import (
	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/git"
	"github.com/microsoft/beachball/internal/logging"
	"github.com/microsoft/beachball/internal/types"
)

// AreChangeFilesDeleted checks if any change files have been deleted.
func AreChangeFilesDeleted(options *types.BeachballOptions) bool {
	changePath := changefile.GetChangePath(options)

	logging.Info.Printf("Checking for deleted change files against %q", options.Branch)

	deleted, err := git.GetChangesBetweenRefs(options.Branch, "D", "*.json", changePath)
	if err != nil {
		return false
	}

	if len(deleted) > 0 {
		logging.Error.Printf("The following change files were deleted:\n%s",
			logging.BulletedList(deleted))
	}

	return len(deleted) > 0
}
