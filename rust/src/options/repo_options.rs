use anyhow::Result;
use std::path::Path;

use crate::git::commands::{find_git_root, get_default_remote_branch};
use crate::types::change_info::ChangeType;
use crate::types::options::{BeachballOptions, VersionGroupInclude, VersionGroupOptions};

/// Repo-level config from .beachballrc.json or package.json "beachball" field.
#[derive(Debug, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawRepoConfig {
    branch: Option<String>,
    change_dir: Option<String>,
    commit: Option<bool>,
    fetch: Option<bool>,
    changehint: Option<String>,
    disallowed_change_types: Option<Vec<ChangeType>>,
    disallow_deleted_change_files: Option<bool>,
    group_changes: Option<bool>,
    ignore_patterns: Option<Vec<String>>,
    scope: Option<Vec<String>>,
    groups: Option<Vec<RawVersionGroupOptions>>,
    message: Option<String>,
    depth: Option<u32>,
    from_ref: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawVersionGroupOptions {
    name: String,
    include: serde_json::Value,
    exclude: Option<serde_json::Value>,
    disallowed_change_types: Option<Vec<ChangeType>>,
}

/// Search for and load repo-level beachball config.
/// Searches from `cwd` up to the git root for .beachballrc.json or package.json "beachball" field.
pub fn get_repo_options(cwd: &str, config_path: Option<&str>) -> Result<BeachballOptions> {
    let mut opts = BeachballOptions::default();

    let raw = if let Some(path) = config_path {
        load_json_config(path)?
    } else {
        search_for_config(cwd)?
    };

    if let Some(raw) = raw {
        apply_raw_config(&mut opts, raw, cwd)?;
    }

    Ok(opts)
}

fn search_for_config(cwd: &str) -> Result<Option<RawRepoConfig>> {
    let git_root = find_git_root(cwd).unwrap_or_else(|_| cwd.to_string());
    let git_root_path = Path::new(&git_root);
    let mut dir = Path::new(cwd).to_path_buf();

    loop {
        // Check for .beachballrc.json
        let rc_path = dir.join(".beachballrc.json");
        if rc_path.exists() {
            if let Ok(config) = load_json_config(rc_path.to_str().unwrap_or_default()) {
                return Ok(config);
            }
        }

        // Check for package.json "beachball" field
        let pkg_path = dir.join("package.json");
        if pkg_path.exists() {
            if let Ok(Some(config)) = load_from_package_json(pkg_path.to_str().unwrap_or_default())
            {
                return Ok(Some(config));
            }
        }

        // Stop at git root
        if dir == git_root_path {
            break;
        }
        if !dir.pop() {
            break;
        }
    }

    Ok(None)
}

fn load_json_config(path: &str) -> Result<Option<RawRepoConfig>> {
    let contents = std::fs::read_to_string(path)?;
    let config: RawRepoConfig = serde_json::from_str(&contents)?;
    Ok(Some(config))
}

fn load_from_package_json(path: &str) -> Result<Option<RawRepoConfig>> {
    let contents = std::fs::read_to_string(path)?;
    let pkg: serde_json::Value = serde_json::from_str(&contents)?;
    if let Some(beachball) = pkg.get("beachball") {
        let config: RawRepoConfig = serde_json::from_value(beachball.clone())?;
        return Ok(Some(config));
    }
    Ok(None)
}

fn apply_raw_config(opts: &mut BeachballOptions, raw: RawRepoConfig, cwd: &str) -> Result<()> {
    if let Some(branch) = raw.branch {
        // If branch doesn't contain '/', resolve the remote
        if branch.contains('/') {
            opts.branch = branch;
        } else {
            let default = get_default_remote_branch(cwd)?;
            if let Some((remote, _)) = super::super::git::commands::parse_remote_branch(&default) {
                opts.branch = format!("{remote}/{branch}");
            } else {
                opts.branch = format!("origin/{branch}");
            }
        }
    }

    if let Some(v) = raw.change_dir {
        opts.change_dir = v;
    }
    if let Some(v) = raw.commit {
        opts.commit = v;
    }
    if let Some(v) = raw.fetch {
        opts.fetch = v;
    }
    if let Some(v) = raw.changehint {
        opts.changehint = v;
    }
    if let Some(v) = raw.disallowed_change_types {
        opts.disallowed_change_types = Some(v);
    }
    if let Some(v) = raw.disallow_deleted_change_files {
        opts.disallow_deleted_change_files = v;
    }
    if let Some(v) = raw.group_changes {
        opts.group_changes = v;
    }
    if let Some(v) = raw.ignore_patterns {
        opts.ignore_patterns = Some(v);
    }
    if let Some(v) = raw.scope {
        opts.scope = Some(v);
    }
    if let Some(v) = raw.message {
        opts.message = v;
    }
    if let Some(v) = raw.depth {
        opts.depth = Some(v);
    }
    if let Some(v) = raw.from_ref {
        opts.from_ref = Some(v);
    }
    if let Some(raw_groups) = raw.groups {
        let groups = raw_groups
            .into_iter()
            .map(|g| {
                let include = match &g.include {
                    serde_json::Value::Bool(true) => VersionGroupInclude::All,
                    serde_json::Value::String(s) => {
                        VersionGroupInclude::Patterns(vec![s.clone()])
                    }
                    serde_json::Value::Array(arr) => VersionGroupInclude::Patterns(
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect(),
                    ),
                    _ => VersionGroupInclude::Patterns(vec![]),
                };

                let exclude = g.exclude.map(|e| match e {
                    serde_json::Value::String(s) => vec![s],
                    serde_json::Value::Array(arr) => arr
                        .iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect(),
                    _ => vec![],
                });

                VersionGroupOptions {
                    name: g.name,
                    include,
                    exclude,
                    disallowed_change_types: g.disallowed_change_types,
                }
            })
            .collect();
        opts.groups = Some(groups);
    }

    Ok(())
}
