use beachball::monorepo::path_included::is_path_included;

// TS: "returns true if path is included (single include path)"
#[test]
fn returns_true_if_path_is_included_single_include() {
    assert!(is_path_included("packages/a", &["packages/*".into()]));
}

// TS: "returns false if path is excluded (single exclude path)"
#[test]
fn returns_false_if_path_is_excluded_single_exclude() {
    assert!(!is_path_included(
        "packages/a",
        &["packages/*".into(), "!packages/a".into()]
    ));
}

// TS: "returns true if path is included (multiple include paths)"
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

// TS: "returns false if path is excluded (multiple exclude paths)"
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

// TS: "returns false if include path is empty" (different approach — Rust tests no-match instead of empty)
#[test]
fn returns_false_if_no_patterns_match() {
    assert!(!is_path_included("packages/a", &["other/*".into()]));
}

// TS: "returns true if include is true (no exclude paths)" (Rust uses negation-only patterns instead of boolean)
#[test]
fn returns_true_if_only_negation_patterns_none_match() {
    assert!(is_path_included("packages/a", &["!packages/b".into()]));
}

// TS: "returns false if include is true and path is excluded" (Rust uses negation-only patterns instead of boolean)
#[test]
fn returns_false_if_only_negation_patterns_matches() {
    assert!(!is_path_included("packages/a", &["!packages/a".into()]));
}

// TS: "ignores empty exclude path array"
#[test]
fn ignores_empty_exclude_array() {
    assert!(is_path_included("packages/a", &["packages/*".into()]));
}
