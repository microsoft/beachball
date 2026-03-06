mod common;

use beachball::changefile::write_change_files::write_change_files;
use beachball::types::change_info::{ChangeFileInfo, ChangeType};
use beachball::types::options::BeachballOptions;
use common::repository_factory::RepositoryFactory;
use common::{DEFAULT_BRANCH, make_test_options};

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

    let options = make_test_options(repo.root_path(), None);
    let changes = make_changes();

    let result = write_change_files(&changes, &options).unwrap();
    assert_eq!(result.len(), 2);

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

    let custom_opts = BeachballOptions {
        change_dir: "customChangeDir".to_string(),
        ..Default::default()
    };

    let options = make_test_options(repo.root_path(), Some(custom_opts));
    let changes = make_changes();

    let result = write_change_files(&changes, &options).unwrap();
    assert_eq!(result.len(), 2);

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

    let hash_before = repo.git(&["rev-parse", "HEAD"]);

    let no_commit_opts = BeachballOptions {
        commit: false,
        ..Default::default()
    };

    let options = make_test_options(repo.root_path(), Some(no_commit_opts));
    let changes = make_changes();

    let result = write_change_files(&changes, &options).unwrap();
    assert_eq!(result.len(), 2);

    for path in &result {
        assert!(
            std::path::Path::new(path).exists(),
            "Change file should exist: {path}"
        );
    }

    let hash_after = repo.git(&["rev-parse", "HEAD"]);
    assert_eq!(
        hash_before, hash_after,
        "HEAD should not change when commit=false"
    );
}
