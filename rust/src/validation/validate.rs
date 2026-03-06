use anyhow::Result;

use crate::changefile::change_types::get_disallowed_change_types;
use crate::changefile::changed_packages::get_changed_packages;
use crate::changefile::read_change_files::read_change_files;
use crate::git::commands::get_untracked_changes;
use crate::logging::bulleted_list;
use crate::monorepo::package_groups::get_package_groups;
use crate::monorepo::package_infos::get_package_infos;
use crate::monorepo::scoped_packages::get_scoped_packages;
use crate::types::change_info::ChangeSet;
use crate::types::options::ParsedOptions;
use crate::types::package_info::{PackageGroups, PackageInfos, ScopedPackages};
use crate::validation::are_change_files_deleted::are_change_files_deleted;
use crate::validation::validators::*;

pub struct ValidateOptions {
    pub check_change_needed: bool,
    pub allow_missing_change_files: bool,
    pub check_dependencies: bool,
}

impl Default for ValidateOptions {
    fn default() -> Self {
        Self {
            check_change_needed: false,
            allow_missing_change_files: false,
            check_dependencies: false,
        }
    }
}

#[derive(Debug)]
pub struct ValidationResult {
    pub is_change_needed: bool,
    pub package_infos: PackageInfos,
    pub package_groups: PackageGroups,
    pub scoped_packages: ScopedPackages,
    pub change_set: ChangeSet,
    pub changed_packages: Option<Vec<String>>,
}

/// Validation error that indicates the process should exit with code 1.
#[derive(Debug)]
pub struct ValidationError {
    pub message: String,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for ValidationError {}

/// Log a validation error and set the flag.
fn log_validation_error(msg: &str, has_error: &mut bool) {
    eprintln!("ERROR: {msg}");
    *has_error = true;
}

/// Run validation of options, change files, and packages.
pub fn validate(
    parsed: &ParsedOptions,
    validate_options: &ValidateOptions,
) -> Result<ValidationResult> {
    let options = &parsed.options;

    println!("\nValidating options and change files...");

    let mut has_error = false;

    // Check for untracked changes
    let untracked = get_untracked_changes(&options.path).unwrap_or_default();
    if !untracked.is_empty() {
        eprintln!(
            "WARN: There are untracked changes in your repository:\n{}",
            bulleted_list(&untracked.iter().map(|s| s.as_str()).collect::<Vec<_>>())
        );
    }

    // Get package infos
    let package_infos = get_package_infos(options)?;

    // Validate --all and --package conflict
    if options.all && options.package.is_some() {
        log_validation_error(
            "Cannot specify both \"all\" and \"package\" options",
            &mut has_error,
        );
    } else if let Some(ref packages) = options.package {
        let mut invalid_reasons: Vec<String> = Vec::new();
        for pkg in packages {
            if !package_infos.contains_key(pkg) {
                invalid_reasons.push(format!("\"{pkg}\" was not found"));
            } else if package_infos[pkg].private {
                invalid_reasons.push(format!("\"{pkg}\" is marked as private"));
            }
        }
        if !invalid_reasons.is_empty() {
            log_validation_error(
                &format!(
                    "Invalid package(s) specified:\n{}",
                    bulleted_list(
                        &invalid_reasons
                            .iter()
                            .map(|s| s.as_str())
                            .collect::<Vec<_>>()
                    )
                ),
                &mut has_error,
            );
        }
    }

    // Validate auth type
    if let Some(ref auth_type) = options.auth_type {
        if !is_valid_auth_type(auth_type) {
            log_validation_error(
                &format!("authType \"{auth_type}\" is not valid"),
                &mut has_error,
            );
        }
    }

    // Validate dependent change type
    if let Some(dct) = options.dependent_change_type {
        if !is_valid_change_type_value(dct) {
            log_validation_error(
                &format!("dependentChangeType \"{dct}\" is not valid"),
                &mut has_error,
            );
        }
    }

    // Validate change type
    if let Some(ct) = options.change_type {
        if !is_valid_change_type_value(ct) {
            log_validation_error(
                &format!("Change type \"{ct}\" is not valid"),
                &mut has_error,
            );
        }
    }

    // Validate group options
    if let Some(ref groups) = options.groups {
        if !is_valid_group_options(groups) {
            has_error = true;
        }
    }

    // Get package groups
    let package_groups = get_package_groups(&package_infos, &options.path, &options.groups)?;

    // Validate grouped package options
    if options.groups.is_some()
        && !is_valid_grouped_package_options(&package_infos, &package_groups)
    {
        has_error = true;
    }

    let scoped_packages = get_scoped_packages(options, &package_infos);
    let change_set = read_change_files(options, &package_infos, &scoped_packages);

    // Validate each change file
    for entry in &change_set {
        let disallowed = get_disallowed_change_types(
            &entry.change.package_name,
            &package_infos,
            &package_groups,
            &options.disallowed_change_types,
        );

        let ct_str = entry.change.change_type.to_string();
        if !is_valid_change_type(&ct_str) {
            log_validation_error(
                &format!(
                    "Invalid change type detected in {}: \"{}\"",
                    entry.change_file, ct_str
                ),
                &mut has_error,
            );
        } else if let Some(ref disallowed) = disallowed {
            if disallowed.contains(&entry.change.change_type) {
                log_validation_error(
                    &format!(
                        "Disallowed change type detected in {}: \"{}\"",
                        entry.change_file, ct_str
                    ),
                    &mut has_error,
                );
            }
        }

        let dct_str = entry.change.dependent_change_type.to_string();
        if !is_valid_dependent_change_type(entry.change.dependent_change_type, &disallowed) {
            log_validation_error(
                &format!(
                    "Invalid dependentChangeType detected in {}: \"{}\"",
                    entry.change_file, dct_str
                ),
                &mut has_error,
            );
        }
    }

    if has_error {
        return Err(ValidationError {
            message: "Validation failed".to_string(),
        }
        .into());
    }

    // Check if change files are needed
    let mut is_change_needed = false;
    let mut changed_packages: Option<Vec<String>> = None;

    if validate_options.check_change_needed {
        let pkgs = get_changed_packages(options, &package_infos, &scoped_packages)?;
        is_change_needed = !pkgs.is_empty();

        if is_change_needed {
            let message = if options.all {
                "Considering the following packages due to --all"
            } else if options.package.is_some() {
                "Considering the specific --package"
            } else {
                "Found changes in the following packages"
            };
            let mut sorted = pkgs.clone();
            sorted.sort();
            println!(
                "{message}:\n{}",
                bulleted_list(&sorted.iter().map(|s| s.as_str()).collect::<Vec<_>>())
            );
        }

        if is_change_needed && !validate_options.allow_missing_change_files {
            eprintln!("ERROR: Change files are needed!");
            println!("{}", options.changehint);
            return Err(ValidationError {
                message: "Change files are needed".to_string(),
            }
            .into());
        }

        if options.disallow_deleted_change_files && are_change_files_deleted(options) {
            eprintln!("ERROR: Change files must not be deleted!");
            return Err(ValidationError {
                message: "Change files must not be deleted".to_string(),
            }
            .into());
        }

        changed_packages = Some(pkgs);
    }

    // Skip checkDependencies / bumpInMemory (not implemented)
    if validate_options.check_dependencies && !is_change_needed && !change_set.is_empty() {
        if options.verbose {
            println!(
                "(Skipping package dependency validation — not implemented in Rust port)"
            );
        }
    }

    println!();

    Ok(ValidationResult {
        is_change_needed,
        package_infos,
        package_groups,
        scoped_packages,
        change_set,
        changed_packages,
    })
}
