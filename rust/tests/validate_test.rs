mod common;

use beachball::options::get_options::get_parsed_options_for_test;
use beachball::types::options::{BeachballOptions, CliOptions};
use beachball::validation::validate::{validate, ValidateOptions, ValidationError};
use common::repository::Repository;
use common::repository_factory::RepositoryFactory;

const DEFAULT_REMOTE_BRANCH: &str = "origin/master";

fn make_test_options(cwd: &str) -> (CliOptions, BeachballOptions) {
    let cli = CliOptions::default();
    let mut repo_opts = BeachballOptions::default();
    repo_opts.branch = DEFAULT_REMOTE_BRANCH.to_string();
    repo_opts.fetch = false;
    (cli, repo_opts)
}

fn validate_wrapper(repo: &Repository, validate_options: ValidateOptions) -> Result<beachball::validation::validate::ValidationResult, anyhow::Error> {
    let (cli, repo_opts) = make_test_options(repo.root_path());
    let parsed = get_parsed_options_for_test(repo.root_path(), cli, repo_opts);
    validate(&parsed, &validate_options)
}

#[test]
fn succeeds_with_no_changes() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test"]);

    let result = validate_wrapper(&repo, ValidateOptions {
        check_change_needed: true,
        ..Default::default()
    });

    assert!(result.is_ok());
    let result = result.unwrap();
    assert!(!result.is_change_needed);
}

#[test]
fn exits_with_error_if_change_files_needed() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test"]);
    repo.stage_change("packages/foo/test.js");

    let result = validate_wrapper(&repo, ValidateOptions {
        check_change_needed: true,
        ..Default::default()
    });

    let err = result.expect_err("expected validation to fail");
    assert!(err.downcast_ref::<ValidationError>().is_some());
}

#[test]
fn returns_without_error_if_allow_missing_change_files() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test"]);
    repo.stage_change("packages/foo/test.js");

    let result = validate_wrapper(&repo, ValidateOptions {
        check_change_needed: true,
        allow_missing_change_files: true,
        ..Default::default()
    });

    assert!(result.is_ok());
    let result = result.unwrap();
    assert!(result.is_change_needed);
}
