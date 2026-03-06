use anyhow::Result;
use std::path::Path;

use crate::git::commands;
use crate::types::change_info::ChangeFileInfo;
use crate::types::options::BeachballOptions;

use super::read_change_files::get_change_path;

/// Write change files to disk, stage them, and optionally commit.
/// Returns the list of created file paths.
pub fn write_change_files(
    changes: &[ChangeFileInfo],
    options: &BeachballOptions,
) -> Result<Vec<String>> {
    if changes.is_empty() {
        return Ok(vec![]);
    }

    let change_path = get_change_path(options);
    let cwd = &options.path;

    // Create directory if needed
    if !Path::new(&change_path).exists() {
        std::fs::create_dir_all(&change_path)?;
    }

    let mut change_files: Vec<String> = Vec::new();

    if options.group_changes {
        // Write all changes to a single grouped file
        let uuid = uuid::Uuid::new_v4();
        let file_path = Path::new(&change_path)
            .join(format!("change-{uuid}.json"))
            .to_string_lossy()
            .to_string();

        let grouped = serde_json::json!({ "changes": changes });
        std::fs::write(&file_path, serde_json::to_string_pretty(&grouped)?)?;
        change_files.push(file_path);
    } else {
        // Write each change to its own file
        for change in changes {
            let sanitized_name = change
                .package_name
                .replace(|c: char| !c.is_alphanumeric() && c != '@', "-");
            let uuid = uuid::Uuid::new_v4();
            let file_path = Path::new(&change_path)
                .join(format!("{sanitized_name}-{uuid}.json"))
                .to_string_lossy()
                .to_string();

            let json = serde_json::to_string_pretty(change)?;
            std::fs::write(&file_path, json)?;
            change_files.push(file_path);
        }
    }

    // Stage and maybe commit if in a git repo
    if commands::get_branch_name(cwd)?.is_some() {
        let file_refs: Vec<&str> = change_files.iter().map(|s| s.as_str()).collect();
        commands::stage(&file_refs, cwd)?;

        if options.commit {
            let commit_pattern = Path::new(&change_path)
                .join("*.json")
                .to_string_lossy()
                .to_string();
            commands::commit("Change files", cwd, &["--only", &commit_pattern])?;
        }
    }

    println!(
        "git {} these change files:{}",
        if options.commit {
            "committed"
        } else {
            "staged"
        },
        change_files
            .iter()
            .map(|f| format!("\n - {f}"))
            .collect::<String>()
    );

    Ok(change_files)
}
