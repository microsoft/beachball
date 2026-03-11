use std::path::Path;

use crate::git::commands::MANAGER_FILES;

/// Workspace/monorepo manager type.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WorkspaceManager {
    Npm,
    Yarn,
    Pnpm,
    Lerna,
    Rush,
}

/// Map from manager config file name to manager type.
fn manager_for_file(filename: &str) -> WorkspaceManager {
    match filename {
        "lerna.json" => WorkspaceManager::Lerna,
        "rush.json" => WorkspaceManager::Rush,
        "yarn.lock" => WorkspaceManager::Yarn,
        "pnpm-workspace.yaml" => WorkspaceManager::Pnpm,
        "package-lock.json" => WorkspaceManager::Npm,
        _ => WorkspaceManager::Npm,
    }
}

/// Detect the workspace manager by checking for config files in precedence order.
pub fn detect_workspace_manager(root: &str) -> WorkspaceManager {
    let root_path = Path::new(root);
    for file in MANAGER_FILES {
        if root_path.join(file).exists() {
            return manager_for_file(file);
        }
    }
    WorkspaceManager::Npm
}

/// Get workspace patterns for the detected manager.
/// Returns (patterns, is_literal) where is_literal=true means paths not globs (rush).
pub fn get_workspace_patterns(root: &str, manager: WorkspaceManager) -> (Vec<String>, bool) {
    match manager {
        WorkspaceManager::Pnpm => (get_pnpm_patterns(root), false),
        WorkspaceManager::Lerna => (get_lerna_patterns(root), false),
        WorkspaceManager::Rush => (get_rush_paths(root), true),
        _ => (get_npm_yarn_patterns(root), false),
    }
}

/// Read workspace patterns from package.json workspaces field (npm/yarn).
fn get_npm_yarn_patterns(root: &str) -> Vec<String> {
    let pkg_path = Path::new(root).join("package.json");
    let data = match std::fs::read_to_string(&pkg_path) {
        Ok(d) => d,
        Err(_) => return vec![],
    };

    // Try array format: "workspaces": ["packages/*"]
    #[derive(serde::Deserialize)]
    struct ArrayFormat {
        workspaces: Option<Vec<String>>,
    }
    if let Ok(parsed) = serde_json::from_str::<ArrayFormat>(&data) {
        if let Some(ws) = parsed.workspaces {
            if !ws.is_empty() {
                return ws;
            }
        }
    }

    // Try object format: "workspaces": {"packages": ["packages/*"]}
    #[derive(serde::Deserialize)]
    struct ObjectFormat {
        workspaces: Option<WorkspacesObject>,
    }
    #[derive(serde::Deserialize)]
    struct WorkspacesObject {
        packages: Option<Vec<String>>,
    }
    if let Ok(parsed) = serde_json::from_str::<ObjectFormat>(&data) {
        if let Some(ws) = parsed.workspaces {
            if let Some(pkgs) = ws.packages {
                if !pkgs.is_empty() {
                    return pkgs;
                }
            }
        }
    }

    vec![]
}

/// Read workspace patterns from pnpm-workspace.yaml.
fn get_pnpm_patterns(root: &str) -> Vec<String> {
    let yaml_path = Path::new(root).join("pnpm-workspace.yaml");
    let data = match std::fs::read_to_string(&yaml_path) {
        Ok(d) => d,
        Err(_) => return vec![],
    };

    #[derive(serde::Deserialize)]
    struct PnpmWorkspace {
        packages: Option<Vec<String>>,
    }

    match serde_yaml::from_str::<PnpmWorkspace>(&data) {
        Ok(config) => config.packages.unwrap_or_default(),
        Err(_) => vec![],
    }
}

/// Read workspace patterns from lerna.json. Falls back to npm/pnpm if absent.
fn get_lerna_patterns(root: &str) -> Vec<String> {
    let lerna_path = Path::new(root).join("lerna.json");
    if let Ok(data) = std::fs::read_to_string(&lerna_path) {
        #[derive(serde::Deserialize)]
        struct LernaConfig {
            packages: Option<Vec<String>>,
        }
        if let Ok(config) = serde_json::from_str::<LernaConfig>(&data) {
            if let Some(pkgs) = config.packages {
                if !pkgs.is_empty() {
                    return pkgs;
                }
            }
        }
    }

    // Lerna without packages: delegate to the actual package manager
    if Path::new(root).join("pnpm-workspace.yaml").exists() {
        return get_pnpm_patterns(root);
    }
    get_npm_yarn_patterns(root)
}

/// Read project paths from rush.json (literal paths, not globs).
fn get_rush_paths(root: &str) -> Vec<String> {
    let rush_path = Path::new(root).join("rush.json");
    let data = match std::fs::read_to_string(&rush_path) {
        Ok(d) => d,
        Err(_) => return vec![],
    };

    #[derive(serde::Deserialize)]
    struct RushConfig {
        projects: Option<Vec<RushProject>>,
    }
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct RushProject {
        project_folder: String,
    }

    match serde_json::from_str::<RushConfig>(&data) {
        Ok(config) => config
            .projects
            .unwrap_or_default()
            .into_iter()
            .map(|p| p.project_folder)
            .collect(),
        Err(_) => vec![],
    }
}
