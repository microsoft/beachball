mod common;

use beachball::commands::change::change;
use beachball::options::get_options::get_parsed_options_for_test;
use beachball::types::change_info::{ChangeFileInfo, ChangeInfoMultiple, ChangeType};
use beachball::types::options::{BeachballOptions, CliOptions};
use common::change_files::get_change_files;
use common::repository_factory::RepositoryFactory;
use common::{DEFAULT_BRANCH, DEFAULT_REMOTE_BRANCH};

fn make_cli(message: &str, change_type: ChangeType) -> CliOptions {
    CliOptions {
        command: Some("change".to_string()),
        message: Some(message.to_string()),
        change_type: Some(change_type),
        ..Default::default()
    }
}

fn make_repo_opts() -> BeachballOptions {
    BeachballOptions {
        branch: DEFAULT_REMOTE_BRANCH.to_string(),
        fetch: false,
        ..Default::default()
    }
}

#[test]
fn does_not_create_change_files_when_no_changes() {
    let factory = RepositoryFactory::new("single");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "no-changes-test", DEFAULT_BRANCH]);

    let cli = make_cli("test change", ChangeType::Patch);
    let parsed = get_parsed_options_for_test(repo.root_path(), cli, make_repo_opts());
    assert!(change(&parsed).is_ok());
    assert!(get_change_files(&parsed.options).is_empty());
}

#[test]
fn creates_change_file_with_type_and_message() {
    let factory = RepositoryFactory::new("single");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "creates-change-test", DEFAULT_BRANCH]);
    repo.commit_change("file.js");

    let repo_opts = BeachballOptions {
        commit: false,
        ..make_repo_opts()
    };
    let cli = CliOptions {
        commit: Some(false),
        ..make_cli("test description", ChangeType::Patch)
    };

    let parsed = get_parsed_options_for_test(repo.root_path(), cli, repo_opts);
    assert!(change(&parsed).is_ok());

    let files = get_change_files(&parsed.options);
    assert_eq!(files.len(), 1);

    let contents = std::fs::read_to_string(&files[0]).unwrap();
    let change: ChangeFileInfo = serde_json::from_str(&contents).unwrap();
    assert_eq!(change.change_type, ChangeType::Patch);
    assert_eq!(change.comment, "test description");
    assert_eq!(change.package_name, "foo");
    assert_eq!(change.dependent_change_type, ChangeType::Patch);
}

#[test]
fn creates_and_stages_a_change_file() {
    let factory = RepositoryFactory::new("single");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "stages-change-test", DEFAULT_BRANCH]);
    repo.commit_change("file.js");

    let repo_opts = BeachballOptions {
        commit: false,
        ..make_repo_opts()
    };
    let cli = CliOptions {
        commit: Some(false),
        ..make_cli("stage me please", ChangeType::Patch)
    };

    let parsed = get_parsed_options_for_test(repo.root_path(), cli, repo_opts);
    assert!(change(&parsed).is_ok());

    // Verify file is staged (git status shows "A ")
    let status = repo.status();
    assert!(
        status.contains("A "),
        "expected staged file (A prefix), got: {status}"
    );

    let files = get_change_files(&parsed.options);
    assert_eq!(files.len(), 1);

    let contents = std::fs::read_to_string(&files[0]).unwrap();
    let change: ChangeFileInfo = serde_json::from_str(&contents).unwrap();
    assert_eq!(change.comment, "stage me please");
    assert_eq!(change.package_name, "foo");
}

#[test]
fn creates_and_commits_a_change_file() {
    let factory = RepositoryFactory::new("single");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "commits-change-test", DEFAULT_BRANCH]);
    repo.commit_change("file.js");

    let cli = make_cli("commit me please", ChangeType::Patch);
    let parsed = get_parsed_options_for_test(repo.root_path(), cli, make_repo_opts());
    assert!(change(&parsed).is_ok());

    // Verify clean git status (committed)
    let status = repo.status();
    assert!(status.is_empty(), "expected clean status, got: {status}");

    let files = get_change_files(&parsed.options);
    assert_eq!(files.len(), 1);

    let contents = std::fs::read_to_string(&files[0]).unwrap();
    let change: ChangeFileInfo = serde_json::from_str(&contents).unwrap();
    assert_eq!(change.comment, "commit me please");
}

#[test]
fn creates_and_commits_a_change_file_with_change_dir() {
    let factory = RepositoryFactory::new("single");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "changedir-test", DEFAULT_BRANCH]);
    repo.commit_change("file.js");

    let repo_opts = BeachballOptions {
        change_dir: "changeDir".to_string(),
        ..make_repo_opts()
    };
    let cli = make_cli("commit me please", ChangeType::Patch);

    let parsed = get_parsed_options_for_test(repo.root_path(), cli, repo_opts);
    assert!(change(&parsed).is_ok());

    let status = repo.status();
    assert!(status.is_empty(), "expected clean status, got: {status}");

    let files = get_change_files(&parsed.options);
    assert_eq!(files.len(), 1);
    assert!(
        files[0].contains("changeDir"),
        "expected file in changeDir, got: {}",
        files[0]
    );

    let contents = std::fs::read_to_string(&files[0]).unwrap();
    let change: ChangeFileInfo = serde_json::from_str(&contents).unwrap();
    assert_eq!(change.comment, "commit me please");
}

#[test]
fn creates_change_file_when_no_changes_but_package_provided() {
    let factory = RepositoryFactory::new("single");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "package-flag-test", DEFAULT_BRANCH]);

    let repo_opts = BeachballOptions {
        commit: false,
        ..make_repo_opts()
    };
    let cli = CliOptions {
        package: Some(vec!["foo".to_string()]),
        commit: Some(false),
        ..make_cli("forced change", ChangeType::Patch)
    };

    let parsed = get_parsed_options_for_test(repo.root_path(), cli, repo_opts);
    assert!(change(&parsed).is_ok());

    let files = get_change_files(&parsed.options);
    assert_eq!(files.len(), 1);

    let contents = std::fs::read_to_string(&files[0]).unwrap();
    let change: ChangeFileInfo = serde_json::from_str(&contents).unwrap();
    assert_eq!(change.package_name, "foo");
}

#[test]
fn creates_and_commits_change_files_for_multiple_packages() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "multi-pkg-test", DEFAULT_BRANCH]);
    repo.commit_change("packages/foo/file.js");
    repo.commit_change("packages/bar/file.js");

    let cli = make_cli("multi-package change", ChangeType::Minor);
    let parsed = get_parsed_options_for_test(repo.root_path(), cli, make_repo_opts());
    assert!(change(&parsed).is_ok());

    let status = repo.status();
    assert!(status.is_empty(), "expected clean status, got: {status}");

    let files = get_change_files(&parsed.options);
    assert_eq!(files.len(), 2);

    let mut package_names: Vec<String> = Vec::new();
    for f in &files {
        let contents = std::fs::read_to_string(f).unwrap();
        let change: ChangeFileInfo = serde_json::from_str(&contents).unwrap();
        assert_eq!(change.change_type, ChangeType::Minor);
        assert_eq!(change.comment, "multi-package change");
        package_names.push(change.package_name);
    }
    package_names.sort();
    assert_eq!(package_names, vec!["bar", "foo"]);
}

#[test]
fn creates_and_commits_grouped_change_file() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "grouped-test", DEFAULT_BRANCH]);
    repo.commit_change("packages/foo/file.js");
    repo.commit_change("packages/bar/file.js");

    let repo_opts = BeachballOptions {
        group_changes: true,
        ..make_repo_opts()
    };
    let cli = make_cli("grouped change", ChangeType::Minor);

    let parsed = get_parsed_options_for_test(repo.root_path(), cli, repo_opts);
    assert!(change(&parsed).is_ok());

    let status = repo.status();
    assert!(status.is_empty(), "expected clean status, got: {status}");

    let files = get_change_files(&parsed.options);
    assert_eq!(files.len(), 1);

    let contents = std::fs::read_to_string(&files[0]).unwrap();
    let grouped: ChangeInfoMultiple = serde_json::from_str(&contents).unwrap();
    assert_eq!(grouped.changes.len(), 2);

    let mut package_names: Vec<String> = grouped
        .changes
        .iter()
        .map(|c| {
            assert_eq!(c.change_type, ChangeType::Minor);
            assert_eq!(c.comment, "grouped change");
            c.package_name.clone()
        })
        .collect();
    package_names.sort();
    assert_eq!(package_names, vec!["bar", "foo"]);
}
