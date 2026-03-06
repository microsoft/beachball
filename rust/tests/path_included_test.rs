use beachball::monorepo::path_included::is_path_included;

#[test]
fn returns_true_if_path_is_included_single_include() {
    assert!(is_path_included("packages/a", &["packages/*".into()]));
}

#[test]
fn returns_false_if_path_is_excluded_single_exclude() {
    assert!(!is_path_included(
        "packages/a",
        &["packages/*".into(), "!packages/a".into()]
    ));
}

#[test]
fn returns_true_if_path_is_included_multiple_include() {
    assert!(is_path_included(
        "packages/a",
        &[
            "packages/b".into(),
            "packages/a".into(),
            "!packages/b".into(),
        ]
    ));
}

#[test]
fn returns_false_if_path_is_excluded_multiple_exclude() {
    assert!(!is_path_included(
        "packages/a",
        &[
            "packages/*".into(),
            "!packages/a".into(),
            "!packages/b".into(),
        ]
    ));
}

#[test]
fn returns_false_if_no_patterns_match() {
    assert!(!is_path_included("packages/a", &["other/*".into()]));
}

#[test]
fn returns_true_if_only_negation_patterns_none_match() {
    assert!(is_path_included("packages/a", &["!packages/b".into()]));
}

#[test]
fn returns_false_if_only_negation_patterns_matches() {
    assert!(!is_path_included("packages/a", &["!packages/a".into()]));
}

#[test]
fn ignores_empty_exclude_array() {
    assert!(is_path_included("packages/a", &["packages/*".into()]));
}
