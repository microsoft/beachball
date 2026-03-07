use anyhow::Result;

use crate::log_info;
use crate::types::options::ParsedOptions;
use crate::validation::validate::{ValidateOptions, validate};

/// Run the check command: validate that change files are present where needed.
pub fn check(parsed: &ParsedOptions) -> Result<()> {
    validate(
        parsed,
        &ValidateOptions {
            check_change_needed: true,
            check_dependencies: true,
            ..Default::default()
        },
    )?;
    log_info!("No change files are needed");
    Ok(())
}
