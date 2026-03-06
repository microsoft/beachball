use crate::types::change_info::ChangeType;

/// Check if a string is a valid change type.
pub fn is_valid_change_type(s: &str) -> bool {
    s.parse::<ChangeType>().is_ok()
}

/// Check if a change type value is valid.
pub fn is_valid_change_type_value(ct: ChangeType) -> bool {
    ChangeType::SORTED.contains(&ct)
}

/// Get the disallowed change types for a package, considering package options,
/// group options, and repo-level options.
pub fn get_disallowed_change_types(
    package_name: &str,
    package_infos: &crate::types::package_info::PackageInfos,
    package_groups: &crate::types::package_info::PackageGroups,
    repo_disallowed: &Option<Vec<ChangeType>>,
) -> Option<Vec<ChangeType>> {
    // Check if the package is in a group (group disallowedChangeTypes take precedence)
    for group_info in package_groups.values() {
        if group_info.package_names.contains(&package_name.to_string())
            && group_info.disallowed_change_types.is_some()
        {
            return group_info.disallowed_change_types.clone();
        }
    }

    // Check package-level options
    if let Some(info) = package_infos.get(package_name)
        && let Some(ref opts) = info.package_options
        && opts.disallowed_change_types.is_some()
    {
        return opts.disallowed_change_types.clone();
    }

    // Fall back to repo-level
    repo_disallowed.clone()
}
