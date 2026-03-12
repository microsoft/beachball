use anyhow::{Result, bail};
use std::path::{Path, PathBuf};

use crate::log_error;
use crate::monorepo::workspace_manager::{detect_workspace_manager, get_workspace_patterns};
use crate::types::options::BeachballOptions;
use crate::types::package_info::{PackageInfo, PackageInfos, PackageJson, PackageOptions};

/// Get package infos for all packages in the project.
pub fn get_package_infos(options: &BeachballOptions) -> Result<PackageInfos> {
    let cwd = &options.path;
    let mut infos = PackageInfos::new();

    let manager = detect_workspace_manager(cwd);
    let (patterns, literal) = get_workspace_patterns(cwd, manager);

    if patterns.is_empty() {
        // Single package repo
        let root_pkg_path = Path::new(cwd).join("package.json");
        if !root_pkg_path.exists() {
            bail!("No package.json found at {cwd}");
        }
        let info = read_package_info(&root_pkg_path)?;
        let name = info.name.clone();
        infos.insert(name, info);
        return Ok(infos);
    }

    // Monorepo: add root package if it exists
    let root_pkg_path = Path::new(cwd).join("package.json");
    if root_pkg_path.exists()
        && let Ok(info) = read_package_info(&root_pkg_path)
        && !info.name.is_empty()
    {
        let name = info.name.clone();
        infos.insert(name, info);
    }

    if literal {
        // Rush: patterns are literal paths
        for p in &patterns {
            let pkg_json_path = Path::new(cwd).join(p).join("package.json");
            if pkg_json_path.exists() {
                add_package_info(&mut infos, &pkg_json_path)?;
            }
        }
    } else {
        // Glob-based managers (npm, yarn, pnpm, lerna)
        for pattern in &patterns {
            let full_pattern = Path::new(cwd).join(pattern);
            let pattern_str = full_pattern.to_string_lossy().to_string();

            let entries = glob::glob(&pattern_str)
                .map_err(|e| anyhow::anyhow!("invalid glob pattern {pattern_str}: {e}"))?;

            for entry in entries.flatten() {
                let pkg_json_path = entry.join("package.json");
                let path_str = pkg_json_path.to_string_lossy();
                if path_str.contains("node_modules") || path_str.contains("__fixtures__") {
                    continue;
                }
                if pkg_json_path.exists() {
                    add_package_info(&mut infos, &pkg_json_path)?;
                }
            }
        }
    }

    // Apply package-level options from CLI if needed
    apply_package_options(&mut infos, options);

    Ok(infos)
}

fn add_package_info(infos: &mut PackageInfos, pkg_json_path: &PathBuf) -> Result<()> {
    if let Ok(info) = read_package_info(pkg_json_path) {
        if infos.contains_key(&info.name) {
            log_error!(
                "Two packages have the same name \"{}\". Please rename one of these packages:\n{}",
                info.name,
                crate::logging::bulleted_list(&[
                    &infos[&info.name].package_json_path,
                    &info.package_json_path,
                ])
            );
            bail!(
                "Duplicate package name \"{}\" found at {} and {}",
                info.name,
                infos[&info.name].package_json_path,
                info.package_json_path
            );
        }
        let name = info.name.clone();
        infos.insert(name, info);
    }
    Ok(())
}

fn read_package_info(pkg_json_path: &PathBuf) -> Result<PackageInfo> {
    let contents = std::fs::read_to_string(pkg_json_path)?;
    let pkg: PackageJson = serde_json::from_str(&contents)?;

    let package_options = pkg
        .beachball
        .as_ref()
        .and_then(|bb| serde_json::from_value::<PackageOptions>(bb.clone()).ok());

    Ok(PackageInfo {
        name: pkg.name.clone(),
        package_json_path: pkg_json_path.to_string_lossy().to_string(),
        version: pkg.version,
        dependencies: pkg.dependencies,
        dev_dependencies: pkg.dev_dependencies,
        peer_dependencies: pkg.peer_dependencies,
        optional_dependencies: pkg.optional_dependencies,
        private: pkg.private.unwrap_or(false),
        package_options,
    })
}

fn apply_package_options(_infos: &mut PackageInfos, _options: &BeachballOptions) {
    // CLI-level disallowedChangeTypes etc. are applied during validation, not here.
    // Package-level options are already read from the beachball field.
}

/// Get the relative path of a package directory from the root.
pub fn get_package_rel_path(package_info: &PackageInfo, root: &str) -> String {
    let pkg_dir = Path::new(&package_info.package_json_path)
        .parent()
        .unwrap_or(Path::new("."));
    let root_path = Path::new(root);
    pkg_dir
        .strip_prefix(root_path)
        .unwrap_or(pkg_dir)
        .to_string_lossy()
        .replace('\\', "/")
}
