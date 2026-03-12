use clap::Parser;

use crate::types::change_info::ChangeType;
use crate::types::options::CliOptions;

/// Beachball: automated package publishing and change management.
#[derive(Parser, Debug)]
#[command(name = "beachball", version, about)]
pub struct CliArgs {
    /// Command to run (check, change)
    #[arg(default_value = "change")]
    pub command: String,

    /// Target branch
    #[arg(short = 'b', long)]
    pub branch: Option<String>,

    /// Directory for change files
    #[arg(long = "change-dir")]
    pub change_dir: Option<String>,

    /// Path to beachball config file
    #[arg(short = 'c', long = "config-path")]
    pub config_path: Option<String>,

    /// Consider all packages as changed
    #[arg(long)]
    pub all: bool,

    /// Commit change files (use --no-commit to only stage)
    #[arg(long, default_value_t = true, action = clap::ArgAction::Set)]
    pub commit: bool,

    /// Don't commit change files, only stage them
    #[arg(long = "no-commit")]
    pub no_commit: bool,

    /// Fetch from remote before checking
    #[arg(long, default_value_t = true, action = clap::ArgAction::Set)]
    pub fetch: bool,

    /// Don't fetch from remote
    #[arg(long = "no-fetch")]
    pub no_fetch: bool,

    /// Print additional info
    #[arg(long)]
    pub verbose: bool,

    /// Change description for all changed packages
    #[arg(short = 'm', long)]
    pub message: Option<String>,

    /// Change type
    #[arg(long = "type")]
    pub change_type: Option<ChangeType>,

    /// Force change files for specific packages
    #[arg(short = 'p', long = "package")]
    pub package: Option<Vec<String>>,

    /// Only consider packages matching these patterns
    #[arg(long)]
    pub scope: Option<Vec<String>>,

    /// Change types that are not allowed
    #[arg(long = "disallowed-change-types")]
    pub disallowed_change_types: Option<Vec<ChangeType>>,

    /// Hint message when change files are needed
    #[arg(long)]
    pub changehint: Option<String>,

    /// Change type for dependent packages
    #[arg(long = "dependent-change-type")]
    pub dependent_change_type: Option<ChangeType>,

    /// Error if change files are deleted
    #[arg(long = "disallow-deleted-change-files")]
    pub disallow_deleted_change_files: bool,

    /// Put multiple changes in a single changefile
    #[arg(long = "group-changes")]
    pub group_changes: bool,

    /// Depth of git history for shallow clones
    #[arg(long)]
    pub depth: Option<u32>,

    /// Consider changes since this git ref
    #[arg(long = "since", alias = "from-ref")]
    pub from_ref: Option<String>,

    /// Auth type for npm publish
    #[arg(long = "auth-type")]
    pub auth_type: Option<String>,

    /// Auth token
    #[arg(long)]
    pub token: Option<String>,

    /// Skip confirmation prompts
    #[arg(short = 'y', long)]
    pub yes: bool,
}

/// Parse CLI arguments into CliOptions.
pub fn get_cli_options() -> CliOptions {
    get_cli_options_from_args(std::env::args().collect())
}

/// Parse CLI arguments from a specific argv (for testing).
pub fn get_cli_options_from_args(args: Vec<String>) -> CliOptions {
    let cli = CliArgs::parse_from(args);

    CliOptions {
        command: Some(cli.command),
        branch: cli.branch,
        change_dir: cli.change_dir,
        all: if cli.all { Some(true) } else { None },
        commit: if cli.no_commit {
            Some(false)
        } else {
            None // use default
        },
        fetch: if cli.no_fetch {
            Some(false)
        } else {
            None // use default
        },
        verbose: if cli.verbose { Some(true) } else { None },
        message: cli.message,
        change_type: cli.change_type,
        package: cli.package,
        scope: cli.scope,
        disallowed_change_types: cli.disallowed_change_types,
        changehint: cli.changehint,
        dependent_change_type: cli.dependent_change_type,
        disallow_deleted_change_files: if cli.disallow_deleted_change_files {
            Some(true)
        } else {
            None
        },
        group_changes: if cli.group_changes { Some(true) } else { None },
        depth: cli.depth,
        from_ref: cli.from_ref,
        config_path: cli.config_path,
        auth_type: cli.auth_type,
        token: cli.token,
        yes: if cli.yes { Some(true) } else { None },
    }
}
