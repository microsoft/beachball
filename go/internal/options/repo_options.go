package options

import (
	"path/filepath"

	"github.com/microsoft/beachball/internal/jsonutil"
	"github.com/microsoft/beachball/internal/types"
)

// RepoConfig represents beachball config found in a JSON file or package.json.
type RepoConfig struct {
	AuthType                   string                      `json:"authType,omitempty"`
	Branch                     string                      `json:"branch,omitempty"`
	ChangeDir                  string                      `json:"changeDir,omitempty"`
	ChangeHint                 string                      `json:"changehint,omitempty"`
	Commit                     *bool                       `json:"commit,omitempty"`
	DependentChangeType        string                      `json:"dependentChangeType,omitempty"`
	DisallowedChangeTypes      []string                    `json:"disallowedChangeTypes,omitempty"`
	DisallowDeletedChangeFiles *bool                       `json:"disallowDeletedChangeFiles,omitempty"`
	Fetch                      *bool                       `json:"fetch,omitempty"`
	GroupChanges               *bool                       `json:"groupChanges,omitempty"`
	IgnorePatterns             []string                    `json:"ignorePatterns,omitempty"`
	Scope                      []string                    `json:"scope,omitempty"`
	Groups                     []types.VersionGroupOptions `json:"groups,omitempty"`
}

// LoadRepoConfig reads the beachball config from projectRoot (absolute path).
// configPath is from an optional CLI arg and may be relative or absolute.
// If configPath is not specified, looks for .beachballrc.json or package.json
// "beachball" field. Returns nil if no config is found.
func LoadRepoConfig(projectRoot string, configPath string) (*RepoConfig, error) {
	if configPath != "" {
		return loadConfigFile(filepath.Join(projectRoot, configPath))
	}

	// Try .beachballrc.json
	rcPath := filepath.Join(projectRoot, ".beachballrc.json")
	if cfg, err := loadConfigFile(rcPath); err == nil {
		return cfg, nil
	}

	// Try package.json "beachball" field
	pkgPath := filepath.Join(projectRoot, "package.json")
	if cfg, err := loadFromPackageJSON(pkgPath); err == nil && cfg != nil {
		return cfg, nil
	}

	return nil, nil
}

func loadConfigFile(path string) (*RepoConfig, error) {
	cfg, err := jsonutil.ReadJSON[RepoConfig](path)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

func loadFromPackageJSON(path string) (*RepoConfig, error) {
	type pkgWithBeachball struct {
		Beachball *RepoConfig `json:"beachball"`
	}
	pkg, err := jsonutil.ReadJSON[pkgWithBeachball](path)
	if err != nil {
		return nil, err
	}
	return pkg.Beachball, nil
}
