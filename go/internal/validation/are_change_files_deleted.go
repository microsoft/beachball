package validation

import (
	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/git"
	"github.com/microsoft/beachball/internal/types"
)

// AreChangeFilesDeleted checks if any change files have been deleted.
func AreChangeFilesDeleted(options *types.BeachballOptions) bool {
	changePath := changefile.GetChangePath(options)
	deleted, err := git.GetChangesBetweenRefs(options.Branch, "D", "*.json", changePath)
	if err != nil {
		return false
	}
	return len(deleted) > 0
}
