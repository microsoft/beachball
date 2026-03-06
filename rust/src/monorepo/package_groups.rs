use anyhow::{bail, Result};

use crate::types::options::VersionGroupInclude;
use crate::types::package_info::{PackageGroupInfo, PackageGroups, PackageInfos};

use super::package_infos::get_package_rel_path;
use super::path_included::is_path_included;

/// Build package groups from the groups config.
pub fn get_package_groups(
    package_infos: &PackageInfos,
    root: &str,
    groups: &Option<Vec<crate::types::options::VersionGroupOptions>>,
) -> Result<PackageGroups> {
    let groups = match groups {
        Some(g) => g,
        None => return Ok(PackageGroups::new()),
    };

    let mut result = PackageGroups::new();
    // Track which group each package belongs to (for multi-group detection)
    let mut package_to_group: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();

    for group in groups {
        let mut package_names = Vec::new();

        for info in package_infos.values() {
            let rel_path = get_package_rel_path(info, root);

            let included = match &group.include {
                VersionGroupInclude::All => true,
                VersionGroupInclude::Patterns(patterns) => is_path_included(&rel_path, patterns),
            };

            if !included {
                continue;
            }

            // Check exclude patterns
            if let Some(ref exclude) = group.exclude
                && !is_path_included(&rel_path, exclude) {
                    continue;
                }

            // Check for multi-group membership
            if let Some(existing_group) = package_to_group.get(&info.name) {
                bail!(
                    "Package \"{}\" belongs to multiple groups: \"{}\" and \"{}\"",
                    info.name,
                    existing_group,
                    group.name
                );
            }

            package_to_group.insert(info.name.clone(), group.name.clone());
            package_names.push(info.name.clone());
        }

        result.insert(
            group.name.clone(),
            PackageGroupInfo {
                package_names,
                disallowed_change_types: group.disallowed_change_types.clone(),
            },
        );
    }

    Ok(result)
}
