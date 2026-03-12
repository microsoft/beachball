use super::path_included::match_with_base;
use crate::log_verbose;

/// Filter out file paths that match any of the ignore patterns.
/// Uses matchBase: true behavior (patterns without '/' match against basename).
pub fn filter_ignored_files(file_paths: &[String], ignore_patterns: &[String]) -> Vec<String> {
    file_paths
        .iter()
        .filter(|path| {
            for pattern in ignore_patterns {
                if match_with_base(path, pattern) {
                    log_verbose!("  - ~~{path}~~ (ignored by pattern \"{pattern}\")");
                    return false;
                }
            }
            true
        })
        .cloned()
        .collect()
}
