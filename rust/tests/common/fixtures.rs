use serde_json::json;
use std::collections::HashMap;

/// Return type for fixture functions: (root package.json, Vec of (folder, package map)).
pub type FixtureResult = (
    serde_json::Value,
    Vec<(String, HashMap<String, serde_json::Value>)>,
);

/// Helper macro to reduce HashMap boilerplate in fixtures.
macro_rules! packages {
    ($($key:expr => $val:expr),+ $(,)?) => {
        HashMap::from([$(($key.to_string(), $val)),+])
    };
}

/// Fixture for a single-package repo.
pub fn single_package_fixture() -> FixtureResult {
    let root = json!({
        "name": "foo",
        "version": "1.0.0",
        "dependencies": {
            "bar": "1.0.0",
            "baz": "1.0.0"
        }
    });
    (root, vec![])
}

/// Fixture for a monorepo, optionally scoped (e.g. "@project-a/foo").
pub fn monorepo_fixture() -> FixtureResult {
    monorepo_fixture_inner(None)
}

/// Fixture for a monorepo with a scope prefix (used in multi-project).
pub fn scoped_monorepo_fixture(scope: &str) -> FixtureResult {
    monorepo_fixture_inner(Some(scope))
}

fn monorepo_fixture_inner(scope: Option<&str>) -> FixtureResult {
    let name = |n: &str| match scope {
        Some(s) => format!("@{s}/{n}"),
        None => n.to_string(),
    };

    let root = json!({
        "name": name("monorepo-fixture"),
        "version": "1.0.0",
        "private": true,
        "workspaces": ["packages/*", "packages/grouped/*"],
        "beachball": {
            "groups": [{
                "disallowedChangeTypes": null,
                "name": "grouped",
                "include": "group*"
            }]
        }
    });

    let packages = packages! {
        "foo" => json!({
            "name": name("foo"),
            "version": "1.0.0",
            "dependencies": { name("bar"): "^1.3.4" },
            "main": "src/index.ts"
        }),
        "bar" => json!({
            "name": name("bar"),
            "version": "1.3.4",
            "dependencies": { name("baz"): "^1.3.4" }
        }),
        "baz" => json!({
            "name": name("baz"),
            "version": "1.3.4"
        }),
    };

    let grouped = packages! {
        "a" => json!({ "name": name("a"), "version": "3.1.2" }),
        "b" => json!({ "name": name("b"), "version": "3.1.2" }),
    };

    (
        root,
        vec![
            ("packages".to_string(), packages),
            ("packages/grouped".to_string(), grouped),
        ],
    )
}
