use beachball::changefile::change_types::get_disallowed_change_types;
use beachball::types::change_info::ChangeType;
use beachball::types::package_info::{
    PackageGroupInfo, PackageGroups, PackageInfo, PackageInfos, PackageOptions,
};

fn make_info(name: &str) -> PackageInfo {
    PackageInfo {
        name: name.to_string(),
        package_json_path: format!("/fake/{name}/package.json"),
        version: "1.0.0".to_string(),
        private: false,
        package_options: None,
        dependencies: None,
        dev_dependencies: None,
        peer_dependencies: None,
        optional_dependencies: None,
    }
}

#[test]
fn returns_none_for_unknown_package() {
    let infos = PackageInfos::new();
    let groups = PackageGroups::new();
    let result = get_disallowed_change_types("unknown", &infos, &groups, &None);
    assert_eq!(result, None);
}

#[test]
fn falls_back_to_repo_option() {
    let mut infos = PackageInfos::new();
    infos.insert("foo".to_string(), make_info("foo"));
    let groups = PackageGroups::new();
    let repo_disallowed = Some(vec![ChangeType::Major]);

    let result = get_disallowed_change_types("foo", &infos, &groups, &repo_disallowed);
    assert_eq!(result, Some(vec![ChangeType::Major]));
}

#[test]
fn returns_package_level_disallowed() {
    let mut infos = PackageInfos::new();
    let mut info = make_info("foo");
    info.package_options = Some(PackageOptions {
        disallowed_change_types: Some(vec![ChangeType::Major, ChangeType::Minor]),
        tag: None,
        default_npm_tag: None,
        git_tags: None,
        should_publish: None,
    });
    infos.insert("foo".to_string(), info);
    let groups = PackageGroups::new();

    let result = get_disallowed_change_types("foo", &infos, &groups, &None);
    assert_eq!(result, Some(vec![ChangeType::Major, ChangeType::Minor]));
}

#[test]
fn returns_group_level_disallowed() {
    let mut infos = PackageInfos::new();
    infos.insert("foo".to_string(), make_info("foo"));

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

#[test]
fn returns_package_level_if_not_in_group() {
    let mut infos = PackageInfos::new();
    let mut info = make_info("foo");
    info.package_options = Some(PackageOptions {
        disallowed_change_types: Some(vec![ChangeType::Minor]),
        tag: None,
        default_npm_tag: None,
        git_tags: None,
        should_publish: None,
    });
    infos.insert("foo".to_string(), info);

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

#[test]
fn prefers_group_over_package() {
    let mut infos = PackageInfos::new();
    let mut info = make_info("foo");
    info.package_options = Some(PackageOptions {
        disallowed_change_types: Some(vec![ChangeType::Minor]),
        tag: None,
        default_npm_tag: None,
        git_tags: None,
        should_publish: None,
    });
    infos.insert("foo".to_string(), info);

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
