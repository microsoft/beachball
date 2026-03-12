mod common;

use beachball::options::get_options::get_parsed_options_for_test;
use beachball::types::options::{BeachballOptions, CliOptions};
use beachball::validation::validate::{ValidateOptions, ValidationError, validate};
use common::DEFAULT_REMOTE_BRANCH;
use common::repository::Repository;
use common::repository_factory::RepositoryFactory;
use common::{capture_logging, get_log_output, reset_logging};

fn validate_wrapper(
    repo: &Repository,
    validate_options: ValidateOptions,
) -> Result<beachball::validation::validate::ValidationResult, anyhow::Error> {
    let repo_opts = BeachballOptions {
        branch: DEFAULT_REMOTE_BRANCH.to_string(),
        fetch: false,
        ..Default::default()
    };
    let parsed = get_parsed_options_for_test(repo.root_path(), CliOptions::default(), repo_opts);
    validate(&parsed, &validate_options)
}

// TS: "succeeds with no changes"
#[test]
fn succeeds_with_no_changes() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test"]);

    capture_logging();
    let result = validate_wrapper(
        &repo,
        ValidateOptions {
            check_change_needed: true,
            ..Default::default()
        },
    );
    let output = get_log_output();
    reset_logging();

    assert!(result.is_ok());
    assert!(!result.unwrap().is_change_needed);
    assert!(output.contains("Validating options and change files..."));
}

// TS: "exits with error by default if change files are needed"
#[test]
fn exits_with_error_if_change_files_needed() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test"]);
    repo.stage_change("packages/foo/test.js");

    capture_logging();
    let result = validate_wrapper(
        &repo,
        ValidateOptions {
            check_change_needed: true,
            ..Default::default()
        },
    );
    let output = get_log_output();
    reset_logging();

    let err = result.expect_err("expected validation to fail");
    assert!(err.downcast_ref::<ValidationError>().is_some());
    assert!(output.contains("ERROR: Change files are needed!"));
    assert!(output.contains("Found changes in the following packages"));
}

// TS: "returns and does not log an error if change files are needed and allowMissingChangeFiles is true"
#[test]
fn returns_without_error_if_allow_missing_change_files() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test"]);
    repo.stage_change("packages/foo/test.js");

    capture_logging();
    let result = validate_wrapper(
        &repo,
        ValidateOptions {
            check_change_needed: true,
            allow_missing_change_files: true,
            ..Default::default()
        },
    );
    let output = get_log_output();
    reset_logging();

    assert!(result.is_ok());
    assert!(result.unwrap().is_change_needed);
    assert!(!output.contains("ERROR:"));
}
