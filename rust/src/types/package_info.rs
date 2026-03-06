use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

use super::change_info::ChangeType;

pub type PackageDeps = HashMap<String, String>;

/// Raw package.json structure for deserialization.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PackageJson {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub private: Option<bool>,
    #[serde(default)]
    pub dependencies: Option<PackageDeps>,
    #[serde(default)]
    pub dev_dependencies: Option<PackageDeps>,
    #[serde(default)]
    pub peer_dependencies: Option<PackageDeps>,
    #[serde(default)]
    pub optional_dependencies: Option<PackageDeps>,
    #[serde(default)]
    pub workspaces: Option<Vec<String>>,
    /// The "beachball" config key in package.json.
    #[serde(default)]
    pub beachball: Option<serde_json::Value>,
    /// Catch-all for other fields.
    #[serde(flatten)]
    pub other: HashMap<String, serde_json::Value>,
}

/// Package-level beachball options (from the "beachball" field in package.json).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageOptions {
    pub tag: Option<String>,
    pub default_npm_tag: Option<String>,
    pub disallowed_change_types: Option<Vec<ChangeType>>,
    pub git_tags: Option<bool>,
    pub should_publish: Option<bool>,
}

/// Internal representation of a package.
#[derive(Debug, Clone)]
pub struct PackageInfo {
    pub name: String,
    pub package_json_path: String,
    pub version: String,
    pub dependencies: Option<PackageDeps>,
    pub dev_dependencies: Option<PackageDeps>,
    pub peer_dependencies: Option<PackageDeps>,
    pub optional_dependencies: Option<PackageDeps>,
    pub private: bool,
    pub package_options: Option<PackageOptions>,
}

/// Map of package name to PackageInfo.
pub type PackageInfos = HashMap<String, PackageInfo>;

/// Info about a version group.
#[derive(Debug, Clone)]
pub struct PackageGroupInfo {
    pub package_names: Vec<String>,
    pub disallowed_change_types: Option<Vec<ChangeType>>,
}

/// Map of group name to group info.
pub type PackageGroups = HashMap<String, PackageGroupInfo>;

/// Set of package names that are in scope.
pub type ScopedPackages = HashSet<String>;
