use anyhow::{Context, Result, bail};
use std::path::{Path, PathBuf};
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

/// Workspace/monorepo manager config files, in precedence order matching workspace-tools.
pub const MANAGER_FILES: &[&str] = &[
    "lerna.json",
    "rush.json",
    "yarn.lock",
    "pnpm-workspace.yaml",
    "package-lock.json",
];

/// Walk up the directory tree from `cwd` looking for any of the given files.
/// Returns the full path of the first match, or None if not found.
pub fn search_up(files: &[&str], cwd: &str) -> Option<PathBuf> {
    let mut dir = Path::new(cwd).to_path_buf();
    if let Ok(abs) = std::fs::canonicalize(&dir) {
        dir = abs;
    }

    loop {
        for f in files {
            let candidate = dir.join(f);
            if candidate.exists() {
                return Some(candidate);
            }
        }
        if !dir.pop() {
            break;
        }
    }
    None
}

/// Find the project root by searching up for workspace manager config files,
/// falling back to the git root. Matches workspace-tools findProjectRoot.
pub fn find_project_root(cwd: &str) -> Result<String> {
    if let Some(found) = search_up(MANAGER_FILES, cwd) {
        if let Some(parent) = found.parent() {
            return Ok(parent.to_string_lossy().to_string());
        }
    }
    find_git_root(cwd)
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
        &[
            "--no-pager",
            "diff",
            "--name-only",
            "--relative",
            &format!("{branch}..."),
        ],
        cwd,
    )?;
    if !result.success {
        return Ok(vec![]);
    }
    Ok(process_git_output(&result.stdout))
}

/// Get staged changes.
pub fn get_staged_changes(cwd: &str) -> Result<Vec<String>> {
    let result = git(
        &[
            "--no-pager",
            "diff",
            "--staged",
            "--name-only",
            "--relative",
        ],
        cwd,
    )?;
    if !result.success {
        return Ok(vec![]);
    }
    Ok(process_git_output(&result.stdout))
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
    let mut args: Vec<&str> = vec!["--no-pager", "diff", "--name-only", "--relative"];
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
    Ok(process_git_output(&result.stdout))
}

/// Get untracked files.
pub fn get_untracked_changes(cwd: &str) -> Result<Vec<String>> {
    let result = git(&["ls-files", "--others", "--exclude-standard"], cwd)?;
    Ok(process_git_output(&result.stdout))
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

/// Returns the default remote name, matching workspace-tools getDefaultRemote.
///
/// The order of preference is:
/// 1. If `repository` is defined in package.json at the git root, the remote with a matching URL
/// 2. "upstream" if defined
/// 3. "origin" if defined
/// 4. The first defined remote
/// 5. "origin" as final fallback
///
/// Note: ADO/VSO URL formats are not currently handled by `get_repository_name`.
/// This is probably fine since usage of forks with ADO is uncommon.
pub fn get_default_remote(cwd: &str) -> String {
    let git_root = match find_git_root(cwd) {
        Ok(root) => root,
        Err(_) => return "origin".to_string(),
    };

    // Read package.json at git root for repository field
    let mut repository_name = String::new();
    let package_json_path = Path::new(&git_root).join("package.json");
    match std::fs::read_to_string(&package_json_path) {
        Err(_) => {
            crate::log_info!(
                r#"Valid "repository" key not found in "{}". Consider adding this info for more accurate git remote detection."#,
                package_json_path.display()
            );
        }
        Ok(contents) => {
            if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&contents) {
                let repo_url = match pkg.get("repository") {
                    Some(serde_json::Value::String(s)) => s.clone(),
                    Some(obj) => obj
                        .get("url")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    None => String::new(),
                };
                if repo_url.is_empty() {
                    crate::log_info!(
                        r#"Valid "repository" key not found in "{}". Consider adding this info for more accurate git remote detection."#,
                        package_json_path.display()
                    );
                } else {
                    repository_name = get_repository_name(&repo_url);
                }
            } else {
                crate::log_info!(
                    r#"Valid "repository" key not found in "{}". Consider adding this info for more accurate git remote detection."#,
                    package_json_path.display()
                );
            }
        }
    }

    // Get remotes with URLs
    let remotes_result = match git(&["remote", "-v"], cwd) {
        Ok(r) if r.success => r,
        _ => return "origin".to_string(),
    };

    // Build mapping from repository name → remote name
    let mut remotes_by_repo_name: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    let mut all_remote_names: Vec<String> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    for line in remotes_result.stdout.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() < 2 {
            continue;
        }
        let remote_name = fields[0];
        let remote_url = fields[1];
        let repo_name = get_repository_name(remote_url);
        if !repo_name.is_empty() {
            remotes_by_repo_name.insert(repo_name, remote_name.to_string());
        }
        if seen.insert(remote_name.to_string()) {
            all_remote_names.push(remote_name.to_string());
        }
    }

    // 1. Match by repository name from package.json
    if !repository_name.is_empty() {
        if let Some(matched) = remotes_by_repo_name.get(&repository_name) {
            return matched.clone();
        }
    }

    // 2-4. Fall back to upstream > origin > first
    if all_remote_names.iter().any(|r| r == "upstream") {
        return "upstream".to_string();
    }
    if all_remote_names.iter().any(|r| r == "origin") {
        return "origin".to_string();
    }
    if let Some(first) = all_remote_names.first() {
        return first.clone();
    }

    "origin".to_string()
}

/// Extracts the "owner/repo" full name from a git URL.
/// Handles HTTPS, SSH, git://, and shorthand (github:owner/repo) formats.
///
/// Note: Azure DevOps and Visual Studio Online URL formats are not currently handled.
/// Those would require more complex parsing similar to workspace-tools' git-url-parse usage.
pub fn get_repository_name(raw_url: &str) -> String {
    if raw_url.is_empty() {
        return String::new();
    }

    // SSH format: git@github.com:owner/repo.git or user@host:path
    if let Some(colon_pos) = raw_url.find(':') {
        if raw_url[..colon_pos].contains('@') && !raw_url[..colon_pos].contains('/') {
            let path = &raw_url[colon_pos + 1..];
            // Skip if path starts with / (would be ssh://user@host/path, not SCP syntax)
            if !path.starts_with('/') {
                return path.trim_end_matches(".git").to_string();
            }
        }
    }

    // Shorthand format: github:owner/repo (scheme without //)
    if let Some(colon_pos) = raw_url.find(':') {
        let scheme = &raw_url[..colon_pos];
        let rest = &raw_url[colon_pos + 1..];
        if scheme.chars().all(|c| c.is_ascii_lowercase())
            && !rest.starts_with("//")
            && !rest.is_empty()
        {
            return rest.trim_end_matches(".git").to_string();
        }
    }

    // HTTPS or git:// format — parse as URL
    if let Some(path_start) = raw_url.find("://") {
        let after_scheme = &raw_url[path_start + 3..];
        // Find the path part (after host)
        if let Some(slash_pos) = after_scheme.find('/') {
            let path = &after_scheme[slash_pos + 1..];
            let path = path.trim_end_matches(".git");
            if !path.is_empty() {
                return path.to_string();
            }
        }
    }

    String::new()
}

/// Get the default remote branch (tries to detect from git remote).
/// If `branch` is Some, combines it with the default remote.
/// If `branch` is None, detects the remote's HEAD branch, falling back to
/// git config init.defaultBranch or "master".
pub fn get_default_remote_branch(cwd: &str) -> Result<String> {
    let remote = get_default_remote(cwd);

    // Try to detect HEAD branch from remote
    if let Ok(r) = git(&["remote", "show", &remote], cwd) {
        if r.success {
            for line in r.stdout.lines() {
                let trimmed = line.trim();
                if let Some(rest) = trimmed.strip_prefix("HEAD branch:") {
                    let branch = rest.trim();
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

/// Get the default remote branch with a specific branch name.
/// Combines the branch with the default remote name.
pub fn get_default_remote_branch_for(cwd: &str, branch: &str) -> String {
    let remote = get_default_remote(cwd);
    format!("{remote}/{branch}")
}

/// List all tracked files matching a pattern.
pub fn list_tracked_files(pattern: &str, cwd: &str) -> Result<Vec<String>> {
    let result = git(&["ls-files", pattern], cwd)?;
    Ok(process_git_output(&result.stdout))
}

/// Fetch a branch from a remote.
pub fn fetch(remote: &str, branch: &str, cwd: &str, depth: Option<u32>) -> Result<()> {
    let mut args = vec!["fetch".to_string(), "--".to_string(), remote.to_string()];
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

/// Splits git output into lines, trims whitespace, and filters out
/// empty lines and node_modules paths. Matches workspace-tools processGitOutput
/// with excludeNodeModules: true.
fn process_git_output(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.contains("node_modules"))
        .map(str::to_string)
        .collect()
}
