package types

// BeachballOptions holds all beachball configuration.
// TODO: this mixes RepoOptions and merged options
type BeachballOptions struct {
	All                        bool
	AuthType                   string
	Branch                     string
	ChangeDir                  string
	ChangeHint                 string
	Command                    string
	Commit                     bool
	DependentChangeType        string
	DisallowedChangeTypes      []string
	DisallowDeletedChangeFiles bool
	Fetch                      bool
	GroupChanges               bool
	Groups                     []VersionGroupOptions
	IgnorePatterns             []string
	Message                    string
	Package                    []string
	Path                       string
	Scope                      []string
	Token                      string
	Type                       string
	Verbose                    bool
}

// DefaultOptions returns BeachballOptions with sensible defaults.
// TODO: better default path value, or require path passed?
func DefaultOptions() BeachballOptions {
	return BeachballOptions{
		AuthType:   "authtoken",
		Branch:     "origin/master",
		ChangeDir:  "change",
		ChangeHint: "Run 'beachball change' to create a change file",
		Command:    "change",
		Commit:     true,
		Fetch:      true,
	}
}

// PackageOptions represents beachball-specific options in package.json.
type PackageOptions struct {
	ShouldPublish          *bool    `json:"shouldPublish,omitempty"`
	DisallowedChangeTypes  []string `json:"disallowedChangeTypes,omitempty"`
	DefaultNearestBumpType string   `json:"defaultNearestBumpType,omitempty"`
}

// VersionGroupOptions configures version groups.
type VersionGroupOptions struct {
	Name                  string   `json:"name"`
	Include               []string `json:"include"`
	Exclude               []string `json:"exclude,omitempty"`
	DisallowedChangeTypes []string `json:"disallowedChangeTypes,omitempty"`
}

// CliOptions holds CLI-specific options that override config.
type CliOptions struct {
	All                 *bool
	Branch              string
	Command             string
	ChangeType          string
	Commit              *bool
	ConfigPath          string
	DependentChangeType string
	Fetch               *bool
	Message             string
	Package             []string
	Path                string
	Scope               []string
	Verbose             *bool
}

// ParsedOptions holds the final merged options.
type ParsedOptions struct {
	Options    BeachballOptions
	CliOptions CliOptions
}
