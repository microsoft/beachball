use anyhow::Result;

use crate::types::options::ParsedOptions;
use crate::validation::validate::{validate, ValidateOptions};

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
    println!("No change files are needed");
    Ok(())
}
