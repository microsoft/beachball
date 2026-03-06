mod common;

use beachball::options::get_options::get_parsed_options_for_test;
use beachball::types::options::{BeachballOptions, CliOptions};
use beachball::validation::are_change_files_deleted::are_change_files_deleted;
use common::change_files::generate_change_files;
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

#[test]
fn is_false_when_no_change_files_are_deleted() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();

    let options = make_options(repo.root_path(), None);
    generate_change_files(&["foo"], &options, &repo);
    repo.push();

    repo.checkout(&["-b", "test", DEFAULT_BRANCH]);

    let options = make_options(repo.root_path(), None);
    assert!(!are_change_files_deleted(&options));
}

#[test]
fn is_true_when_change_files_are_deleted() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();

    let options = make_options(repo.root_path(), None);
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

    let options = make_options(repo.root_path(), None);
    assert!(are_change_files_deleted(&options));
}

#[test]
fn works_with_custom_change_dir() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();

    let custom_opts = BeachballOptions {
        change_dir: "changeDir".to_string(),
        ..Default::default()
    };

    let options = make_options(repo.root_path(), Some(custom_opts.clone()));
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

    let options = make_options(repo.root_path(), Some(custom_opts));
    assert!(are_change_files_deleted(&options));
}
