mod common;

use beachball::changefile::changed_packages::get_changed_packages;
use beachball::monorepo::package_infos::get_package_infos;
use beachball::monorepo::scoped_packages::get_scoped_packages;
use beachball::options::get_options::get_parsed_options_for_test;
use beachball::types::options::{BeachballOptions, CliOptions};
use common::change_files::generate_change_files;
use common::repository::Repository;
use common::repository_factory::RepositoryFactory;
use std::collections::HashMap;

const DEFAULT_BRANCH: &str = "master";
const DEFAULT_REMOTE_BRANCH: &str = "origin/master";

fn get_options_and_packages(
    repo: &Repository,
    overrides: Option<BeachballOptions>,
    extra_cli: Option<CliOptions>,
) -> (BeachballOptions, beachball::types::package_info::PackageInfos, beachball::types::package_info::ScopedPackages) {
    let cli = extra_cli.unwrap_or_default();
    let mut repo_opts = overrides.unwrap_or_default();
    repo_opts.branch = DEFAULT_REMOTE_BRANCH.to_string();
    repo_opts.fetch = false;

    let parsed = get_parsed_options_for_test(repo.root_path(), cli, repo_opts);
    let package_infos = get_package_infos(&parsed.options).unwrap();
    let scoped_packages = get_scoped_packages(&parsed.options, &package_infos);
    (parsed.options, package_infos, scoped_packages)
}

fn check_out_test_branch(repo: &Repository, name: &str) {
    let branch_name = name.replace(|c: char| !c.is_alphanumeric(), "-");
    repo.checkout(&["-b", &branch_name, DEFAULT_BRANCH]);
}

// ===== Basic tests =====

#[test]
fn returns_empty_list_when_no_changes() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();

    let (options, infos, scoped) = get_options_and_packages(&repo, None, None);
    let result = get_changed_packages(&options, &infos, &scoped).unwrap();
    assert!(result.is_empty());
}

#[test]
fn returns_package_name_when_changes_in_branch() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    check_out_test_branch(&repo, "changes_in_branch");
    repo.commit_change("packages/foo/myFilename");

    let (options, infos, scoped) = get_options_and_packages(&repo, None, None);
    let result = get_changed_packages(&options, &infos, &scoped).unwrap();
    assert_eq!(result, vec!["foo"]);
}

#[test]
fn returns_empty_list_for_changelog_changes() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    check_out_test_branch(&repo, "changelog_changes");
    repo.commit_change("packages/foo/CHANGELOG.md");

    let (options, infos, scoped) = get_options_and_packages(&repo, None, None);
    let result = get_changed_packages(&options, &infos, &scoped).unwrap();
    assert!(result.is_empty());
}

#[test]
fn returns_given_package_names_as_is() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();

    let mut cli = CliOptions::default();
    cli.package = Some(vec!["foo".to_string()]);
    let (options, infos, scoped) = get_options_and_packages(&repo, None, Some(cli));
    let result = get_changed_packages(&options, &infos, &scoped).unwrap();
    assert_eq!(result, vec!["foo"]);

    let mut cli2 = CliOptions::default();
    cli2.package = Some(vec!["foo".to_string(), "bar".to_string(), "nope".to_string()]);
    let (options2, infos2, scoped2) = get_options_and_packages(&repo, None, Some(cli2));
    let result2 = get_changed_packages(&options2, &infos2, &scoped2).unwrap();
    assert_eq!(result2, vec!["foo", "bar", "nope"]);
}

#[test]
fn returns_all_packages_with_all_true() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();

    let mut opts = BeachballOptions::default();
    opts.all = true;
    let (options, infos, scoped) = get_options_and_packages(&repo, Some(opts), None);
    let mut result = get_changed_packages(&options, &infos, &scoped).unwrap();
    result.sort();
    assert_eq!(result, vec!["a", "b", "bar", "baz", "foo"]);
}

// ===== Single package tests =====

#[test]
fn detects_changed_files_in_single_package_repo() {
    let factory = RepositoryFactory::new("single");
    let repo = factory.clone_repository();

    let (options, infos, scoped) = get_options_and_packages(&repo, None, None);
    assert!(get_changed_packages(&options, &infos, &scoped).unwrap().is_empty());

    repo.stage_change("foo.js");
    let result = get_changed_packages(&options, &infos, &scoped).unwrap();
    assert_eq!(result, vec!["foo"]);
}

#[test]
fn respects_ignore_patterns() {
    let factory = RepositoryFactory::new("single");
    let repo = factory.clone_repository();

    let mut opts = BeachballOptions::default();
    opts.ignore_patterns = Some(vec![
        "*.test.js".to_string(),
        "tests/**".to_string(),
        "yarn.lock".to_string(),
    ]);
    opts.verbose = true;

    let (options, infos, scoped) = get_options_and_packages(&repo, Some(opts), None);

    repo.write_file("src/foo.test.js");
    repo.write_file("tests/stuff.js");
    repo.write_file_content("yarn.lock", "changed");
    repo.git(&["add", "-A"]);

    let result = get_changed_packages(&options, &infos, &scoped).unwrap();
    assert!(result.is_empty());
}

// ===== Monorepo tests =====

#[test]
fn detects_changed_files_in_monorepo() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();

    let (options, infos, scoped) = get_options_and_packages(&repo, None, None);
    assert!(get_changed_packages(&options, &infos, &scoped).unwrap().is_empty());

    repo.stage_change("packages/foo/test.js");
    let result = get_changed_packages(&options, &infos, &scoped).unwrap();
    assert_eq!(result, vec!["foo"]);
}

#[test]
fn excludes_packages_with_existing_change_files() {
    let factory = RepositoryFactory::new("monorepo");
    let repo = factory.clone_repository();
    repo.checkout(&["-b", "test"]);
    repo.commit_change("packages/foo/test.js");

    let mut opts = BeachballOptions::default();
    opts.verbose = true;
    let (options, infos, scoped) = get_options_and_packages(&repo, Some(opts), None);
    generate_change_files(&["foo"], &options, &repo);

    let result = get_changed_packages(&options, &infos, &scoped).unwrap();
    assert!(result.is_empty(), "Expected empty but got: {result:?}");

    // Change bar => bar is the only changed package returned
    repo.stage_change("packages/bar/test.js");
    let result2 = get_changed_packages(&options, &infos, &scoped).unwrap();
    assert_eq!(result2, vec!["bar"]);
}

#[test]
fn ignores_package_changes_as_appropriate() {
    use serde_json::json;

    let mut packages: HashMap<String, serde_json::Value> = HashMap::new();
    packages.insert("private-pkg".to_string(), json!({
        "name": "private-pkg", "version": "1.0.0", "private": true
    }));
    packages.insert("no-publish".to_string(), json!({
        "name": "no-publish", "version": "1.0.0",
        "beachball": { "shouldPublish": false }
    }));
    packages.insert("out-of-scope".to_string(), json!({
        "name": "out-of-scope", "version": "1.0.0"
    }));
    packages.insert("ignore-pkg".to_string(), json!({
        "name": "ignore-pkg", "version": "1.0.0"
    }));
    packages.insert("publish-me".to_string(), json!({
        "name": "publish-me", "version": "1.0.0"
    }));

    let root = json!({
        "name": "test-monorepo",
        "version": "1.0.0",
        "private": true,
        "workspaces": ["packages/*"]
    });

    let factory = RepositoryFactory::new_custom(root, vec![("packages".to_string(), packages)]);
    let repo = factory.clone_repository();

    repo.stage_change("packages/private-pkg/test.js");
    repo.stage_change("packages/no-publish/test.js");
    repo.stage_change("packages/out-of-scope/test.js");
    repo.stage_change("packages/ignore-pkg/jest.config.js");
    repo.stage_change("packages/ignore-pkg/CHANGELOG.md");
    repo.stage_change("packages/publish-me/test.js");

    let mut opts = BeachballOptions::default();
    opts.scope = Some(vec!["!packages/out-of-scope".to_string()]);
    opts.ignore_patterns = Some(vec!["**/jest.config.js".to_string()]);
    opts.verbose = true;

    let (options, infos, scoped) = get_options_and_packages(&repo, Some(opts), None);
    let result = get_changed_packages(&options, &infos, &scoped).unwrap();
    assert_eq!(result, vec!["publish-me"]);
}

#[test]
fn detects_changed_files_in_multi_root_monorepo() {
    let factory = RepositoryFactory::new("multi-project");
    let repo = factory.clone_repository();

    repo.stage_change("project-a/packages/foo/test.js");

    // Test from project-a root
    let path_a = repo.path_to(&["project-a"]).to_string_lossy().to_string();
    let mut opts_a = BeachballOptions::default();
    opts_a.path = path_a.clone();
    opts_a.branch = DEFAULT_REMOTE_BRANCH.to_string();
    opts_a.fetch = false;

    let parsed_a = get_parsed_options_for_test(
        &path_a,
        CliOptions::default(),
        opts_a,
    );
    let infos_a = get_package_infos(&parsed_a.options).unwrap();
    let scoped_a = get_scoped_packages(&parsed_a.options, &infos_a);
    let result_a = get_changed_packages(&parsed_a.options, &infos_a, &scoped_a).unwrap();
    assert_eq!(result_a, vec!["@project-a/foo"]);

    // Test from project-b root
    let path_b = repo.path_to(&["project-b"]).to_string_lossy().to_string();
    let mut opts_b = BeachballOptions::default();
    opts_b.path = path_b.clone();
    opts_b.branch = DEFAULT_REMOTE_BRANCH.to_string();
    opts_b.fetch = false;

    let parsed_b = get_parsed_options_for_test(
        &path_b,
        CliOptions::default(),
        opts_b,
    );
    let infos_b = get_package_infos(&parsed_b.options).unwrap();
    let scoped_b = get_scoped_packages(&parsed_b.options, &infos_b);
    let result_b = get_changed_packages(&parsed_b.options, &infos_b, &scoped_b).unwrap();
    assert!(result_b.is_empty());
}
