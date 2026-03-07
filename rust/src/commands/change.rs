use anyhow::{Result, bail};

use crate::log_info;
use crate::changefile::changed_packages::get_changed_packages;
use crate::changefile::write_change_files::write_change_files;
use crate::git::commands::get_user_email;
use crate::types::change_info::{ChangeFileInfo, ChangeType};
use crate::types::options::ParsedOptions;
use crate::validation::validate::{ValidateOptions, ValidationResult, validate};

/// Run the change command (non-interactive only).
/// Requires --type and --message to be specified.
pub fn change(parsed: &ParsedOptions) -> Result<()> {
    let options = &parsed.options;

    let ValidationResult {
        is_change_needed,
        package_infos,
        scoped_packages,
        changed_packages,
        ..
    } = validate(
        parsed,
        &ValidateOptions {
            check_change_needed: true,
            allow_missing_change_files: true,
            ..Default::default()
        },
    )?;

    if !is_change_needed && options.package.is_none() {
        log_info!("No change files are needed");
        return Ok(());
    }

    let changed = changed_packages.unwrap_or_else(|| {
        get_changed_packages(options, &package_infos, &scoped_packages).unwrap_or_default()
    });

    if changed.is_empty() {
        return Ok(());
    }

    // Non-interactive: require --type and --message
    let change_type = match options.change_type {
        Some(ct) => ct,
        None => bail!("Non-interactive mode requires --type to be specified"),
    };

    if options.message.is_empty() {
        bail!("Non-interactive mode requires --message (-m) to be specified");
    }

    let email = get_user_email(&options.path).unwrap_or_else(|| "email not defined".to_string());

    let dependent_change_type =
        options
            .dependent_change_type
            .unwrap_or(if change_type == ChangeType::None {
                ChangeType::None
            } else {
                ChangeType::Patch
            });

    let changes: Vec<ChangeFileInfo> = changed
        .iter()
        .map(|pkg| ChangeFileInfo {
            change_type,
            comment: options.message.clone(),
            package_name: pkg.clone(),
            email: email.clone(),
            dependent_change_type,
        })
        .collect();

    write_change_files(&changes, options)?;

    Ok(())
}
