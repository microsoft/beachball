mod common;

use beachball::changefile::read_change_files::{get_change_path, read_change_files};
use beachball::monorepo::package_infos::get_package_infos;
use beachball::monorepo::scoped_packages::get_scoped_packages;
use beachball::options::get_options::get_parsed_options_for_test;
use beachball::types::change_info::{ChangeFileInfo, ChangeInfoMultiple, ChangeType};
use beachball::types::options::{BeachballOptions, CliOptions};
use common::change_files::generate_change_files;
use common::repository_factory::RepositoryFactory;
use common::{
    DEFAULT_BRANCH, DEFAULT_REMOTE_BRANCH, capture_logging, get_log_output, reset_logging,
};
use serde_json::json;
use std::path::Path;

fn make_opts() -> BeachballOptions {
    BeachballOptions {
        branch: DEFAULT_REMOTE_BRANCH.to_string(),
        fetch: false,
        ..Default::default()
    }
}

fn get_options_and_packages(
    repo: &common::repository::Repository,
    overrides: Option<BeachballOptions>,
) -> (
    BeachballOptions,
    beachball::types::package_info::PackageInfos,
    beachball::types::package_info::ScopedPackages,
) {
    let mut opts = overrides.unwrap_or_else(make_opts);
    opts.branch = DEFAULT_REMOTE_BRANCH.to_string();
    opts.fetch = false;
    let parsed = get_parsed_options_for_test(repo.root_path(), CliOptions::default(), opts);
    let infos = get_package_infos(&parsed.options).unwrap();
    let scoped = get_scoped_packages(&parsed.options, &infos);
    (parsed.options, infos, scoped)
}

fn get_package_names(change_set: &beachball::types::change_info::ChangeSet) -> Vec<String> {
    let mut names: Vec<String> = change_set
        .iter()
        .map(|e| e.change.package_name.clone())
        .collect();
    names.sort();
    names
}

// TS: "reads change files and returns [them]"
#[test]
fn reads_change_files() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);
    repo.commit_change("packages/foo/file.js");

    let (options, infos, scoped) = get_options_and_packages(&repo, None);
    generate_change_files(&["foo", "bar"], &options, &repo);

    let change_set = read_change_files(&options, &infos, &scoped);
    assert_eq!(change_set.len(), 2);
    assert_eq!(get_package_names(&change_set), vec!["bar", "foo"]);
}

// TS: "reads from a custom changeDir"
#[test]
fn reads_from_custom_change_dir() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);
    repo.commit_change("packages/foo/file.js");

    let opts = BeachballOptions {
        change_dir: "customChanges".to_string(),
        ..make_opts()
    };
    let (options, infos, scoped) = get_options_and_packages(&repo, Some(opts));
    generate_change_files(&["foo"], &options, &repo);

    let change_set = read_change_files(&options, &infos, &scoped);
    assert_eq!(get_package_names(&change_set), vec!["foo"]);
}

// TS: "reads a grouped change file"
#[test]
fn reads_grouped_change_file() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);
    repo.commit_change("packages/foo/file.js");

    let opts = BeachballOptions {
        group_changes: true,
        ..make_opts()
    };
    let (options, infos, scoped) = get_options_and_packages(&repo, Some(opts));

    // Write a grouped change file
    let change_path = get_change_path(&options);
    std::fs::create_dir_all(&change_path).ok();
    let grouped = ChangeInfoMultiple {
        changes: vec![
            ChangeFileInfo {
                change_type: ChangeType::Minor,
                comment: "foo change".to_string(),
                package_name: "foo".to_string(),
                email: "test@test.com".to_string(),
                dependent_change_type: ChangeType::Patch,
            },
            ChangeFileInfo {
                change_type: ChangeType::Minor,
                comment: "bar change".to_string(),
                package_name: "bar".to_string(),
                email: "test@test.com".to_string(),
                dependent_change_type: ChangeType::Patch,
            },
        ],
    };
    let json = serde_json::to_string_pretty(&grouped).unwrap();
    std::fs::write(Path::new(&change_path).join("change-grouped.json"), json).unwrap();
    repo.git(&["add", "-A"]);
    repo.git(&["commit", "-m", "grouped change file"]);

    let change_set = read_change_files(&options, &infos, &scoped);
    assert_eq!(get_package_names(&change_set), vec!["bar", "foo"]);
}

// TS: "excludes invalid change files"
#[test]
fn excludes_invalid_change_files() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);
    repo.commit_change("packages/foo/file.js");

    // Make bar private
    let bar_pkg = json!({"name": "bar", "version": "1.0.0", "private": true});
    repo.write_file_content(
        "packages/bar/package.json",
        &serde_json::to_string_pretty(&bar_pkg).unwrap(),
    );
    repo.git(&["add", "-A"]);
    repo.git(&["commit", "-m", "make bar private"]);

    let (options, infos, scoped) = get_options_and_packages(&repo, None);

    // Generate change files: "fake" doesn't exist, "bar" is private, "foo" is valid
    generate_change_files(&["fake", "bar", "foo"], &options, &repo);

    // Also write a non-change JSON file
    let change_path = get_change_path(&options);
    std::fs::write(Path::new(&change_path).join("not-change.json"), "{}").unwrap();
    repo.git(&["add", "-A"]);
    repo.git(&["commit", "-m", "add invalid file"]);

    capture_logging();
    let change_set = read_change_files(&options, &infos, &scoped);
    let output = get_log_output();
    reset_logging();

    assert_eq!(get_package_names(&change_set), vec!["foo"]);
    assert!(output.contains("does not appear to be a change file"));
    assert!(output.contains("Change detected for nonexistent package fake; delete this file"));
    assert!(output.contains("Change detected for private package bar; delete this file"));
}

// TS: "excludes invalid changes from grouped change file in monorepo"
#[test]
fn excludes_invalid_changes_from_grouped_file() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);
    repo.commit_change("packages/foo/file.js");

    // Make bar private
    let bar_pkg = json!({"name": "bar", "version": "1.0.0", "private": true});
    repo.write_file_content(
        "packages/bar/package.json",
        &serde_json::to_string_pretty(&bar_pkg).unwrap(),
    );
    repo.git(&["add", "-A"]);
    repo.git(&["commit", "-m", "make bar private"]);

    let opts = BeachballOptions {
        group_changes: true,
        ..make_opts()
    };
    let (options, infos, scoped) = get_options_and_packages(&repo, Some(opts));

    // Write a grouped change file with invalid entries
    let change_path = get_change_path(&options);
    std::fs::create_dir_all(&change_path).ok();
    let grouped = ChangeInfoMultiple {
        changes: vec![
            ChangeFileInfo {
                change_type: ChangeType::Minor,
                comment: "fake change".to_string(),
                package_name: "fake".to_string(),
                email: "test@test.com".to_string(),
                dependent_change_type: ChangeType::Patch,
            },
            ChangeFileInfo {
                change_type: ChangeType::Minor,
                comment: "bar change".to_string(),
                package_name: "bar".to_string(),
                email: "test@test.com".to_string(),
                dependent_change_type: ChangeType::Patch,
            },
            ChangeFileInfo {
                change_type: ChangeType::Minor,
                comment: "foo change".to_string(),
                package_name: "foo".to_string(),
                email: "test@test.com".to_string(),
                dependent_change_type: ChangeType::Patch,
            },
        ],
    };
    let json = serde_json::to_string_pretty(&grouped).unwrap();
    std::fs::write(Path::new(&change_path).join("change-grouped.json"), json).unwrap();
    repo.git(&["add", "-A"]);
    repo.git(&["commit", "-m", "grouped change file"]);

    capture_logging();
    let change_set = read_change_files(&options, &infos, &scoped);
    let output = get_log_output();
    reset_logging();

    assert_eq!(get_package_names(&change_set), vec!["foo"]);
    assert!(
        output.contains(
            "Change detected for nonexistent package fake; remove the entry from this file"
        )
    );
    assert!(
        output.contains("Change detected for private package bar; remove the entry from this file")
    );
}

// TS: "excludes out of scope change files in monorepo"
#[test]
fn excludes_out_of_scope_change_files() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);
    repo.commit_change("packages/foo/file.js");

    let opts = BeachballOptions {
        scope: Some(vec!["packages/foo".to_string()]),
        ..make_opts()
    };
    let (options, infos, scoped) = get_options_and_packages(&repo, Some(opts));
    generate_change_files(&["bar", "foo"], &options, &repo);

    let change_set = read_change_files(&options, &infos, &scoped);
    assert_eq!(get_package_names(&change_set), vec!["foo"]);
}

// TS: "excludes out of scope changes from grouped change file in monorepo"
#[test]
fn excludes_out_of_scope_changes_from_grouped_file() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);
    repo.commit_change("packages/foo/file.js");

    let opts = BeachballOptions {
        scope: Some(vec!["packages/foo".to_string()]),
        group_changes: true,
        ..make_opts()
    };
    let (options, infos, scoped) = get_options_and_packages(&repo, Some(opts));

    // Write a grouped change file with bar+foo
    let change_path = get_change_path(&options);
    std::fs::create_dir_all(&change_path).ok();
    let grouped = ChangeInfoMultiple {
        changes: vec![
            ChangeFileInfo {
                change_type: ChangeType::Minor,
                comment: "bar change".to_string(),
                package_name: "bar".to_string(),
                email: "test@test.com".to_string(),
                dependent_change_type: ChangeType::Patch,
            },
            ChangeFileInfo {
                change_type: ChangeType::Minor,
                comment: "foo change".to_string(),
                package_name: "foo".to_string(),
                email: "test@test.com".to_string(),
                dependent_change_type: ChangeType::Patch,
            },
        ],
    };
    let json = serde_json::to_string_pretty(&grouped).unwrap();
    std::fs::write(Path::new(&change_path).join("change-grouped.json"), json).unwrap();
    repo.git(&["add", "-A"]);
    repo.git(&["commit", "-m", "grouped change file"]);

    let change_set = read_change_files(&options, &infos, &scoped);
    assert_eq!(get_package_names(&change_set), vec!["foo"]);
}

// Skipped TS tests:
// - "runs transform.changeFiles functions if provided" — transform not implemented
// - "filters change files to only those modified since fromRef" — fromRef not implemented
// - "returns empty set when no change files exist since fromRef" — fromRef not implemented
// - "excludes deleted change files when using fromRef" — fromRef not implemented
