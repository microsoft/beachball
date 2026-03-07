#[allow(dead_code)]
pub mod change_files;
#[allow(dead_code)]
pub mod fixtures;
#[allow(dead_code)]
pub mod repository;
#[allow(dead_code)]
pub mod repository_factory;

use std::path::Path;
use std::process::Command;

use beachball::options::get_options::get_parsed_options_for_test;
use beachball::types::options::{BeachballOptions, CliOptions};
use beachball::types::package_info::{PackageInfo, PackageInfos};

#[allow(dead_code)]
pub const DEFAULT_BRANCH: &str = "master";
#[allow(dead_code)]
pub const DEFAULT_REMOTE_BRANCH: &str = "origin/master";

/// Run a git command in the given directory.
pub fn run_git(args: &[&str], cwd: &str) -> String {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .unwrap_or_else(|e| panic!("Failed to run git {}: {e}", args.join(" ")));

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.contains("already exists") && !stderr.contains("nothing to commit") {
            panic!("git {} failed in {cwd}: {}", args.join(" "), stderr);
        }
    }

    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

/// Returns a fake root path appropriate for the current OS
/// (e.g. `/fake-root` on Unix, `C:\fake-root` on Windows).
#[allow(dead_code)]
pub fn fake_root() -> String {
    if cfg!(windows) {
        r"C:\fake-root".to_string()
    } else {
        "/fake-root".to_string()
    }
}

/// Build PackageInfos from (name, folder) pairs with default version "1.0.0".
#[allow(dead_code)]
pub fn make_package_infos(packages: &[(&str, &str)], root: &str) -> PackageInfos {
    let mut infos = PackageInfos::new();
    for (name, folder) in packages {
        infos.insert(
            name.to_string(),
            PackageInfo {
                name: name.to_string(),
                package_json_path: Path::new(root)
                    .join(folder)
                    .join("package.json")
                    .to_string_lossy()
                    .to_string(),
                version: "1.0.0".to_string(),
                ..Default::default()
            },
        );
    }
    infos
}

/// Build PackageInfos from names only. Puts each package in `packages/{name}/`.
#[allow(dead_code)]
pub fn make_package_infos_simple(names: &[&str], root: &str) -> PackageInfos {
    let pairs: Vec<(&str, String)> = names
        .iter()
        .map(|n| {
            (
                *n,
                Path::new("packages").join(n).to_string_lossy().to_string(),
            )
        })
        .collect();
    let refs: Vec<(&str, &str)> = pairs.iter().map(|(n, f)| (*n, f.as_str())).collect();
    make_package_infos(&refs, root)
}

/// Build merged options for a test repo. Applies default branch/fetch settings.
#[allow(dead_code)]
pub fn make_test_options(cwd: &str, overrides: Option<BeachballOptions>) -> BeachballOptions {
    let cli = CliOptions::default();
    let mut repo_opts = overrides.unwrap_or_default();
    repo_opts.branch = DEFAULT_REMOTE_BRANCH.to_string();
    repo_opts.fetch = false;

    let parsed = get_parsed_options_for_test(cwd, cli, repo_opts);
    parsed.options
}
