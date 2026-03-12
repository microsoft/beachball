mod common;

use beachball::monorepo::package_infos::get_package_infos;
use beachball::options::get_options::get_parsed_options_for_test;
use beachball::types::options::{BeachballOptions, CliOptions};
use common::DEFAULT_REMOTE_BRANCH;
use common::repository_factory::RepositoryFactory;
use serde_json::json;
use std::collections::HashMap;

fn make_opts() -> BeachballOptions {
    BeachballOptions {
        branch: DEFAULT_REMOTE_BRANCH.to_string(),
        fetch: false,
        ..Default::default()
    }
}

#[test]
fn pnpm_workspace_detection() {
    let root = json!({
        "name": "pnpm-monorepo",
        "version": "1.0.0",
        "private": true
    });
    let packages = HashMap::from([
        (
            "foo".to_string(),
            json!({"name": "foo", "version": "1.0.0"}),
        ),
        (
            "bar".to_string(),
            json!({"name": "bar", "version": "1.0.0"}),
        ),
    ]);
    let factory = RepositoryFactory::new_custom(root, vec![("packages".to_string(), packages)]);
    let repo = factory.clone_repository();

    // Remove yarn.lock (added by factory) and add pnpm-workspace.yaml
    repo.git(&["rm", "yarn.lock"]);
    repo.write_file_content("pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");
    repo.git(&["add", "-A"]);
    repo.git(&["commit", "-m", "switch to pnpm"]);

    let parsed = get_parsed_options_for_test(repo.root_path(), CliOptions::default(), make_opts());
    let infos = get_package_infos(&parsed.options).unwrap();

    assert!(infos.contains_key("foo"), "expected foo in {infos:?}");
    assert!(infos.contains_key("bar"), "expected bar in {infos:?}");
}

#[test]
fn lerna_workspace_detection() {
    let root = json!({
        "name": "lerna-monorepo",
        "version": "1.0.0",
        "private": true
    });
    let packages = HashMap::from([
        (
            "foo".to_string(),
            json!({"name": "foo", "version": "1.0.0"}),
        ),
        (
            "bar".to_string(),
            json!({"name": "bar", "version": "1.0.0"}),
        ),
    ]);
    let factory = RepositoryFactory::new_custom(root, vec![("packages".to_string(), packages)]);
    let repo = factory.clone_repository();

    // Add lerna.json
    repo.write_file_content("lerna.json", r#"{"packages": ["packages/*"]}"#);
    repo.git(&["add", "-A"]);
    repo.git(&["commit", "-m", "add lerna config"]);

    let parsed = get_parsed_options_for_test(repo.root_path(), CliOptions::default(), make_opts());
    let infos = get_package_infos(&parsed.options).unwrap();

    assert!(infos.contains_key("foo"), "expected foo in {infos:?}");
    assert!(infos.contains_key("bar"), "expected bar in {infos:?}");
}

#[test]
fn rush_workspace_detection() {
    let root = json!({
        "name": "rush-monorepo",
        "version": "1.0.0",
        "private": true
    });
    let packages = HashMap::from([
        (
            "foo".to_string(),
            json!({"name": "foo", "version": "1.0.0"}),
        ),
        (
            "bar".to_string(),
            json!({"name": "bar", "version": "1.0.0"}),
        ),
    ]);
    let factory = RepositoryFactory::new_custom(root, vec![("packages".to_string(), packages)]);
    let repo = factory.clone_repository();

    // Remove yarn.lock (added by factory) and add rush.json
    repo.git(&["rm", "yarn.lock"]);
    repo.write_file_content(
        "rush.json",
        r#"{
        "projects": [
            {"packageName": "foo", "projectFolder": "packages/foo"},
            {"packageName": "bar", "projectFolder": "packages/bar"}
        ]
    }"#,
    );
    repo.git(&["add", "-A"]);
    repo.git(&["commit", "-m", "add rush config"]);

    let parsed = get_parsed_options_for_test(repo.root_path(), CliOptions::default(), make_opts());
    let infos = get_package_infos(&parsed.options).unwrap();

    assert!(infos.contains_key("foo"), "expected foo in {infos:?}");
    assert!(infos.contains_key("bar"), "expected bar in {infos:?}");
}
