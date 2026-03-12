mod common;

use beachball::monorepo::package_groups::get_package_groups;
use beachball::types::options::{VersionGroupInclude, VersionGroupOptions};
use common::{fake_root, make_package_infos};

// TS: "returns empty object if no groups are defined"
#[test]
fn returns_empty_if_no_groups_defined() {
    let root = fake_root();
    let infos = make_package_infos(&[("foo", "packages/foo")], &root);
    let result = get_package_groups(&infos, &root, &None).unwrap();
    assert!(result.is_empty());
}

// TS: "returns groups based on specific folders"
#[test]
fn returns_groups_based_on_specific_folders() {
    let root = fake_root();
    let infos = make_package_infos(
        &[
            ("pkg-a", "packages/pkg-a"),
            ("pkg-b", "packages/pkg-b"),
            ("pkg-c", "other/pkg-c"),
            ("pkg-d", "other/pkg-d"),
        ],
        &root,
    );

    let groups = Some(vec![
        VersionGroupOptions {
            name: "grp1".to_string(),
            include: VersionGroupInclude::Patterns(vec!["packages/*".to_string()]),
            exclude: None,
            disallowed_change_types: None,
        },
        VersionGroupOptions {
            name: "grp2".to_string(),
            include: VersionGroupInclude::Patterns(vec!["other/*".to_string()]),
            exclude: None,
            disallowed_change_types: None,
        },
    ]);

    let result = get_package_groups(&infos, &root, &groups).unwrap();
    assert_eq!(result.len(), 2);

    let mut grp1_pkgs = result["grp1"].package_names.clone();
    grp1_pkgs.sort();
    assert_eq!(grp1_pkgs, vec!["pkg-a", "pkg-b"]);

    let mut grp2_pkgs = result["grp2"].package_names.clone();
    grp2_pkgs.sort();
    assert_eq!(grp2_pkgs, vec!["pkg-c", "pkg-d"]);
}

// TS: "handles single-level globs"
#[test]
fn handles_single_level_globs() {
    let root = fake_root();
    let infos = make_package_infos(
        &[
            ("ui-pkg-1", "packages/ui-pkg-1"),
            ("ui-pkg-2", "packages/ui-pkg-2"),
            ("data-pkg-1", "packages/data-pkg-1"),
        ],
        &root,
    );

    let groups = Some(vec![VersionGroupOptions {
        name: "ui".to_string(),
        include: VersionGroupInclude::Patterns(vec!["packages/ui-*".to_string()]),
        exclude: None,
        disallowed_change_types: None,
    }]);

    let result = get_package_groups(&infos, &root, &groups).unwrap();
    let mut ui_pkgs = result["ui"].package_names.clone();
    ui_pkgs.sort();
    assert_eq!(ui_pkgs, vec!["ui-pkg-1", "ui-pkg-2"]);
}

// TS: "handles multi-level globs"
#[test]
fn handles_multi_level_globs() {
    let root = fake_root();
    let infos = make_package_infos(
        &[
            ("nested-a", "packages/ui/nested-a"),
            ("nested-b", "packages/ui/sub/nested-b"),
            ("other", "packages/data/other"),
        ],
        &root,
    );

    let groups = Some(vec![VersionGroupOptions {
        name: "ui".to_string(),
        include: VersionGroupInclude::Patterns(vec!["packages/ui/**/*".to_string()]),
        exclude: None,
        disallowed_change_types: None,
    }]);

    let result = get_package_groups(&infos, &root, &groups).unwrap();
    let mut ui_pkgs = result["ui"].package_names.clone();
    ui_pkgs.sort();
    assert_eq!(ui_pkgs, vec!["nested-a", "nested-b"]);
}

// TS: "handles multiple include patterns in a single group"
#[test]
fn handles_multiple_include_patterns() {
    let root = fake_root();
    let infos = make_package_infos(
        &[
            ("ui-a", "ui/ui-a"),
            ("comp-b", "components/comp-b"),
            ("other-c", "other/other-c"),
        ],
        &root,
    );

    let groups = Some(vec![VersionGroupOptions {
        name: "frontend".to_string(),
        include: VersionGroupInclude::Patterns(vec![
            "ui/*".to_string(),
            "components/*".to_string(),
        ]),
        exclude: None,
        disallowed_change_types: None,
    }]);

    let result = get_package_groups(&infos, &root, &groups).unwrap();
    let mut pkgs = result["frontend"].package_names.clone();
    pkgs.sort();
    assert_eq!(pkgs, vec!["comp-b", "ui-a"]);
}

// TS: "handles specific exclude patterns"
#[test]
fn handles_specific_exclude_patterns() {
    let root = fake_root();
    let infos = make_package_infos(
        &[
            ("pkg-a", "packages/pkg-a"),
            ("internal", "packages/internal"),
            ("pkg-b", "packages/pkg-b"),
        ],
        &root,
    );

    let groups = Some(vec![VersionGroupOptions {
        name: "public".to_string(),
        include: VersionGroupInclude::Patterns(vec!["packages/*".to_string()]),
        exclude: Some(vec!["!packages/internal".to_string()]),
        disallowed_change_types: None,
    }]);

    let result = get_package_groups(&infos, &root, &groups).unwrap();
    let mut pkgs = result["public"].package_names.clone();
    pkgs.sort();
    assert_eq!(pkgs, vec!["pkg-a", "pkg-b"]);
}

// TS: "handles glob exclude patterns"
#[test]
fn handles_glob_exclude_patterns() {
    let root = fake_root();
    let infos = make_package_infos(
        &[
            ("core-a", "packages/core/core-a"),
            ("core-b", "packages/core/core-b"),
            ("ui-a", "packages/ui/ui-a"),
        ],
        &root,
    );

    let groups = Some(vec![VersionGroupOptions {
        name: "non-core".to_string(),
        include: VersionGroupInclude::Patterns(vec!["packages/**/*".to_string()]),
        exclude: Some(vec!["!packages/core/*".to_string()]),
        disallowed_change_types: None,
    }]);

    let result = get_package_groups(&infos, &root, &groups).unwrap();
    assert_eq!(result["non-core"].package_names, vec!["ui-a"]);
}

// TS: "exits with error if package belongs to multiple groups"
#[test]
fn errors_if_package_in_multiple_groups() {
    let root = fake_root();
    let infos = make_package_infos(
        &[("pkg-a", "packages/pkg-a"), ("pkg-b", "packages/pkg-b")],
        &root,
    );

    let groups = Some(vec![
        VersionGroupOptions {
            name: "grp1".to_string(),
            include: VersionGroupInclude::Patterns(vec!["packages/*".to_string()]),
            exclude: None,
            disallowed_change_types: None,
        },
        VersionGroupOptions {
            name: "grp2".to_string(),
            include: VersionGroupInclude::Patterns(vec!["packages/*".to_string()]),
            exclude: None,
            disallowed_change_types: None,
        },
    ]);

    let result = get_package_groups(&infos, &root, &groups);
    assert!(result.is_err());
    let err_msg = result.unwrap_err().to_string();
    assert!(err_msg.contains("multiple groups"));
}

// TS: "omits empty groups"
#[test]
fn omits_empty_groups() {
    let root = fake_root();
    let infos = make_package_infos(&[("pkg-a", "packages/pkg-a")], &root);

    let groups = Some(vec![VersionGroupOptions {
        name: "empty".to_string(),
        include: VersionGroupInclude::Patterns(vec!["nonexistent/*".to_string()]),
        exclude: None,
        disallowed_change_types: None,
    }]);

    let result = get_package_groups(&infos, &root, &groups).unwrap();
    assert!(result["empty"].package_names.is_empty());
}
