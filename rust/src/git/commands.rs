use anyhow::{bail, Context, Result};
use std::path::Path;
use std::process::Command;

/// Result of running a git command.
#[derive(Debug)]
pub struct GitResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Run a git command and return the result.
pub fn git(args: &[&str], cwd: &str) -> Result<GitResult> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .with_context(|| format!("failed to run git {}", args.join(" ")))?;

    Ok(GitResult {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

/// Run a git command and return stdout, failing if the command fails.
pub fn git_stdout(args: &[&str], cwd: &str) -> Result<String> {
    let result = git(args, cwd)?;
    if !result.success {
        bail!(
            "git {} failed (exit {}): {}",
            args.join(" "),
            result.exit_code,
            result.stderr
        );
    }
    Ok(result.stdout)
}

/// Find the git root directory.
pub fn find_git_root(cwd: &str) -> Result<String> {
    git_stdout(&["rev-parse", "--show-toplevel"], cwd)
}

/// Find the project root (directory with package.json containing "workspaces", or git root).
pub fn find_project_root(cwd: &str) -> Result<String> {
    let git_root = find_git_root(cwd)?;

    // Walk from cwd up to git root looking for package.json with workspaces
    let mut dir = Path::new(cwd).to_path_buf();
    let git_root_path = Path::new(&git_root);

    loop {
        let pkg_json = dir.join("package.json");
        if pkg_json.exists() {
            if let Ok(contents) = std::fs::read_to_string(&pkg_json) {
                if let Ok(pkg) =
                    serde_json::from_str::<crate::types::package_info::PackageJson>(&contents)
                {
                    if pkg.workspaces.is_some() {
                        return Ok(dir.to_string_lossy().to_string());
                    }
                }
            }
        }

        if dir == git_root_path {
            break;
        }
        if !dir.pop() {
            break;
        }
    }

    // Fall back to git root
    Ok(git_root)
}

/// Get the current branch name.
pub fn get_branch_name(cwd: &str) -> Result<Option<String>> {
    let result = git(&["rev-parse", "--abbrev-ref", "HEAD"], cwd)?;
    if result.success {
        Ok(Some(result.stdout))
    } else {
        Ok(None)
    }
}

/// Get the user's email from git config.
pub fn get_user_email(cwd: &str) -> Option<String> {
    git_stdout(&["config", "user.email"], cwd).ok()
}

/// Get files changed between the current branch and the target branch.
pub fn get_branch_changes(branch: &str, cwd: &str) -> Result<Vec<String>> {
    let result = git(
        &["--no-pager", "diff", "--name-only", "--relative", "--no-renames", &format!("{branch}...")],
        cwd,
    )?;
    if !result.success {
        return Ok(vec![]);
    }
    Ok(result
        .stdout
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect())
}

/// Get staged changes.
pub fn get_staged_changes(cwd: &str) -> Result<Vec<String>> {
    let result = git(&["--no-pager", "diff", "--cached", "--name-only", "--relative", "--no-renames"], cwd)?;
    if !result.success {
        return Ok(vec![]);
    }
    Ok(result
        .stdout
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect())
}

/// Get changes between two refs, optionally filtering by pattern and diff filter.
pub fn get_changes_between_refs(
    from_ref: &str,
    diff_filter: Option<&str>,
    pattern: Option<&str>,
    cwd: &str,
) -> Result<Vec<String>> {
    let diff_flag = diff_filter.map(|f| format!("--diff-filter={f}"));
    let range = format!("{from_ref}...");
    let mut args: Vec<&str> = vec!["--no-pager", "diff", "--name-only", "--relative", "--no-renames"];
    if let Some(ref flag) = diff_flag {
        args.push(flag);
    }
    args.push(&range);
    if let Some(pat) = pattern {
        args.push("--");
        args.push(pat);
    }

    let result = git(&args, cwd)?;
    if !result.success {
        return Ok(vec![]);
    }
    Ok(result
        .stdout
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect())
}

/// Get untracked files.
pub fn get_untracked_changes(cwd: &str) -> Result<Vec<String>> {
    let result = git(&["ls-files", "--others", "--exclude-standard"], cwd)?;
    Ok(result
        .stdout
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect())
}

/// Stage files.
pub fn stage(patterns: &[&str], cwd: &str) -> Result<()> {
    let mut args = vec!["add"];
    args.extend(patterns);
    git_stdout(&args, cwd)?;
    Ok(())
}

/// Commit with a message. Extra options can be passed (e.g. --only path).
pub fn commit(message: &str, cwd: &str, extra_options: &[&str]) -> Result<()> {
    let mut args = vec!["commit", "-m", message];
    args.extend(extra_options);
    git_stdout(&args, cwd)?;
    Ok(())
}

/// Check if a ref exists.
pub fn rev_parse_verify(reference: &str, cwd: &str) -> bool {
    git(&["rev-parse", "--verify", reference], cwd)
        .map(|r| r.success)
        .unwrap_or(false)
}

/// Check if the repository is a shallow clone.
pub fn is_shallow_repository(cwd: &str) -> bool {
    git_stdout(&["rev-parse", "--is-shallow-repository"], cwd)
        .map(|s| s == "true")
        .unwrap_or(false)
}

/// Find the merge base of two refs.
pub fn merge_base(ref1: &str, ref2: &str, cwd: &str) -> Result<Option<String>> {
    let result = git(&["merge-base", ref1, ref2], cwd)?;
    if result.success {
        Ok(Some(result.stdout))
    } else {
        Ok(None)
    }
}

/// Parse a remote branch string like "origin/main" into (remote, branch).
pub fn parse_remote_branch(branch: &str) -> Option<(String, String)> {
    let slash_pos = branch.find('/')?;
    Some((
        branch[..slash_pos].to_string(),
        branch[slash_pos + 1..].to_string(),
    ))
}

/// Get the default remote branch (tries to detect from git remote).
pub fn get_default_remote_branch(cwd: &str) -> Result<String> {
    // Try to find the default remote
    let remotes_output = git_stdout(&["remote"], cwd)?;
    let remotes: Vec<&str> = remotes_output.lines().collect();

    let remote = if remotes.contains(&"upstream") {
        "upstream"
    } else if remotes.contains(&"origin") {
        "origin"
    } else if let Some(first) = remotes.first() {
        first
    } else {
        return Ok("origin/master".to_string());
    };

    // Try to get the default branch from remote
    let result = git(&["remote", "show", remote], cwd);
    if let Ok(r) = result {
        if r.success {
            for line in r.stdout.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("HEAD branch:") {
                    let branch = trimmed.trim_start_matches("HEAD branch:").trim();
                    return Ok(format!("{remote}/{branch}"));
                }
            }
        }
    }

    // Fallback: try git config init.defaultBranch
    if let Ok(default_branch) = git_stdout(&["config", "init.defaultBranch"], cwd) {
        return Ok(format!("{remote}/{default_branch}"));
    }

    Ok(format!("{remote}/master"))
}

/// List all tracked files matching a pattern.
pub fn list_tracked_files(pattern: &str, cwd: &str) -> Result<Vec<String>> {
    let result = git(&["ls-files", pattern], cwd)?;
    Ok(result
        .stdout
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect())
}

/// Fetch a branch from a remote.
pub fn fetch(remote: &str, branch: &str, cwd: &str, depth: Option<u32>) -> Result<()> {
    let mut args = vec!["fetch".to_string(), remote.to_string()];
    if let Some(d) = depth {
        args.push(format!("--depth={d}"));
    }
    args.push(branch.to_string());

    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let result = git(&str_args, cwd)?;
    if !result.success {
        bail!(
            "Fetching branch \"{branch}\" from remote \"{remote}\" failed: {}",
            result.stderr
        );
    }
    Ok(())
}
