package monorepo

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/microsoft/beachball/internal/git"
	"gopkg.in/yaml.v3"
)

// WorkspaceManager identifies a monorepo/workspace manager.
type WorkspaceManager string

const (
	ManagerNpm   WorkspaceManager = "npm"
	ManagerYarn  WorkspaceManager = "yarn"
	ManagerPnpm  WorkspaceManager = "pnpm"
	ManagerLerna WorkspaceManager = "lerna"
	ManagerRush  WorkspaceManager = "rush"
)

// managerByFile maps config file names to their manager, in precedence order
// matching workspace-tools.
var managerByFile = map[string]WorkspaceManager{
	"lerna.json":           ManagerLerna,
	"rush.json":            ManagerRush,
	"yarn.lock":            ManagerYarn,
	"pnpm-workspace.yaml":  ManagerPnpm,
	"package-lock.json":    ManagerNpm,
}

// DetectWorkspaceManager determines the workspace manager for the given root directory.
func DetectWorkspaceManager(rootPath string) WorkspaceManager {
	// Check in precedence order (matching git.ManagerFiles)
	for _, file := range git.ManagerFiles {
		if _, err := os.Stat(filepath.Join(rootPath, file)); err == nil {
			return managerByFile[file]
		}
	}
	// Default to npm if package.json exists with workspaces
	return ManagerNpm
}

// GetWorkspacePatterns returns the workspace glob patterns (or literal paths for rush)
// for the detected manager at rootPath.
func GetWorkspacePatterns(rootPath string, manager WorkspaceManager) (patterns []string, literal bool) {
	switch manager {
	case ManagerPnpm:
		return getPnpmPatterns(rootPath), false
	case ManagerLerna:
		return getLernaPatterns(rootPath), false
	case ManagerRush:
		return getRushPaths(rootPath), true
	default: // npm, yarn
		return getNpmYarnPatterns(rootPath), false
	}
}

// getNpmYarnPatterns reads workspace patterns from package.json workspaces field.
func getNpmYarnPatterns(rootPath string) []string {
	data, err := os.ReadFile(filepath.Join(rootPath, "package.json"))
	if err != nil {
		return nil
	}

	// Try array format: "workspaces": ["packages/*"]
	var arrayFormat struct {
		Workspaces []string `json:"workspaces"`
	}
	if err := json.Unmarshal(data, &arrayFormat); err == nil && len(arrayFormat.Workspaces) > 0 {
		return arrayFormat.Workspaces
	}

	// Try object format: "workspaces": {"packages": ["packages/*"]}
	var objectFormat struct {
		Workspaces struct {
			Packages []string `json:"packages"`
		} `json:"workspaces"`
	}
	if err := json.Unmarshal(data, &objectFormat); err == nil && len(objectFormat.Workspaces.Packages) > 0 {
		return objectFormat.Workspaces.Packages
	}

	return nil
}

// getPnpmPatterns reads workspace patterns from pnpm-workspace.yaml.
func getPnpmPatterns(rootPath string) []string {
	data, err := os.ReadFile(filepath.Join(rootPath, "pnpm-workspace.yaml"))
	if err != nil {
		return nil
	}
	var config struct {
		Packages []string `yaml:"packages"`
	}
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil
	}
	return config.Packages
}

// getLernaPatterns reads workspace patterns from lerna.json.
// Falls back to npm/yarn/pnpm if lerna.json doesn't specify packages.
func getLernaPatterns(rootPath string) []string {
	data, err := os.ReadFile(filepath.Join(rootPath, "lerna.json"))
	if err != nil {
		return nil
	}
	var config struct {
		Packages []string `json:"packages"`
	}
	if err := json.Unmarshal(data, &config); err != nil {
		return nil
	}
	if len(config.Packages) > 0 {
		return config.Packages
	}

	// Lerna without packages: delegate to the actual package manager
	if _, err := os.Stat(filepath.Join(rootPath, "pnpm-workspace.yaml")); err == nil {
		return getPnpmPatterns(rootPath)
	}
	return getNpmYarnPatterns(rootPath)
}

// getRushPaths reads project paths from rush.json (literal paths, not globs).
func getRushPaths(rootPath string) []string {
	data, err := os.ReadFile(filepath.Join(rootPath, "rush.json"))
	if err != nil {
		return nil
	}
	var config struct {
		Projects []struct {
			ProjectFolder string `json:"projectFolder"`
		} `json:"projects"`
	}
	if err := json.Unmarshal(data, &config); err != nil {
		return nil
	}
	paths := make([]string, len(config.Projects))
	for i, p := range config.Projects {
		paths[i] = p.ProjectFolder
	}
	return paths
}
