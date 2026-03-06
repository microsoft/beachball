use crate::types::change_info::ChangeType;
use crate::types::options::VersionGroupOptions;
use crate::types::package_info::{PackageGroups, PackageInfos};

/// Check if an auth type string is valid.
pub fn is_valid_auth_type(auth_type: &str) -> bool {
    matches!(auth_type, "authtoken" | "password")
}

/// Check if a change type string is valid.
pub fn is_valid_change_type(ct: &str) -> bool {
    ct.parse::<ChangeType>().is_ok()
}

/// Check if a change type value is valid.
pub fn is_valid_change_type_value(ct: ChangeType) -> bool {
    ChangeType::SORTED.contains(&ct)
}

/// Check if a dependent change type is valid (not disallowed).
pub fn is_valid_dependent_change_type(
    ct: ChangeType,
    disallowed: &Option<Vec<ChangeType>>,
) -> bool {
    if !is_valid_change_type_value(ct) {
        return false;
    }
    if let Some(disallowed) = disallowed {
        if disallowed.contains(&ct) {
            return false;
        }
    }
    true
}

/// Check if group options are structurally valid.
pub fn is_valid_group_options(groups: &[VersionGroupOptions]) -> bool {
    let mut valid = true;
    for group in groups {
        if group.name.is_empty() {
            eprintln!("ERROR: Group option is missing 'name'");
            valid = false;
        }
    }
    valid
}

/// Check that packages in groups don't have their own disallowedChangeTypes.
pub fn is_valid_grouped_package_options(
    package_infos: &PackageInfos,
    package_groups: &PackageGroups,
) -> bool {
    let mut valid = true;
    for group_info in package_groups.values() {
        for pkg_name in &group_info.package_names {
            if let Some(info) = package_infos.get(pkg_name) {
                if let Some(ref opts) = info.package_options {
                    if opts.disallowed_change_types.is_some() {
                        eprintln!(
                            "ERROR: Package \"{pkg_name}\" has disallowedChangeTypes but is in a group. \
                             Group-level disallowedChangeTypes take precedence."
                        );
                        valid = false;
                    }
                }
            }
        }
    }
    valid
}
