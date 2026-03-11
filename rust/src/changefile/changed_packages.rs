use anyhow::Result;
use std::collections::HashSet;
use std::path::Path;

use crate::git::commands;
use crate::git::ensure_shared_history::ensure_shared_history;
use crate::log_info;
use crate::log_verbose;
use crate::monorepo::filter_ignored::filter_ignored_files;
use crate::types::change_info::{ChangeFileInfo, ChangeInfoMultiple};
use crate::types::options::BeachballOptions;
use crate::types::package_info::{PackageInfo, PackageInfos, ScopedPackages};

use super::read_change_files::get_change_path;

/// Check whether a package should be included in changed packages.
fn is_package_included(
    package_info: Option<&PackageInfo>,
    scoped_packages: &ScopedPackages,
) -> (bool, String) {
    match package_info {
        None => (false, "no corresponding package found".to_string()),
        Some(info) if info.private => (false, format!("{} is private", info.name)),
        Some(info)
            if info.package_options.as_ref().and_then(|o| o.should_publish) == Some(false) =>
        {
            (
                false,
                format!("{} has beachball.shouldPublish=false", info.name),
            )
        }
        Some(info) if !scoped_packages.contains(&info.name) => {
            (false, format!("{} is out of scope", info.name))
        }
        _ => (true, String::new()),
    }
}

/// Find which package a changed file belongs to by walking up directories.
fn get_matching_package<'a>(
    file: &str,
    cwd: &str,
    packages_by_path: &'a std::collections::HashMap<String, &'a PackageInfo>,
) -> Option<&'a PackageInfo> {
    let cwd_path = Path::new(cwd);
    let abs_file = cwd_path.join(file);
    let mut dir = abs_file.parent()?;

    loop {
        let dir_str = dir.to_string_lossy().to_string();
        if let Some(info) = packages_by_path.get(&dir_str) {
            return Some(info);
        }
        if dir == cwd_path {
            break;
        }
        dir = dir.parent()?;
    }
    None
}

/// Get all changed packages regardless of existing change files.
fn get_all_changed_packages(
    options: &BeachballOptions,
    package_infos: &PackageInfos,
    scoped_packages: &ScopedPackages,
) -> Result<Vec<String>> {
    let cwd = &options.path;

    // If --all, return all in-scope non-private packages
    if options.all {
        log_verbose!(
            "--all option was provided, so including all packages that are in scope (regardless of changes)"
        );
        let mut result: Vec<String> = vec![];
        for pkg in package_infos.values() {
            let (included, reason) = is_package_included(Some(pkg), scoped_packages);
            if included {
                log_verbose!("  - {}", pkg.name);
                result.push(pkg.name.clone());
            } else {
                let short_reason = reason.strip_prefix(&format!("{} ", pkg.name)).unwrap_or(&reason);
                log_verbose!("  - ~~{}~~ ({})", pkg.name, short_reason);
            }
        }
        return Ok(result);
    }

    log_info!("Checking for changes against \"{}\"", options.branch);

    ensure_shared_history(options)?;

    // With --relative, git returns paths relative to cwd (options.path).
    // Canonicalize to resolve symlinks (e.g. macOS /tmp -> /private/tmp) so paths
    // from git match paths from package_json_path.
    let canonical_cwd = std::fs::canonicalize(cwd)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| cwd.to_string());

    let mut changes = commands::get_branch_changes(&options.branch, cwd)?;
    let staged = commands::get_staged_changes(cwd)?;
    changes.extend(staged);

    {
        let count = changes.len();
        log_verbose!(
            "Found {} changed file{} in current branch (before filtering)",
            count,
            if count == 1 { "" } else { "s" }
        );
    }

    if changes.is_empty() {
        return Ok(vec![]);
    }

    // Filter ignored files
    let mut ignore_patterns: Vec<String> = options.ignore_patterns.clone().unwrap_or_default();
    ignore_patterns.push(format!("{}/*.json", options.change_dir));
    ignore_patterns.push("CHANGELOG.{md,json}".to_string());

    // For CHANGELOG matching, we need to handle the brace expansion manually
    // since globset doesn't support {md,json} syntax the same way
    let expanded_patterns: Vec<String> = ignore_patterns
        .iter()
        .flat_map(|p| {
            if p.contains('{') && p.contains('}') {
                // Simple brace expansion for common case
                let start = p.find('{').unwrap();
                let end = p.find('}').unwrap();
                let prefix = &p[..start];
                let suffix = &p[end + 1..];
                let alts = &p[start + 1..end];
                alts.split(',')
                    .map(|alt| format!("{prefix}{alt}{suffix}"))
                    .collect::<Vec<_>>()
            } else {
                vec![p.clone()]
            }
        })
        .collect();

    let non_ignored = filter_ignored_files(&changes, &expanded_patterns);

    if non_ignored.is_empty() {
        log_verbose!("All files were ignored");
        return Ok(vec![]);
    }

    // Build a map from package directory path to PackageInfo.
    // Canonicalize paths to match the canonicalized git_root.
    let mut packages_by_path: std::collections::HashMap<String, &PackageInfo> =
        std::collections::HashMap::new();
    for info in package_infos.values() {
        let dir = Path::new(&info.package_json_path)
            .parent()
            .unwrap_or(Path::new("."));
        let canonical = std::fs::canonicalize(dir)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| dir.to_string_lossy().to_string());
        packages_by_path.insert(canonical, info);
    }

    let mut included_packages: HashSet<String> = HashSet::new();
    let mut file_count = 0;

    for file in &non_ignored {
        let pkg_info = get_matching_package(file, &canonical_cwd, &packages_by_path);
        let (included, reason) = is_package_included(pkg_info, scoped_packages);

        if !included {
            log_verbose!("  - ~~{file}~~ ({reason})");
        } else {
            included_packages.insert(pkg_info.unwrap().name.clone());
            file_count += 1;
            log_verbose!("  - {file}");
        }
    }

    {
        let pkg_count = included_packages.len();
        log_verbose!(
            "Found {} file{} in {} package{} that should be published",
            file_count,
            if file_count == 1 { "" } else { "s" },
            pkg_count,
            if pkg_count == 1 { "" } else { "s" },
        );
    }

    Ok(included_packages.into_iter().collect())
}

/// Get changed packages that don't already have change files.
/// If `options.package` is set, return those as-is.
/// If `options.all` is set, return all in-scope packages.
pub fn get_changed_packages(
    options: &BeachballOptions,
    package_infos: &PackageInfos,
    scoped_packages: &ScopedPackages,
) -> Result<Vec<String>> {
    // If --package is specified, return those names directly
    if let Some(ref packages) = options.package {
        return Ok(packages.clone());
    }

    let changed_packages = get_all_changed_packages(options, package_infos, scoped_packages)?;

    let change_path = get_change_path(options);
    if !Path::new(&change_path).exists() {
        return Ok(changed_packages);
    }

    // Check which packages already have change files
    let change_files = commands::get_changes_between_refs(
        &options.branch,
        Some("A"),
        Some("*.json"),
        &change_path,
    )
    .unwrap_or_default();

    let mut existing_packages: HashSet<String> = HashSet::new();

    for file in &change_files {
        let file_path = Path::new(&change_path).join(file);
        if let Ok(contents) = std::fs::read_to_string(&file_path) {
            if let Ok(multi) = serde_json::from_str::<ChangeInfoMultiple>(&contents) {
                for change in &multi.changes {
                    existing_packages.insert(change.package_name.clone());
                }
            } else if let Ok(single) = serde_json::from_str::<ChangeFileInfo>(&contents) {
                existing_packages.insert(single.package_name.clone());
            }
        }
    }

    if !existing_packages.is_empty() {
        let mut sorted: Vec<&String> = existing_packages.iter().collect();
        sorted.sort();
        log_info!(
            "Your local repository already has change files for these packages:\n{}",
            crate::logging::bulleted_list(&sorted.iter().map(|s| s.as_str()).collect::<Vec<_>>())
        );
    }

    Ok(changed_packages
        .into_iter()
        .filter(|pkg| !existing_packages.contains(pkg))
        .collect())
}
