mod common;

use beachball::commands::change::change;
use beachball::options::get_options::get_parsed_options_for_test;
use beachball::types::change_info::{ChangeFileInfo, ChangeType};
use beachball::types::options::{BeachballOptions, CliOptions};
use common::change_files::get_change_files;
use common::repository_factory::RepositoryFactory;
use common::{DEFAULT_BRANCH, DEFAULT_REMOTE_BRANCH};

#[test]
fn does_not_create_change_files_when_no_changes() {
    let factory = RepositoryFactory::new("single");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "no-changes-test", DEFAULT_BRANCH]);

    let repo_opts = BeachballOptions {
        branch: DEFAULT_REMOTE_BRANCH.to_string(),
        fetch: false,
        ..Default::default()
    };
    let cli = CliOptions {
        command: Some("change".to_string()),
        message: Some("test change".to_string()),
        change_type: Some(ChangeType::Patch),
        ..Default::default()
    };

    let parsed = get_parsed_options_for_test(repo.root_path(), cli, repo_opts);
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
        branch: DEFAULT_REMOTE_BRANCH.to_string(),
        fetch: false,
        commit: false,
        ..Default::default()
    };
    let cli = CliOptions {
        command: Some("change".to_string()),
        message: Some("test description".to_string()),
        change_type: Some(ChangeType::Patch),
        commit: Some(false),
        ..Default::default()
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
