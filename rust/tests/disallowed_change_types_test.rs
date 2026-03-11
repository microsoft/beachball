mod common;

use beachball::changefile::change_types::get_disallowed_change_types;
use beachball::types::change_info::ChangeType;
use beachball::types::package_info::{
    PackageGroupInfo, PackageGroups, PackageInfos, PackageOptions,
};
use common::{fake_root, make_package_infos_simple};

fn make_infos(name: &str) -> PackageInfos {
    make_package_infos_simple(&[name], &fake_root())
}

fn make_infos_with_disallowed(name: &str, disallowed: Vec<ChangeType>) -> PackageInfos {
    let mut infos = make_infos(name);
    infos.get_mut(name).unwrap().package_options = Some(PackageOptions {
        disallowed_change_types: Some(disallowed),
        ..Default::default()
    });
    infos
}

// Skipped TS tests (Rust uses Option<Vec> so null vs empty is handled differently):
// - "returns null if package disallowedChangeTypes is set to null"
// - "returns empty array if package disallowedChangeTypes is set to empty array"
// - "returns null if package group disallowedChangeTypes is set to null"
// - "returns empty array if package group disallowedChangeTypes is set to empty array"

// TS: "returns null for unknown package"
#[test]
fn returns_none_for_unknown_package() {
    let infos = PackageInfos::new();
    let groups = PackageGroups::new();
    let result = get_disallowed_change_types("unknown", &infos, &groups, &None);
    assert_eq!(result, None);
}

// TS: "falls back to main option for package without disallowedChangeTypes"
#[test]
fn falls_back_to_repo_option() {
    let infos = make_infos("foo");
    let groups = PackageGroups::new();
    let repo_disallowed = Some(vec![ChangeType::Major]);

    let result = get_disallowed_change_types("foo", &infos, &groups, &repo_disallowed);
    assert_eq!(result, Some(vec![ChangeType::Major]));
}

// TS: "returns disallowedChangeTypes for package"
#[test]
fn returns_package_level_disallowed() {
    let infos = make_infos_with_disallowed("foo", vec![ChangeType::Major, ChangeType::Minor]);
    let groups = PackageGroups::new();

    let result = get_disallowed_change_types("foo", &infos, &groups, &None);
    assert_eq!(result, Some(vec![ChangeType::Major, ChangeType::Minor]));
}

// TS: "returns disallowedChangeTypes for package group"
#[test]
fn returns_group_level_disallowed() {
    let infos = make_infos("foo");

    let mut groups = PackageGroups::new();
    groups.insert(
        "grp1".to_string(),
        PackageGroupInfo {
            package_names: vec!["foo".to_string()],
            disallowed_change_types: Some(vec![ChangeType::Major]),
        },
    );

    let result = get_disallowed_change_types("foo", &infos, &groups, &None);
    assert_eq!(result, Some(vec![ChangeType::Major]));
}

// TS: "returns disallowedChangeTypes for package if not in a group"
#[test]
fn returns_package_level_if_not_in_group() {
    let infos = make_infos_with_disallowed("foo", vec![ChangeType::Minor]);

    let mut groups = PackageGroups::new();
    groups.insert(
        "grp1".to_string(),
        PackageGroupInfo {
            package_names: vec!["bar".to_string()],
            disallowed_change_types: Some(vec![ChangeType::Major]),
        },
    );

    let result = get_disallowed_change_types("foo", &infos, &groups, &None);
    assert_eq!(result, Some(vec![ChangeType::Minor]));
}

// TS: "prefers disallowedChangeTypes for group over package"
#[test]
fn prefers_group_over_package() {
    let infos = make_infos_with_disallowed("foo", vec![ChangeType::Minor]);

    let mut groups = PackageGroups::new();
    groups.insert(
        "grp1".to_string(),
        PackageGroupInfo {
            package_names: vec!["foo".to_string()],
            disallowed_change_types: Some(vec![ChangeType::Major]),
        },
    );

    let result = get_disallowed_change_types("foo", &infos, &groups, &None);
    assert_eq!(result, Some(vec![ChangeType::Major]));
}
