package git

import (
	"fmt"
	"strings"

	"github.com/microsoft/beachball/internal/logging"
	"github.com/microsoft/beachball/internal/types"
)

// EnsureSharedHistory ensures the branch ref is available, fetching if needed.
func EnsureSharedHistory(options *types.BeachballOptions) error {
	cwd := options.Path

	if !HasRef(options.Branch, cwd) {
		if !options.Fetch {
			return fmt.Errorf(
				"branch %q does not exist locally. Specify 'fetch: true' in config to auto-fetch",
				options.Branch,
			)
		}

		parts := strings.SplitN(options.Branch, "/", 2)
		if len(parts) != 2 {
			return fmt.Errorf("invalid branch format: %s", options.Branch)
		}

		logging.Info.Printf("Fetching %s from %s...", parts[1], parts[0])
		if err := Fetch(options.Branch, cwd); err != nil {
			return fmt.Errorf("failed to fetch: %w", err)
		}
	}

	if IsShallowClone(cwd) {
		logging.Info.Println("Shallow clone detected, deepening...")
		if err := Deepen(100, cwd); err != nil {
			return fmt.Errorf("failed to deepen: %w", err)
		}
	}

	return nil
}
