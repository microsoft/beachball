use std::process;

use beachball::git::commands::find_git_root;
use beachball::options::cli_options::get_cli_options;
use beachball::options::get_options::get_parsed_options;

fn main() {
    let cwd = std::env::current_dir()
        .expect("failed to get current directory")
        .to_string_lossy()
        .to_string();

    if find_git_root(&cwd).is_err() {
        eprintln!("beachball only works in a git repository. Please initialize git and try again.");
        process::exit(1);
    }

    let cli = get_cli_options();
    let parsed = match get_parsed_options(&cwd, cli) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Error parsing options: {e}");
            process::exit(1);
        }
    };

    let result = match parsed.options.command.as_str() {
        "check" => beachball::commands::check::check(&parsed),
        "change" => beachball::commands::change::change(&parsed),
        other => {
            eprintln!("Invalid command: {other}");
            process::exit(1);
        }
    };

    if let Err(e) = result {
        if e.downcast_ref::<beachball::validation::validate::ValidationError>()
            .is_some()
        {
            process::exit(1);
        }
        eprintln!("An error has been detected while running beachball!");
        eprintln!("{e:#}");
        process::exit(1);
    }
}
