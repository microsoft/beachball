package types

// BeachballOptions holds all beachball configuration.
type BeachballOptions struct {
	All                        bool
	Branch                     string
	Command                    string
	ChangeDir                  string
	ChangeHint                 string
	Commit                     bool
	DependentChangeType        string
	DisallowDeletedChangeFiles bool
	Fetch                      bool
	GroupChanges               bool
	IgnorePatterns             []string
	Message                    string
	Package                    []string
	Path                       string
	Scope                      []string
	Type                       string
	Token                      string
	AuthType                   string
	Verbose                    bool
	Groups                     []VersionGroupOptions
}

// DefaultOptions returns BeachballOptions with sensible defaults.
// TODO: better default path value, or require path passed?
func DefaultOptions() BeachballOptions {
	return BeachballOptions{
		Branch:     "origin/master",
		ChangeDir:  "change",
		ChangeHint: "Run 'beachball change' to create a change file",
		Commit:     true,
		Fetch:      true,
	}
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
	All        *bool
	Branch     string
	Command    string
	ChangeType string
	Commit     *bool
	ConfigPath string
	Fetch      *bool
	Message    string
	Package    []string
	Path       string
	Scope      []string
	Verbose    *bool
}

// ParsedOptions holds the final merged options.
type ParsedOptions struct {
	Options    BeachballOptions
	CliOptions CliOptions
}
