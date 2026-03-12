use globset::{Glob, GlobMatcher};

/// Check if a relative path is included by the given scope patterns.
/// Supports negation patterns (starting with '!').
/// Uses full-path matching (no matchBase).
pub fn is_path_included(rel_path: &str, patterns: &[String]) -> bool {
    let mut included = false;
    let mut has_positive = false;

    for pattern in patterns {
        if let Some(neg_pattern) = pattern.strip_prefix('!') {
            // Negation pattern: exclude if matches
            if let Ok(glob) = Glob::new(neg_pattern) {
                let matcher = glob.compile_matcher();
                if matcher.is_match(rel_path) {
                    return false;
                }
            }
        } else {
            has_positive = true;
            if let Ok(glob) = Glob::new(pattern) {
                let matcher = glob.compile_matcher();
                if matcher.is_match(rel_path) {
                    included = true;
                }
            }
        }
    }

    // If no positive patterns, everything is included (only negations apply)
    if !has_positive {
        return true;
    }

    included
}

/// Match a file path against a pattern with matchBase behavior:
/// patterns without '/' match against the basename only.
pub fn match_with_base(path: &str, pattern: &str) -> bool {
    // If pattern contains no path separator, match against basename
    if !pattern.contains('/') {
        let basename = path.rsplit('/').next().unwrap_or(path);
        if let Ok(glob) = Glob::new(pattern) {
            let matcher: GlobMatcher = glob.compile_matcher();
            return matcher.is_match(basename);
        }
        return false;
    }

    // Otherwise match against the full path
    if let Ok(glob) = Glob::new(pattern) {
        let matcher: GlobMatcher = glob.compile_matcher();
        return matcher.is_match(path);
    }
    false
}
