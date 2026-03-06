package options

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/microsoft/beachball/internal/git"
	"github.com/microsoft/beachball/internal/types"
)

// RepoConfig represents beachball config found in a JSON file or package.json.
type RepoConfig struct {
	Branch                     string                      `json:"branch,omitempty"`
	ChangeDir                  string                      `json:"changeDir,omitempty"`
	ChangeHint                 string                      `json:"changehint,omitempty"`
	Commit                     *bool                       `json:"commit,omitempty"`
	DependentChangeType        string                      `json:"dependentChangeType,omitempty"`
	DisallowDeletedChangeFiles *bool                       `json:"disallowDeletedChangeFiles,omitempty"`
	Fetch                      *bool                       `json:"fetch,omitempty"`
	GroupChanges               *bool                       `json:"groupChanges,omitempty"`
	IgnorePatterns             []string                    `json:"ignorePatterns,omitempty"`
	Scope                      []string                    `json:"scope,omitempty"`
	Groups                     []types.VersionGroupOptions `json:"groups,omitempty"`
}

// LoadRepoConfig searches for beachball config starting from cwd up to the git root.
func LoadRepoConfig(cwd string, configPath string) (*RepoConfig, error) {
	if configPath != "" {
		return loadConfigFile(configPath)
	}

	gitRoot, err := git.FindGitRoot(cwd)
	if err != nil {
		gitRoot = cwd
	}

	absPath, err := filepath.Abs(cwd)
	if err != nil {
		absPath = cwd
	}
	gitRootAbs, _ := filepath.Abs(gitRoot)

	dir := absPath
	for {
		// Try .beachballrc.json
		rcPath := filepath.Join(dir, ".beachballrc.json")
		if cfg, err := loadConfigFile(rcPath); err == nil {
			return cfg, nil
		}

		// Try package.json "beachball" field
		pkgPath := filepath.Join(dir, "package.json")
		if cfg, err := loadFromPackageJSON(pkgPath); err == nil && cfg != nil {
			return cfg, nil
		}

		if dir == gitRootAbs {
			break
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return nil, nil
}

func loadConfigFile(path string) (*RepoConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg RepoConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func loadFromPackageJSON(path string) (*RepoConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var pkg struct {
		Beachball *RepoConfig `json:"beachball"`
	}
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, err
	}
	return pkg.Beachball, nil
}
