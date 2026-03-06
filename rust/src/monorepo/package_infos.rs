use anyhow::{bail, Result};
use std::path::{Path, PathBuf};

use crate::types::options::BeachballOptions;
use crate::types::package_info::{PackageInfo, PackageInfos, PackageJson, PackageOptions};

/// Get package infos for all packages in the project.
pub fn get_package_infos(options: &BeachballOptions) -> Result<PackageInfos> {
    let cwd = &options.path;
    let root_pkg_path = Path::new(cwd).join("package.json");

    if !root_pkg_path.exists() {
        bail!("No package.json found at {cwd}");
    }

    let root_pkg: PackageJson =
        serde_json::from_str(&std::fs::read_to_string(&root_pkg_path)?)?;

    let mut infos = PackageInfos::new();

    if let Some(ref workspaces) = root_pkg.workspaces {
        // Monorepo: glob each workspace pattern
        for ws_pattern in workspaces {
            let full_pattern = Path::new(cwd).join(ws_pattern);
            let pattern_str = full_pattern.to_string_lossy().to_string();

            let entries = glob::glob(&pattern_str)
                .map_err(|e| anyhow::anyhow!("invalid glob pattern {pattern_str}: {e}"))?;

            for entry in entries.flatten() {
                let pkg_json_path = entry.join("package.json");
                if pkg_json_path.exists() {
                    if let Ok(info) = read_package_info(&pkg_json_path) {
                        if infos.contains_key(&info.name) {
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
                }
            }
        }
    } else {
        // Single package repo
        let info = read_package_info(&root_pkg_path)?;
        let name = info.name.clone();
        infos.insert(name, info);
    }

    // Apply package-level options from CLI if needed
    apply_package_options(&mut infos, options);

    Ok(infos)
}

fn read_package_info(pkg_json_path: &PathBuf) -> Result<PackageInfo> {
    let contents = std::fs::read_to_string(pkg_json_path)?;
    let pkg: PackageJson = serde_json::from_str(&contents)?;

    let package_options = pkg.beachball.as_ref().and_then(|bb| {
        serde_json::from_value::<PackageOptions>(bb.clone()).ok()
    });

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
