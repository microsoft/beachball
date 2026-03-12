use crate::git::commands;
use crate::types::options::BeachballOptions;
use crate::{log_error, log_info};

/// Check if any change files have been deleted (compared to the target branch).
pub fn are_change_files_deleted(options: &BeachballOptions) -> bool {
    let change_path = crate::changefile::read_change_files::get_change_path(options);

    log_info!(
        "Checking for deleted change files against \"{}\"",
        options.branch
    );

    let deleted = commands::get_changes_between_refs(
        &options.branch,
        Some("D"),
        Some("*.json"),
        &change_path,
    )
    .unwrap_or_default();

    if !deleted.is_empty() {
        let items: Vec<&str> = deleted.iter().map(|s| s.as_str()).collect();
        log_error!(
            "The following change files were deleted:\n{}",
            crate::logging::bulleted_list(&items)
        );
    }

    !deleted.is_empty()
}
