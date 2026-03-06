package monorepo

import (
	"fmt"
	"path/filepath"

	"github.com/bmatcuk/doublestar/v4"
)

// FilterIgnoredFiles filters out files that match ignore patterns.
// Uses matchBase behavior: patterns without path separators match against the basename.
func FilterIgnoredFiles(files []string, patterns []string, verbose bool) []string {
	var result []string

	for _, file := range files {
		ignored := false
		var matchedPattern string

		for _, pattern := range patterns {
			matched := matchFile(file, pattern)
			if matched {
				ignored = true
				matchedPattern = pattern
				break
			}
		}

		if ignored {
			if verbose {
				fmt.Printf("  - ~~%s~~ (ignored by pattern %q)\n", file, matchedPattern)
			}
		} else {
			result = append(result, file)
		}
	}

	return result
}

// matchFile checks if a file matches a pattern, using matchBase for patterns without slashes.
func matchFile(file, pattern string) bool {
	// If pattern has no path separator, match against basename (matchBase behavior)
	hasSlash := false
	for _, c := range pattern {
		if c == '/' || c == '\\' {
			hasSlash = true
			break
		}
	}

	if !hasSlash {
		base := filepath.Base(file)
		if matched, _ := doublestar.PathMatch(pattern, base); matched {
			return true
		}
	}

	// Try full path match
	if matched, _ := doublestar.PathMatch(pattern, file); matched {
		return true
	}

	// Try with **/ prefix for patterns with path separators
	if hasSlash {
		if matched, _ := doublestar.PathMatch("**/"+pattern, file); matched {
			return true
		}
	}

	return false
}
