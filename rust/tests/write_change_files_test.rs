mod common;

use beachball::changefile::write_change_files::write_change_files;
use beachball::options::get_options::get_parsed_options_for_test;
use beachball::types::change_info::{ChangeFileInfo, ChangeType};
use beachball::types::options::{BeachballOptions, CliOptions};
use common::repository_factory::RepositoryFactory;

const DEFAULT_BRANCH: &str = "master";
const DEFAULT_REMOTE_BRANCH: &str = "origin/master";

fn make_options(cwd: &str, overrides: Option<BeachballOptions>) -> BeachballOptions {
    let cli = CliOptions::default();
    let mut repo_opts = overrides.unwrap_or_default();
    repo_opts.branch = DEFAULT_REMOTE_BRANCH.to_string();
    repo_opts.fetch = false;

    let parsed = get_parsed_options_for_test(cwd, cli, repo_opts);
    parsed.options
}

fn make_changes() -> Vec<ChangeFileInfo> {
    vec![
        ChangeFileInfo {
            change_type: ChangeType::Patch,
            comment: "fix something".to_string(),
            package_name: "foo".to_string(),
            email: "test@test.com".to_string(),
            dependent_change_type: ChangeType::Patch,
        },
        ChangeFileInfo {
            change_type: ChangeType::Minor,
            comment: "add feature".to_string(),
            package_name: "bar".to_string(),
            email: "test@test.com".to_string(),
            dependent_change_type: ChangeType::Patch,
        },
    ]
}

#[test]
fn writes_individual_change_files() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);

    let options = make_options(repo.root_path(), None);
    let changes = make_changes();

    let result = write_change_files(&changes, &options).unwrap();
    assert_eq!(result.len(), 2);

    // Verify files exist on disk
    for path in &result {
        assert!(
            std::path::Path::new(path).exists(),
            "Change file should exist: {path}"
        );
    }

    // Verify files are committed (git status should be clean)
    let status = repo.status();
    assert!(
        status.is_empty(),
        "Working tree should be clean after commit, got: {status}"
    );
}

#[test]
fn respects_change_dir_option() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);

    let mut custom_opts = BeachballOptions::default();
    custom_opts.change_dir = "customChangeDir".to_string();

    let options = make_options(repo.root_path(), Some(custom_opts));
    let changes = make_changes();

    let result = write_change_files(&changes, &options).unwrap();
    assert_eq!(result.len(), 2);

    // Verify files are in the custom directory
    for path in &result {
        assert!(
            path.contains("customChangeDir"),
            "Change file should be in customChangeDir: {path}"
        );
        assert!(
            std::path::Path::new(path).exists(),
            "Change file should exist: {path}"
        );
    }
}

#[test]
fn respects_commit_false() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);

    // Get current HEAD hash before writing
    let hash_before = repo.git(&["rev-parse", "HEAD"]);

    let mut no_commit_opts = BeachballOptions::default();
    no_commit_opts.commit = false;

    let options = make_options(repo.root_path(), Some(no_commit_opts));
    let changes = make_changes();

    let result = write_change_files(&changes, &options).unwrap();
    assert_eq!(result.len(), 2);

    // Verify files exist on disk
    for path in &result {
        assert!(
            std::path::Path::new(path).exists(),
            "Change file should exist: {path}"
        );
    }

    // Verify no new commit was created
    let hash_after = repo.git(&["rev-parse", "HEAD"]);
    assert_eq!(
        hash_before, hash_after,
        "HEAD should not change when commit=false"
    );
}
