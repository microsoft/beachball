use crate::git::commands;
use crate::types::options::BeachballOptions;

/// Check if any change files have been deleted (compared to the target branch).
pub fn are_change_files_deleted(options: &BeachballOptions) -> bool {
    let change_path = crate::changefile::read_change_files::get_change_path(options);

    let deleted = commands::get_changes_between_refs(
        &options.branch,
        Some("D"),
        Some("*.json"),
        &change_path,
    )
    .unwrap_or_default();

    !deleted.is_empty()
}
