package testutil

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Fixture helpers for common repo types.

func writePkgJSON(dir string, pkg map[string]any) {
	data, _ := json.MarshalIndent(pkg, "", "  ")
	os.MkdirAll(dir, 0o755)
	os.WriteFile(filepath.Join(dir, "package.json"), data, 0o644)
}

// SetupSinglePackage sets up a single-package repo fixture.
func SetupSinglePackage(dir string) {
	writePkgJSON(dir, map[string]any{
		"name":    "foo",
		"version": "1.0.0",
		"dependencies": map[string]string{
			"bar": "1.0.0",
			"baz": "1.0.0",
		},
	})
}

// SetupMonorepo sets up a monorepo fixture with multiple packages.
func SetupMonorepo(dir string) {
	writePkgJSON(dir, map[string]any{
		"name":       "monorepo",
		"version":    "1.0.0",
		"private":    true,
		"workspaces": []string{"packages/*"},
	})

	packages := map[string]map[string]any{
		"foo": {"name": "foo", "version": "1.0.0"},
		"bar": {"name": "bar", "version": "1.0.0"},
		"baz": {"name": "baz", "version": "1.0.0"},
		"a":   {"name": "a", "version": "1.0.0"},
		"b":   {"name": "b", "version": "1.0.0"},
	}

	for name, pkg := range packages {
		writePkgJSON(filepath.Join(dir, "packages", name), pkg)
	}
}

// SetupMultiProject sets up a multi-project repo fixture.
func SetupMultiProject(dir string) {
	// Project A
	projA := filepath.Join(dir, "project-a")
	writePkgJSON(projA, map[string]any{
		"name":       "project-a",
		"version":    "1.0.0",
		"private":    true,
		"workspaces": []string{"packages/*"},
	})
	writePkgJSON(filepath.Join(projA, "packages", "foo"), map[string]any{
		"name":    "@project-a/foo",
		"version": "1.0.0",
	})
	writePkgJSON(filepath.Join(projA, "packages", "bar"), map[string]any{
		"name":    "@project-a/bar",
		"version": "1.0.0",
	})

	// Project B
	projB := filepath.Join(dir, "project-b")
	writePkgJSON(projB, map[string]any{
		"name":       "project-b",
		"version":    "1.0.0",
		"private":    true,
		"workspaces": []string{"packages/*"},
	})
	writePkgJSON(filepath.Join(projB, "packages", "foo"), map[string]any{
		"name":    "@project-b/foo",
		"version": "1.0.0",
	})
}

// SetupCustomMonorepo sets up a monorepo with custom package definitions.
func SetupCustomMonorepo(dir string, rootPkg map[string]any, groups map[string]map[string]map[string]any) {
	writePkgJSON(dir, rootPkg)

	for groupDir, packages := range groups {
		for name, pkg := range packages {
			writePkgJSON(filepath.Join(dir, groupDir, name), pkg)
		}
	}
}
