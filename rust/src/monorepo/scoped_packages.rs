use crate::types::options::BeachballOptions;
use crate::types::package_info::{PackageInfos, ScopedPackages};

use super::package_infos::get_package_rel_path;
use super::path_included::is_path_included;

/// Get the set of packages that are in scope based on scope patterns.
pub fn get_scoped_packages(
    options: &BeachballOptions,
    package_infos: &PackageInfos,
) -> ScopedPackages {
    let scope = match &options.scope {
        Some(s) if !s.is_empty() => s,
        _ => {
            // No scope filtering: return all package names
            return package_infos.keys().cloned().collect();
        }
    };

    package_infos
        .values()
        .filter(|info| {
            let rel_path = get_package_rel_path(info, &options.path);
            is_path_included(&rel_path, scope)
        })
        .map(|info| info.name.clone())
        .collect()
}
