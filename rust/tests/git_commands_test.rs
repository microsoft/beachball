mod common;

use beachball::git::commands::*;
use std::fs;
use std::path::Path;

/// Create a temp directory with git init and user config.
fn setup_git_dir(description: &str) -> tempfile::TempDir {
    let dir = tempfile::Builder::new()
        .prefix(&format!("beachball-git-{description}-"))
        .tempdir()
        .expect("failed to create temp dir");
    let cwd = dir.path().to_str().unwrap();
    must_git(cwd, &["init"]);
    must_git(cwd, &["config", "user.email", "test@test.com"]);
    must_git(cwd, &["config", "user.name", "Test"]);
    dir
}

fn must_git(cwd: &str, args: &[&str]) -> String {
    common::run_git(args, cwd)
}

fn write_file(dir: &Path, name: &str, content: &str) {
    let full = dir.join(name);
    if let Some(parent) = full.parent() {
        fs::create_dir_all(parent).ok();
    }
    fs::write(&full, content).expect("failed to write file");
}

fn write_package_json(dir: &Path, extra_fields: Option<serde_json::Value>) {
    let mut pkg = serde_json::json!({
        "name": "test-pkg",
        "version": "1.0.0"
    });
    if let Some(extra) = extra_fields {
        if let (Some(base), Some(extra_map)) = (pkg.as_object_mut(), extra.as_object()) {
            for (k, v) in extra_map {
                base.insert(k.clone(), v.clone());
            }
        }
    }
    let data = serde_json::to_string_pretty(&pkg).unwrap();
    fs::write(dir.join("package.json"), data).expect("failed to write package.json");
}

// --- get_untracked_changes (getUntrackedChanges.test.ts) ---

/// TS: "returns untracked files using object params"
#[test]
fn test_get_untracked_changes_returns_untracked_files() {
    let dir = setup_git_dir("untracked-returns");
    let cwd = dir.path().to_str().unwrap();

    write_file(dir.path(), "untracked1.txt", "content1");
    write_file(dir.path(), "untracked2.js", "content2");

    let mut result = get_untracked_changes(cwd).unwrap();
    result.sort();
    assert_eq!(result, vec!["untracked1.txt", "untracked2.js"]);
}

/// TS: "does not include tracked files"
#[test]
fn test_get_untracked_changes_does_not_include_tracked() {
    let dir = setup_git_dir("untracked-tracked");
    let cwd = dir.path().to_str().unwrap();

    write_file(dir.path(), "committed.txt", "committed content");
    must_git(cwd, &["add", "committed.txt"]);
    must_git(cwd, &["commit", "-m", "add committed file"]);

    write_file(dir.path(), "staged.txt", "staged content");
    must_git(cwd, &["add", "staged.txt"]);

    write_file(dir.path(), "untracked.txt", "untracked content");

    let result = get_untracked_changes(cwd).unwrap();
    assert_eq!(result, vec!["untracked.txt"]);
}

/// TS: "returns empty array when no untracked files"
#[test]
fn test_get_untracked_changes_returns_empty_when_none() {
    let dir = setup_git_dir("untracked-empty");
    let cwd = dir.path().to_str().unwrap();

    let result = get_untracked_changes(cwd).unwrap();
    assert!(result.is_empty());
}

/// TS: "respects gitignore patterns"
#[test]
fn test_get_untracked_changes_respects_gitignore() {
    let dir = setup_git_dir("untracked-gitignore");
    let cwd = dir.path().to_str().unwrap();

    write_file(dir.path(), ".gitignore", "*.log\n");
    write_file(dir.path(), "file.txt", "content");
    write_file(dir.path(), "error.log", "log content");

    let mut result = get_untracked_changes(cwd).unwrap();
    result.sort();
    assert_eq!(result, vec![".gitignore", "file.txt"]);
}

// --- get_staged_changes (getStagedChanges.test.ts) ---

/// TS: "returns staged file changes"
#[test]
fn test_get_staged_changes_returns_staged() {
    let dir = setup_git_dir("staged-returns");
    let cwd = dir.path().to_str().unwrap();

    write_file(dir.path(), "feature.ts", "original");
    must_git(cwd, &["add", "feature.ts"]);
    must_git(cwd, &["commit", "-m", "initial"]);

    write_file(dir.path(), "feature.ts", "modified");
    write_file(dir.path(), "stuff/new-file.ts", "new content");
    must_git(cwd, &["add", "feature.ts", "stuff/new-file.ts"]);

    let mut result = get_staged_changes(cwd).unwrap();
    result.sort();
    assert_eq!(result, vec!["feature.ts", "stuff/new-file.ts"]);
}

/// TS: "does not include unstaged changes"
#[test]
fn test_get_staged_changes_does_not_include_unstaged() {
    let dir = setup_git_dir("staged-unstaged");
    let cwd = dir.path().to_str().unwrap();

    write_file(dir.path(), "staged.js", "original");
    write_file(dir.path(), "unstaged.js", "original");
    must_git(cwd, &["add", "-A"]);
    must_git(cwd, &["commit", "-m", "initial"]);

    write_file(dir.path(), "staged.js", "modified");
    write_file(dir.path(), "unstaged.js", "modified");
    write_file(dir.path(), "another-file.js", "new content");
    must_git(cwd, &["add", "staged.js"]);

    let result = get_staged_changes(cwd).unwrap();
    assert_eq!(result, vec!["staged.js"]);
}

/// TS: "returns empty array when nothing is staged"
#[test]
fn test_get_staged_changes_returns_empty_when_nothing_staged() {
    let dir = setup_git_dir("staged-empty");
    let cwd = dir.path().to_str().unwrap();

    write_file(dir.path(), "file.ts", "content");
    must_git(cwd, &["add", "file.ts"]);
    must_git(cwd, &["commit", "-m", "initial"]);

    write_file(dir.path(), "file.ts", "modified");
    write_file(dir.path(), "another-file.ts", "new content");

    let result = get_staged_changes(cwd).unwrap();
    assert!(result.is_empty());
}

// --- get_changes_between_refs (getChangesBetweenRefs.test.ts) ---

/// TS: "returns changes between ref and HEAD"
#[test]
fn test_get_changes_between_refs_returns_changes() {
    let dir = setup_git_dir("refs-returns");
    let cwd = dir.path().to_str().unwrap();

    write_file(dir.path(), "file1.ts", "initial");
    must_git(cwd, &["add", "file1.ts"]);
    must_git(cwd, &["commit", "-m", "commit1"]);
    let first_commit = must_git(cwd, &["rev-parse", "HEAD"]);

    write_file(dir.path(), "file2.ts", "new file");
    write_file(dir.path(), "file3.ts", "new file");
    must_git(cwd, &["add", "-A"]);
    must_git(cwd, &["commit", "-m", "commit2"]);

    let mut result = get_changes_between_refs(&first_commit, None, None, cwd).unwrap();
    result.sort();
    assert_eq!(result, vec!["file2.ts", "file3.ts"]);
}

/// TS: "supports additional diff options" (adapted for diff_filter param)
#[test]
fn test_get_changes_between_refs_supports_diff_filter() {
    let dir = setup_git_dir("refs-filter");
    let cwd = dir.path().to_str().unwrap();

    write_file(dir.path(), "file.ts", "initial");
    must_git(cwd, &["add", "file.ts"]);
    must_git(cwd, &["commit", "-m", "commit1"]);

    write_file(dir.path(), "file.ts", "modified");
    write_file(dir.path(), "newfile.ts", "new file");
    must_git(cwd, &["add", "-A"]);
    must_git(cwd, &["commit", "-m", "commit2"]);

    let result = get_changes_between_refs("HEAD~1", Some("M"), None, cwd).unwrap();
    assert_eq!(result, vec!["file.ts"]);
}

/// TS: "supports pattern filtering"
#[test]
fn test_get_changes_between_refs_supports_pattern_filtering() {
    let dir = setup_git_dir("refs-pattern");
    let cwd = dir.path().to_str().unwrap();

    write_file(dir.path(), "file.ts", "initial");
    must_git(cwd, &["add", "file.ts"]);
    must_git(cwd, &["commit", "-m", "commit1"]);

    write_file(dir.path(), "code.ts", "code");
    write_file(dir.path(), "readme.md", "docs");
    must_git(cwd, &["add", "-A"]);
    must_git(cwd, &["commit", "-m", "commit2"]);

    let result = get_changes_between_refs("HEAD~1", None, Some("*.ts"), cwd).unwrap();
    assert_eq!(result, vec!["code.ts"]);
}

// --- get_default_remote (getDefaultRemote.test.ts) ---

/// TS: "handles no repository field or remotes"
#[test]
fn test_get_default_remote_no_remotes() {
    let dir = setup_git_dir("remote-none");
    let cwd = dir.path().to_str().unwrap();
    write_package_json(dir.path(), None);

    assert_eq!(get_default_remote(cwd), "origin");
}

/// TS: "defaults to upstream remote without repository field"
#[test]
fn test_get_default_remote_prefers_upstream() {
    let dir = setup_git_dir("remote-upstream");
    let cwd = dir.path().to_str().unwrap();
    write_package_json(dir.path(), None);

    must_git(cwd, &["remote", "add", "first", "https://github.com/kenotron/workspace-tools.git"]);
    must_git(cwd, &["remote", "add", "origin", "https://github.com/ecraig12345/workspace-tools.git"]);
    must_git(cwd, &["remote", "add", "upstream", "https://github.com/microsoft/workspace-tools.git"]);

    assert_eq!(get_default_remote(cwd), "upstream");
}

/// TS: "defaults to origin remote without repository field or upstream remote"
#[test]
fn test_get_default_remote_prefers_origin_over_other() {
    let dir = setup_git_dir("remote-origin");
    let cwd = dir.path().to_str().unwrap();
    write_package_json(dir.path(), None);

    must_git(cwd, &["remote", "add", "first", "https://github.com/kenotron/workspace-tools.git"]);
    must_git(cwd, &["remote", "add", "origin", "https://github.com/microsoft/workspace-tools.git"]);

    assert_eq!(get_default_remote(cwd), "origin");
}

/// TS: "defaults to first remote without repository field, origin, or upstream"
#[test]
fn test_get_default_remote_falls_back_to_first() {
    let dir = setup_git_dir("remote-first");
    let cwd = dir.path().to_str().unwrap();
    write_package_json(dir.path(), None);

    must_git(cwd, &["remote", "add", "first", "https://github.com/kenotron/workspace-tools.git"]);
    must_git(cwd, &["remote", "add", "second", "https://github.com/microsoft/workspace-tools.git"]);

    assert_eq!(get_default_remote(cwd), "first");
}

/// TS: "finds remote matching repository string"
#[test]
fn test_get_default_remote_matches_repository_string() {
    let dir = setup_git_dir("remote-repo-string");
    let cwd = dir.path().to_str().unwrap();
    write_package_json(
        dir.path(),
        Some(serde_json::json!({
            "repository": "https://github.com/microsoft/workspace-tools.git"
        })),
    );

    must_git(cwd, &["remote", "add", "first", "https://github.com/kenotron/workspace-tools.git"]);
    must_git(cwd, &["remote", "add", "second", "https://github.com/microsoft/workspace-tools.git"]);

    assert_eq!(get_default_remote(cwd), "second");
}

/// TS: "finds remote matching repository object"
#[test]
fn test_get_default_remote_matches_repository_object() {
    let dir = setup_git_dir("remote-repo-obj");
    let cwd = dir.path().to_str().unwrap();
    write_package_json(
        dir.path(),
        Some(serde_json::json!({
            "repository": { "url": "https://github.com/microsoft/workspace-tools.git", "type": "git" }
        })),
    );

    must_git(cwd, &["remote", "add", "first", "https://github.com/kenotron/workspace-tools.git"]);
    must_git(cwd, &["remote", "add", "second", "https://github.com/microsoft/workspace-tools.git"]);

    assert_eq!(get_default_remote(cwd), "second");
}

/// TS: "works with SSH remote format"
#[test]
fn test_get_default_remote_ssh_remote_format() {
    let dir = setup_git_dir("remote-ssh");
    let cwd = dir.path().to_str().unwrap();
    write_package_json(
        dir.path(),
        Some(serde_json::json!({
            "repository": { "url": "https://github.com/microsoft/workspace-tools", "type": "git" }
        })),
    );

    must_git(cwd, &["remote", "add", "first", "git@github.com:kenotron/workspace-tools.git"]);
    must_git(cwd, &["remote", "add", "second", "git@github.com:microsoft/workspace-tools.git"]);

    assert_eq!(get_default_remote(cwd), "second");
}

/// TS: "works with shorthand repository format"
#[test]
fn test_get_default_remote_shorthand_format() {
    let dir = setup_git_dir("remote-shorthand");
    let cwd = dir.path().to_str().unwrap();
    write_package_json(
        dir.path(),
        Some(serde_json::json!({
            "repository": { "url": "github:microsoft/workspace-tools", "type": "git" }
        })),
    );

    must_git(cwd, &["remote", "add", "first", "https://github.com/kenotron/workspace-tools.git"]);
    must_git(cwd, &["remote", "add", "second", "https://github.com/microsoft/workspace-tools.git"]);

    assert_eq!(get_default_remote(cwd), "second");
}

// ADO/VSO tests from TS are omitted: ADO/VSO URL parsing not implemented.
// See: "works with VSO repository and mismatched remote format"
// See: "works with ADO repository and mismatched remote format"

// --- get_repository_name (getRepositoryName.test.ts) ---

/// TS: "works with HTTPS URLs"
#[test]
fn test_get_repository_name_https() {
    assert_eq!(
        get_repository_name("https://github.com/microsoft/workspace-tools"),
        "microsoft/workspace-tools"
    );
}

/// TS: "works with HTTPS URLs with .git"
#[test]
fn test_get_repository_name_https_with_git() {
    assert_eq!(
        get_repository_name("https://github.com/microsoft/workspace-tools.git"),
        "microsoft/workspace-tools"
    );
}

/// TS: "works with SSH URLs"
#[test]
fn test_get_repository_name_ssh() {
    assert_eq!(
        get_repository_name("git@github.com:microsoft/workspace-tools.git"),
        "microsoft/workspace-tools"
    );
}

/// TS: "works with git:// URLs"
#[test]
fn test_get_repository_name_git_protocol() {
    assert_eq!(
        get_repository_name("git://github.com/microsoft/workspace-tools"),
        "microsoft/workspace-tools"
    );
}

#[test]
fn test_get_repository_name_empty() {
    assert_eq!(get_repository_name(""), "");
}

// ADO/VSO tests from TS are omitted: ADO/VSO URL parsing not implemented.
// See getRepositoryName.test.ts "ADO" and "VSO" describe blocks.
