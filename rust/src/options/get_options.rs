use anyhow::Result;

use crate::git::commands;
use crate::types::options::{BeachballOptions, CliOptions, ParsedOptions};

use super::default_options::get_default_options;
use super::repo_options::get_repo_options;

/// Parse and merge all options: defaults <- repo config <- CLI options.
pub fn get_parsed_options(cwd: &str, cli: CliOptions) -> Result<ParsedOptions> {
    let defaults = get_default_options();

    let repo_opts = get_repo_options(cwd, cli.config_path.as_deref())?;

    let mut merged = merge_options(defaults, repo_opts);
    merged = apply_cli_options(merged, &cli);
    merged.path = cwd.to_string();

    // If branch doesn't contain '/', resolve the remote
    if let Some(ref branch) = cli.branch
        && !branch.contains('/')
            && let Ok(default) = commands::get_default_remote_branch(cwd)
                && let Some((remote, _)) = commands::parse_remote_branch(&default) {
                    merged.branch = format!("{remote}/{branch}");
                }

    Ok(ParsedOptions {
        cli_options: cli,
        options: merged,
    })
}

/// For tests: parse options with overrides for repo-level settings.
pub fn get_parsed_options_for_test(
    cwd: &str,
    cli: CliOptions,
    test_repo_options: BeachballOptions,
) -> ParsedOptions {
    let defaults = get_default_options();
    let mut merged = merge_options(defaults, test_repo_options);
    merged = apply_cli_options(merged, &cli);
    merged.path = cwd.to_string();

    ParsedOptions {
        cli_options: cli,
        options: merged,
    }
}

fn merge_options(base: BeachballOptions, overlay: BeachballOptions) -> BeachballOptions {
    // overlay values take precedence over base when they differ from defaults
    BeachballOptions {
        command: overlay.command.clone(),
        branch: if overlay.branch != "origin/master" {
            overlay.branch
        } else {
            base.branch
        },
        change_dir: if overlay.change_dir != "change" {
            overlay.change_dir
        } else {
            base.change_dir
        },
        path: if !overlay.path.is_empty() {
            overlay.path
        } else {
            base.path
        },
        all: overlay.all || base.all,
        commit: overlay.commit,
        fetch: overlay.fetch,
        verbose: overlay.verbose || base.verbose,
        message: if !overlay.message.is_empty() {
            overlay.message
        } else {
            base.message
        },
        change_type: overlay.change_type.or(base.change_type),
        package: overlay.package.or(base.package),
        scope: overlay.scope.or(base.scope),
        ignore_patterns: overlay.ignore_patterns.or(base.ignore_patterns),
        disallowed_change_types: overlay.disallowed_change_types.or(base.disallowed_change_types),
        groups: overlay.groups.or(base.groups),
        changehint: if overlay.changehint
            != "Run \"beachball change\" to create a change file"
        {
            overlay.changehint
        } else {
            base.changehint
        },
        dependent_change_type: overlay.dependent_change_type.or(base.dependent_change_type),
        disallow_deleted_change_files: overlay.disallow_deleted_change_files
            || base.disallow_deleted_change_files,
        group_changes: overlay.group_changes || base.group_changes,
        depth: overlay.depth.or(base.depth),
        from_ref: overlay.from_ref.or(base.from_ref),
        config_path: overlay.config_path.or(base.config_path),
        auth_type: overlay.auth_type.or(base.auth_type),
        token: overlay.token.or(base.token),
        yes: overlay.yes || base.yes,
    }
}

fn apply_cli_options(mut opts: BeachballOptions, cli: &CliOptions) -> BeachballOptions {
    if let Some(ref cmd) = cli.command {
        opts.command = cmd.clone();
    }
    if let Some(ref v) = cli.branch {
        opts.branch = v.clone();
    }
    if let Some(ref v) = cli.change_dir {
        opts.change_dir = v.clone();
    }
    if let Some(v) = cli.all {
        opts.all = v;
    }
    if let Some(v) = cli.commit {
        opts.commit = v;
    }
    if let Some(v) = cli.fetch {
        opts.fetch = v;
    }
    if let Some(v) = cli.verbose {
        opts.verbose = v;
    }
    if let Some(ref v) = cli.message {
        opts.message = v.clone();
    }
    if let Some(v) = cli.change_type {
        opts.change_type = Some(v);
    }
    if let Some(ref v) = cli.package {
        opts.package = Some(v.clone());
    }
    if let Some(ref v) = cli.scope {
        opts.scope = Some(v.clone());
    }
    if let Some(ref v) = cli.disallowed_change_types {
        opts.disallowed_change_types = Some(v.clone());
    }
    if let Some(ref v) = cli.changehint {
        opts.changehint = v.clone();
    }
    if let Some(v) = cli.dependent_change_type {
        opts.dependent_change_type = Some(v);
    }
    if let Some(v) = cli.disallow_deleted_change_files {
        opts.disallow_deleted_change_files = v;
    }
    if let Some(v) = cli.group_changes {
        opts.group_changes = v;
    }
    if let Some(v) = cli.depth {
        opts.depth = Some(v);
    }
    if let Some(ref v) = cli.from_ref {
        opts.from_ref = Some(v.clone());
    }
    if let Some(ref v) = cli.config_path {
        opts.config_path = Some(v.clone());
    }
    if let Some(ref v) = cli.auth_type {
        opts.auth_type = Some(v.clone());
    }
    if let Some(ref v) = cli.token {
        opts.token = Some(v.clone());
    }
    if let Some(v) = cli.yes {
        opts.yes = v;
    }
    opts
}
