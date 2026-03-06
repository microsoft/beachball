#[allow(dead_code)]
pub mod change_files;
#[allow(dead_code)]
pub mod fixtures;
#[allow(dead_code)]
pub mod repository;
#[allow(dead_code)]
pub mod repository_factory;

use std::process::Command;

use beachball::options::get_options::get_parsed_options_for_test;
use beachball::types::options::{BeachballOptions, CliOptions};

#[allow(dead_code)]
pub const DEFAULT_BRANCH: &str = "master";
#[allow(dead_code)]
pub const DEFAULT_REMOTE_BRANCH: &str = "origin/master";

/// Run a git command in the given directory.
pub fn run_git(args: &[&str], cwd: &str) -> String {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .unwrap_or_else(|e| panic!("Failed to run git {}: {e}", args.join(" ")));

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.contains("already exists") && !stderr.contains("nothing to commit") {
            panic!("git {} failed in {cwd}: {}", args.join(" "), stderr);
        }
    }

    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

/// Build merged options for a test repo. Applies default branch/fetch settings.
#[allow(dead_code)]
pub fn make_test_options(cwd: &str, overrides: Option<BeachballOptions>) -> BeachballOptions {
    let cli = CliOptions::default();
    let mut repo_opts = overrides.unwrap_or_default();
    repo_opts.branch = DEFAULT_REMOTE_BRANCH.to_string();
    repo_opts.fetch = false;

    let parsed = get_parsed_options_for_test(cwd, cli, repo_opts);
    parsed.options
}
