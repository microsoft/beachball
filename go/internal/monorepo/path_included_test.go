package monorepo_test

// Note: Go tests FilterIgnoredFiles (used for ignorePatterns filtering),
// not TS's isPathIncluded (used for scope include/exclude).
// These are related but different functions.

import (
	"testing"

	"github.com/microsoft/beachball/internal/monorepo"
	"github.com/stretchr/testify/assert"
)

func TestFilterIgnoredFiles_MatchesBasenamePatterns(t *testing.T) {
	result := monorepo.FilterIgnoredFiles([]string{"src/foo.test.js"}, []string{"*.test.js"})
	assert.Empty(t, result)
}

func TestFilterIgnoredFiles_MatchesPathPatterns(t *testing.T) {
	result := monorepo.FilterIgnoredFiles([]string{"tests/stuff.js"}, []string{"tests/**"})
	assert.Empty(t, result)
}

func TestFilterIgnoredFiles_DoesNotMatchUnrelatedFiles(t *testing.T) {
	result := monorepo.FilterIgnoredFiles([]string{"src/index.js"}, []string{"*.test.js"})
	assert.Equal(t, []string{"src/index.js"}, result)
}

func TestFilterIgnoredFiles_MatchesChangeDirPattern(t *testing.T) {
	result := monorepo.FilterIgnoredFiles([]string{"change/foo.json"}, []string{"change/*.json"})
	assert.Empty(t, result)
}

func TestFilterIgnoredFiles_MatchesCHANGELOG(t *testing.T) {
	result := monorepo.FilterIgnoredFiles([]string{"packages/foo/CHANGELOG.md"}, []string{"CHANGELOG.md"})
	assert.Empty(t, result)
}

func TestFilterIgnoredFiles_HandlesMultiplePatterns(t *testing.T) {
	files := []string{"src/foo.test.js", "tests/stuff.js", "src/index.js"}
	patterns := []string{"*.test.js", "tests/**"}
	result := monorepo.FilterIgnoredFiles(files, patterns)
	assert.Equal(t, []string{"src/index.js"}, result)
}

func TestFilterIgnoredFiles_KeepsNonMatchingFiles(t *testing.T) {
	files := []string{"src/index.js", "src/foo.test.js", "lib/utils.js", "CHANGELOG.md"}
	patterns := []string{"*.test.js", "CHANGELOG.md"}
	result := monorepo.FilterIgnoredFiles(files, patterns)
	assert.Equal(t, []string{"src/index.js", "lib/utils.js"}, result)
}
