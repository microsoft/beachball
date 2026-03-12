use std::path::Path;

use crate::log_warn;
use crate::types::change_info::{ChangeFileInfo, ChangeInfoMultiple, ChangeSet, ChangeSetEntry};
use crate::types::options::BeachballOptions;
use crate::types::package_info::{PackageInfos, ScopedPackages};

/// Get the path to the change files directory.
pub fn get_change_path(options: &BeachballOptions) -> String {
    Path::new(&options.path)
        .join(&options.change_dir)
        .to_string_lossy()
        .to_string()
}

/// Read all change files from the change directory.
pub fn read_change_files(
    options: &BeachballOptions,
    package_infos: &PackageInfos,
    scoped_packages: &ScopedPackages,
) -> ChangeSet {
    let change_path = get_change_path(options);
    let change_dir = Path::new(&change_path);

    if !change_dir.exists() {
        return vec![];
    }

    let mut entries: Vec<(String, std::time::SystemTime)> = vec![];

    if let Ok(dir_entries) = std::fs::read_dir(change_dir) {
        for entry in dir_entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                let filename = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let mtime = entry
                    .metadata()
                    .and_then(|m| m.modified())
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                entries.push((filename, mtime));
            }
        }
    }

    // Sort by mtime (most recent first)
    entries.sort_by(|a, b| b.1.cmp(&a.1));

    let mut change_set = ChangeSet::new();

    for (filename, _) in entries {
        let file_path = change_dir.join(&filename);
        let contents = match std::fs::read_to_string(&file_path) {
            Ok(c) => c,
            Err(e) => {
                log_warn!("Error reading change file {filename}: {e}");
                continue;
            }
        };

        // Try parsing as grouped first, then single
        let changes: Vec<ChangeFileInfo> =
            if let Ok(multi) = serde_json::from_str::<ChangeInfoMultiple>(&contents) {
                multi.changes
            } else if let Ok(single) = serde_json::from_str::<ChangeFileInfo>(&contents) {
                vec![single]
            } else {
                log_warn!(
                    "{} does not appear to be a change file",
                    file_path.display()
                );
                continue;
            };

        for change in changes {
            // Warn about nonexistent/private packages
            let warning_type = if !package_infos.contains_key(&change.package_name) {
                Some("nonexistent")
            } else if package_infos[&change.package_name].private {
                Some("private")
            } else {
                None
            };

            if let Some(wt) = warning_type {
                let resolution = if options.group_changes {
                    "remove the entry from this file"
                } else {
                    "delete this file"
                };
                log_warn!(
                    "Change detected for {} package {}; {}: {}",
                    wt,
                    change.package_name,
                    resolution,
                    file_path.display()
                );
                continue;
            }

            if !scoped_packages.contains(&change.package_name) {
                continue;
            }

            change_set.push(ChangeSetEntry {
                change,
                change_file: filename.clone(),
            });
        }
    }

    change_set
}
