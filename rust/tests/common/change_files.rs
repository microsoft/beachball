use beachball::types::change_info::ChangeFileInfo;
use beachball::types::change_info::ChangeType;
use beachball::types::options::BeachballOptions;
use std::path::Path;

use super::repository::Repository;

/// Generate change files for the given packages and commit them.
pub fn generate_change_files(packages: &[&str], options: &BeachballOptions, repo: &Repository) {
    let change_path = Path::new(&options.path).join(&options.change_dir);
    std::fs::create_dir_all(&change_path).ok();

    for pkg in packages {
        let uuid = uuid::Uuid::new_v4();
        let sanitized = pkg.replace(|c: char| !c.is_alphanumeric() && c != '@', "-");
        let filename = format!("{sanitized}-{uuid}.json");
        let file_path = change_path.join(&filename);

        let change = ChangeFileInfo {
            change_type: ChangeType::Patch,
            comment: "test change".to_string(),
            package_name: pkg.to_string(),
            email: "test@test.com".to_string(),
            dependent_change_type: ChangeType::Patch,
        };

        let json = serde_json::to_string_pretty(&change).unwrap();
        std::fs::write(&file_path, json).unwrap();
    }

    repo.git(&["add", "-A"]);
    if options.commit {
        repo.git(&["commit", "-m", "Change files"]);
    }
}

/// Get the list of change file paths for the given options.
pub fn get_change_files(options: &BeachballOptions) -> Vec<String> {
    let change_path = Path::new(&options.path).join(&options.change_dir);
    if !change_path.exists() {
        return vec![];
    }

    let mut files: Vec<String> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&change_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                files.push(path.to_string_lossy().to_string());
            }
        }
    }
    files.sort();
    files
}
