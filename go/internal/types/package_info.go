package types

// PackageJson represents a parsed package.json file.
type PackageJson struct {
	Name         string            `json:"name"`
	Version      string            `json:"version"`
	Private      bool              `json:"private"`
	Workspaces   []string          `json:"workspaces,omitempty"`
	Dependencies map[string]string `json:"dependencies,omitempty"`
	Beachball    *PackageOptions   `json:"beachball,omitempty"`
}

// PackageInfo holds information about a single package.
type PackageInfo struct {
	Name            string
	Version         string
	Private         bool
	PackageJSONPath string
	PackageOptions  *PackageOptions
}

// PackageInfos maps package names to their info.
type PackageInfos map[string]*PackageInfo

// ScopedPackages is a set of package names that are in scope.
type ScopedPackages map[string]bool

// PackageGroup represents a version group.
type PackageGroup struct {
	Name                  string
	Packages              []string
	DisallowedChangeTypes []ChangeType
}

// PackageGroups maps group name to group info.
type PackageGroups map[string]*PackageGroup
