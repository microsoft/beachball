use anyhow::{bail, Result};

use crate::types::options::BeachballOptions;

use super::commands;

/// Ensure the local repo has shared history with the remote branch for accurate diffing.
pub fn ensure_shared_history(options: &BeachballOptions) -> Result<()> {
    let cwd = &options.path;
    let branch = &options.branch;

    // Check if the branch ref exists locally
    if commands::rev_parse_verify(branch, cwd) {
        // Check if we have shared history
        if commands::merge_base(branch, "HEAD", cwd)?.is_some() {
            return Ok(());
        }
    }

    if !options.fetch {
        if !commands::rev_parse_verify(branch, cwd) {
            bail!("Branch \"{branch}\" does not exist locally and --no-fetch was specified");
        }
        return Ok(());
    }

    // Parse remote/branch
    let (remote, branch_name) = commands::parse_remote_branch(branch)
        .unwrap_or_else(|| ("origin".to_string(), branch.to_string()));

    // Fetch the branch
    if options.verbose {
        eprintln!("Fetching {branch_name} from {remote}...");
    }
    commands::fetch(&remote, &branch_name, cwd, options.depth)?;

    // If shallow, try to deepen until we have shared history
    if commands::is_shallow_repository(cwd) {
        let mut current_depth = options.depth.unwrap_or(100);
        for _ in 0..5 {
            if commands::merge_base(branch, "HEAD", cwd)?.is_some() {
                return Ok(());
            }
            current_depth *= 2;
            if options.verbose {
                eprintln!("Deepening fetch to {current_depth}...");
            }
            commands::fetch(&remote, &branch_name, cwd, Some(current_depth))?;
        }
    }

    Ok(())
}
