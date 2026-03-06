use serde_json::json;
use std::collections::HashMap;

/// Return type for fixture functions: (root package.json, Vec of (folder, package map)).
pub type FixtureResult = (
    serde_json::Value,
    Vec<(String, HashMap<String, serde_json::Value>)>,
);

/// Package definition for a fixture.
pub struct PackageFixture {
    pub name: Option<String>,
    pub version: String,
    pub private: Option<bool>,
    pub dependencies: Option<HashMap<String, String>>,
    pub beachball: Option<serde_json::Value>,
    pub other: Option<serde_json::Value>,
}

impl PackageFixture {
    pub fn to_json(&self, default_name: &str) -> serde_json::Value {
        let mut obj = serde_json::Map::new();
        obj.insert(
            "name".to_string(),
            json!(self.name.as_deref().unwrap_or(default_name)),
        );
        obj.insert("version".to_string(), json!(self.version));
        if let Some(private) = self.private {
            obj.insert("private".to_string(), json!(private));
        }
        if let Some(ref deps) = self.dependencies {
            obj.insert("dependencies".to_string(), json!(deps));
        }
        if let Some(ref bb) = self.beachball {
            obj.insert("beachball".to_string(), bb.clone());
        }
        if let Some(ref other) = self.other
            && let serde_json::Value::Object(map) = other
        {
            for (k, v) in map {
                obj.insert(k.clone(), v.clone());
            }
        }
        serde_json::Value::Object(obj)
    }
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

/// Fixture for a monorepo.
pub fn monorepo_fixture() -> FixtureResult {
    let root = json!({
        "name": "monorepo-fixture",
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

    let packages: HashMap<String, serde_json::Value> = HashMap::from([
        (
            "foo".to_string(),
            json!({
                "name": "foo",
                "version": "1.0.0",
                "dependencies": { "bar": "^1.3.4" },
                "main": "src/index.ts"
            }),
        ),
        (
            "bar".to_string(),
            json!({
                "name": "bar",
                "version": "1.3.4",
                "dependencies": { "baz": "^1.3.4" }
            }),
        ),
        (
            "baz".to_string(),
            json!({
                "name": "baz",
                "version": "1.3.4"
            }),
        ),
    ]);

    let grouped: HashMap<String, serde_json::Value> = HashMap::from([
        (
            "a".to_string(),
            json!({
                "name": "a",
                "version": "3.1.2"
            }),
        ),
        (
            "b".to_string(),
            json!({
                "name": "b",
                "version": "3.1.2"
            }),
        ),
    ]);

    (
        root,
        vec![
            ("packages".to_string(), packages),
            ("packages/grouped".to_string(), grouped),
        ],
    )
}

/// Fixture for a monorepo with a scope prefix (used in multi-project).
pub fn scoped_monorepo_fixture(scope: &str) -> FixtureResult {
    let root = json!({
        "name": format!("@{scope}/monorepo-fixture"),
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

    let packages: HashMap<String, serde_json::Value> = HashMap::from([
        (
            "foo".to_string(),
            json!({
                "name": format!("@{scope}/foo"),
                "version": "1.0.0",
                "dependencies": { format!("@{scope}/bar"): "^1.3.4" },
                "main": "src/index.ts"
            }),
        ),
        (
            "bar".to_string(),
            json!({
                "name": format!("@{scope}/bar"),
                "version": "1.3.4",
                "dependencies": { format!("@{scope}/baz"): "^1.3.4" }
            }),
        ),
        (
            "baz".to_string(),
            json!({
                "name": format!("@{scope}/baz"),
                "version": "1.3.4"
            }),
        ),
    ]);

    let grouped: HashMap<String, serde_json::Value> = HashMap::from([
        (
            "a".to_string(),
            json!({
                "name": format!("@{scope}/a"),
                "version": "3.1.2"
            }),
        ),
        (
            "b".to_string(),
            json!({
                "name": format!("@{scope}/b"),
                "version": "3.1.2"
            }),
        ),
    ]);

    (
        root,
        vec![
            ("packages".to_string(), packages),
            ("packages/grouped".to_string(), grouped),
        ],
    )
}
