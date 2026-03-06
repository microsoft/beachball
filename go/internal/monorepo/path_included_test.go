package monorepo_test

import (
	"testing"

	"github.com/microsoft/beachball/internal/monorepo"
)

func TestFilterIgnoredFiles_MatchesBasenamePatterns(t *testing.T) {
	result := monorepo.FilterIgnoredFiles([]string{"src/foo.test.js"}, []string{"*.test.js"}, false)
	if len(result) != 0 {
		t.Fatalf("expected empty result, got: %v", result)
	}
}

func TestFilterIgnoredFiles_MatchesPathPatterns(t *testing.T) {
	result := monorepo.FilterIgnoredFiles([]string{"tests/stuff.js"}, []string{"tests/**"}, false)
	if len(result) != 0 {
		t.Fatalf("expected empty result, got: %v", result)
	}
}

func TestFilterIgnoredFiles_DoesNotMatchUnrelatedFiles(t *testing.T) {
	result := monorepo.FilterIgnoredFiles([]string{"src/index.js"}, []string{"*.test.js"}, false)
	if len(result) != 1 || result[0] != "src/index.js" {
		t.Fatalf("expected [src/index.js], got: %v", result)
	}
}

func TestFilterIgnoredFiles_MatchesChangeDirPattern(t *testing.T) {
	result := monorepo.FilterIgnoredFiles([]string{"change/foo.json"}, []string{"change/*.json"}, false)
	if len(result) != 0 {
		t.Fatalf("expected empty result, got: %v", result)
	}
}

func TestFilterIgnoredFiles_MatchesCHANGELOG(t *testing.T) {
	result := monorepo.FilterIgnoredFiles([]string{"packages/foo/CHANGELOG.md"}, []string{"CHANGELOG.md"}, false)
	if len(result) != 0 {
		t.Fatalf("expected empty result, got: %v", result)
	}
}

func TestFilterIgnoredFiles_HandlesMultiplePatterns(t *testing.T) {
	files := []string{"src/foo.test.js", "tests/stuff.js", "src/index.js"}
	patterns := []string{"*.test.js", "tests/**"}
	result := monorepo.FilterIgnoredFiles(files, patterns, false)
	if len(result) != 1 || result[0] != "src/index.js" {
		t.Fatalf("expected [src/index.js], got: %v", result)
	}
}

func TestFilterIgnoredFiles_KeepsNonMatchingFiles(t *testing.T) {
	files := []string{"src/index.js", "src/foo.test.js", "lib/utils.js", "CHANGELOG.md"}
	patterns := []string{"*.test.js", "CHANGELOG.md"}
	result := monorepo.FilterIgnoredFiles(files, patterns, false)
	if len(result) != 2 {
		t.Fatalf("expected 2 results, got: %v", result)
	}
	if result[0] != "src/index.js" || result[1] != "lib/utils.js" {
		t.Fatalf("expected [src/index.js lib/utils.js], got: %v", result)
	}
}
