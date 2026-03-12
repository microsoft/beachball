use super::change_info::ChangeType;

/// Options for bumping package versions together.
#[derive(Debug, Clone)]
pub struct VersionGroupOptions {
    pub name: String,
    /// Patterns for package paths to include. `None` means include all (equivalent to `true` in TS).
    pub include: VersionGroupInclude,
    /// Patterns for package paths to exclude.
    pub exclude: Option<Vec<String>>,
    pub disallowed_change_types: Option<Vec<ChangeType>>,
}

#[derive(Debug, Clone)]
pub enum VersionGroupInclude {
    /// Include all packages (equivalent to `true` in TS).
    All,
    /// Include packages matching these patterns.
    Patterns(Vec<String>),
}

/// Merged beachball options (CLI + repo config + defaults).
#[derive(Debug, Clone)]
pub struct BeachballOptions {
    pub command: String,
    pub branch: String,
    pub change_dir: String,
    pub path: String,
    pub all: bool,
    pub commit: bool,
    pub fetch: bool,
    pub verbose: bool,
    pub message: String,
    pub change_type: Option<ChangeType>,
    pub package: Option<Vec<String>>,
    pub scope: Option<Vec<String>>,
    pub ignore_patterns: Option<Vec<String>>,
    pub disallowed_change_types: Option<Vec<ChangeType>>,
    pub groups: Option<Vec<VersionGroupOptions>>,
    pub changehint: String,
    pub dependent_change_type: Option<ChangeType>,
    pub disallow_deleted_change_files: bool,
    pub group_changes: bool,
    pub depth: Option<u32>,
    pub from_ref: Option<String>,
    pub config_path: Option<String>,
    pub auth_type: Option<String>,
    pub token: Option<String>,
    pub yes: bool,
}

impl Default for BeachballOptions {
    fn default() -> Self {
        Self {
            command: "change".to_string(),
            branch: "origin/master".to_string(),
            change_dir: "change".to_string(),
            path: String::new(),
            all: false,
            commit: true,
            fetch: true,
            verbose: false,
            message: String::new(),
            change_type: None,
            package: None,
            scope: None,
            ignore_patterns: None,
            disallowed_change_types: None,
            groups: None,
            changehint: "Run \"beachball change\" to create a change file".to_string(),
            dependent_change_type: None,
            disallow_deleted_change_files: false,
            group_changes: false,
            depth: None,
            from_ref: None,
            config_path: None,
            auth_type: None,
            token: None,
            yes: std::env::var("CI").is_ok(),
        }
    }
}

/// Separate CLI-only options from merged options.
#[derive(Debug, Clone)]
pub struct ParsedOptions {
    pub cli_options: CliOptions,
    pub options: BeachballOptions,
}

/// CLI-only option values (before merging with defaults/repo config).
#[derive(Debug, Clone, Default)]
pub struct CliOptions {
    pub command: Option<String>,
    pub branch: Option<String>,
    pub change_dir: Option<String>,
    pub all: Option<bool>,
    pub commit: Option<bool>,
    pub fetch: Option<bool>,
    pub verbose: Option<bool>,
    pub message: Option<String>,
    pub change_type: Option<ChangeType>,
    pub package: Option<Vec<String>>,
    pub scope: Option<Vec<String>>,
    pub disallowed_change_types: Option<Vec<ChangeType>>,
    pub changehint: Option<String>,
    pub dependent_change_type: Option<ChangeType>,
    pub disallow_deleted_change_files: Option<bool>,
    pub group_changes: Option<bool>,
    pub depth: Option<u32>,
    pub from_ref: Option<String>,
    pub config_path: Option<String>,
    pub auth_type: Option<String>,
    pub token: Option<String>,
    pub yes: Option<bool>,
}
