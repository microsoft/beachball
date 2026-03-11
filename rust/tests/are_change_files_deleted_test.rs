mod common;

use beachball::types::options::BeachballOptions;
use beachball::validation::are_change_files_deleted::are_change_files_deleted;
use common::change_files::generate_change_files;
use common::repository_factory::RepositoryFactory;
use common::{DEFAULT_BRANCH, make_test_options};

// TS: "is false when no change files are deleted"
#[test]
fn is_false_when_no_change_files_are_deleted() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();

    let options = make_test_options(repo.root_path(), None);
    generate_change_files(&["foo"], &options, &repo);
    repo.push();

    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);

    let options = make_test_options(repo.root_path(), None);
    assert!(!are_change_files_deleted(&options));
}

// TS: "is true when change files are deleted"
#[test]
fn is_true_when_change_files_are_deleted() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();

    let options = make_test_options(repo.root_path(), None);
    generate_change_files(&["foo"], &options, &repo);
    repo.push();

    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);

    // Delete the change files (but keep the directory so git can run from it)
    let change_path = std::path::Path::new(repo.root_path()).join("change");
    for entry in std::fs::read_dir(&change_path).unwrap() {
        let entry = entry.unwrap();
        std::fs::remove_file(entry.path()).unwrap();
    }
    repo.git(&["add", "-A"]);
    repo.git(&["commit", "-m", "delete change files"]);

    let options = make_test_options(repo.root_path(), None);
    assert!(are_change_files_deleted(&options));
}

// TS: "deletes change files when changeDir option is specified"
#[test]
fn works_with_custom_change_dir() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();

    let custom_opts = BeachballOptions {
        change_dir: "changeDir".to_string(),
        ..Default::default()
    };

    let options = make_test_options(repo.root_path(), Some(custom_opts.clone()));
    generate_change_files(&["foo"], &options, &repo);
    repo.push();

    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);

    // Delete the change files (but keep the directory so git can run from it)
    let change_path = std::path::Path::new(repo.root_path()).join("changeDir");
    for entry in std::fs::read_dir(&change_path).unwrap() {
        let entry = entry.unwrap();
        std::fs::remove_file(entry.path()).unwrap();
    }
    repo.git(&["add", "-A"]);
    repo.git(&["commit", "-m", "delete change files"]);

    let options = make_test_options(repo.root_path(), Some(custom_opts));
    assert!(are_change_files_deleted(&options));
}
