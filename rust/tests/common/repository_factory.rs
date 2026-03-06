use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

use super::fixtures;
use super::repository::Repository;

/// Creates a bare "origin" repo and provides cloning for tests.
pub struct RepositoryFactory {
    root: PathBuf,
    description: String,
}

impl RepositoryFactory {
    /// Create a new factory with a standard fixture type.
    pub fn new(fixture_type: &str) -> Self {
        match fixture_type {
            "single" => {
                let (root_pkg, folders) = fixtures::single_package_fixture();
                Self::create("single", root_pkg, folders, None)
            }
            "monorepo" => {
                let (root_pkg, folders) = fixtures::monorepo_fixture();
                Self::create("monorepo", root_pkg, folders, None)
            }
            "multi-project" => {
                let (root_a, folders_a) = fixtures::scoped_monorepo_fixture("project-a");
                let (root_b, folders_b) = fixtures::scoped_monorepo_fixture("project-b");
                Self::create_multi_project(root_a, folders_a, root_b, folders_b)
            }
            _ => panic!("Unknown fixture type: {fixture_type}"),
        }
    }

    /// Create with a custom fixture.
    pub fn new_custom(
        root_pkg: serde_json::Value,
        folders: Vec<(String, HashMap<String, serde_json::Value>)>,
    ) -> Self {
        Self::create("custom", root_pkg, folders, None)
    }

    fn create(
        description: &str,
        root_pkg: serde_json::Value,
        folders: Vec<(String, HashMap<String, serde_json::Value>)>,
        parent_folder: Option<&str>,
    ) -> Self {
        let tmp = tempfile::Builder::new()
            .prefix(&format!("beachball-{description}-origin-"))
            .tempdir()
            .expect("failed to create temp dir");
        let root = tmp.into_path();

        // Init bare repo
        run_git(&["init", "--bare"], root.to_str().unwrap());
        set_default_branch(&root);

        // Clone to temp, write fixtures, push
        let tmp_clone = tempfile::Builder::new()
            .prefix("beachball-init-")
            .tempdir()
            .expect("failed to create temp dir");
        let clone_path = tmp_clone.path();

        run_git(
            &["clone", root.to_str().unwrap(), clone_path.to_str().unwrap()],
            ".",
        );

        let clone_str = clone_path.to_str().unwrap();
        run_git(&["config", "user.email", "test@test.com"], clone_str);
        run_git(&["config", "user.name", "Test User"], clone_str);

        // Write README
        fs::write(clone_path.join("README"), "").ok();

        let base = if let Some(pf) = parent_folder {
            clone_path.join(pf)
        } else {
            clone_path.to_path_buf()
        };
        fs::create_dir_all(&base).ok();

        // Write root package.json
        let pkg_json = serde_json::to_string_pretty(&root_pkg).unwrap();
        fs::write(base.join("package.json"), pkg_json).unwrap();

        // Write yarn.lock
        fs::write(base.join("yarn.lock"), "").unwrap();

        // Write package folders
        for (folder, packages) in &folders {
            for (name, pkg_json) in packages {
                let pkg_dir = base.join(folder).join(name);
                fs::create_dir_all(&pkg_dir).unwrap();
                let json = serde_json::to_string_pretty(pkg_json).unwrap();
                fs::write(pkg_dir.join("package.json"), json).unwrap();
            }
        }

        // Commit and push
        run_git(&["add", "-A"], clone_str);
        run_git(&["commit", "-m", "committing fixture"], clone_str);
        run_git(&["push", "origin", "HEAD"], clone_str);

        // Clean up temp clone
        let _ = fs::remove_dir_all(clone_path);

        RepositoryFactory {
            root,
            description: description.to_string(),
        }
    }

    fn create_multi_project(
        root_a: serde_json::Value,
        folders_a: Vec<(String, HashMap<String, serde_json::Value>)>,
        root_b: serde_json::Value,
        folders_b: Vec<(String, HashMap<String, serde_json::Value>)>,
    ) -> Self {
        let tmp = tempfile::Builder::new()
            .prefix("beachball-multi-origin-")
            .tempdir()
            .expect("failed to create temp dir");
        let root = tmp.into_path();

        // Init bare repo
        run_git(&["init", "--bare"], root.to_str().unwrap());
        set_default_branch(&root);

        // Clone to temp, write fixtures, push
        let tmp_clone = tempfile::Builder::new()
            .prefix("beachball-init-")
            .tempdir()
            .expect("failed to create temp dir");
        let clone_path = tmp_clone.path();

        run_git(
            &["clone", root.to_str().unwrap(), clone_path.to_str().unwrap()],
            ".",
        );

        let clone_str = clone_path.to_str().unwrap();
        run_git(&["config", "user.email", "test@test.com"], clone_str);
        run_git(&["config", "user.name", "Test User"], clone_str);

        fs::write(clone_path.join("README"), "").ok();

        // Write project-a
        write_project_fixture(clone_path, "project-a", &root_a, &folders_a);
        // Write project-b
        write_project_fixture(clone_path, "project-b", &root_b, &folders_b);

        // Commit and push
        run_git(&["add", "-A"], clone_str);
        run_git(&["commit", "-m", "committing fixture"], clone_str);
        run_git(&["push", "origin", "HEAD"], clone_str);

        let _ = fs::remove_dir_all(clone_path);

        RepositoryFactory {
            root,
            description: "multi-project".to_string(),
        }
    }

    /// Clone the origin repo into a new temp directory for use in a test.
    pub fn clone_repository(&self) -> Repository {
        Repository::new(self.root.to_str().unwrap(), &self.description)
    }

    pub fn clean_up(&self) {
        if !std::env::var("CI").is_ok() {
            let _ = fs::remove_dir_all(&self.root);
        }
    }
}

impl Drop for RepositoryFactory {
    fn drop(&mut self) {
        self.clean_up();
    }
}

fn write_project_fixture(
    base: &std::path::Path,
    project_name: &str,
    root_pkg: &serde_json::Value,
    folders: &[(String, HashMap<String, serde_json::Value>)],
) {
    let project_dir = base.join(project_name);
    fs::create_dir_all(&project_dir).unwrap();

    let pkg_json = serde_json::to_string_pretty(root_pkg).unwrap();
    fs::write(project_dir.join("package.json"), pkg_json).unwrap();
    fs::write(project_dir.join("yarn.lock"), "").unwrap();

    for (folder, packages) in folders {
        for (name, pkg_json) in packages {
            let pkg_dir = project_dir.join(folder).join(name);
            fs::create_dir_all(&pkg_dir).unwrap();
            let json = serde_json::to_string_pretty(pkg_json).unwrap();
            fs::write(pkg_dir.join("package.json"), json).unwrap();
        }
    }
}

fn set_default_branch(bare_repo_path: &PathBuf) {
    run_git(
        &["symbolic-ref", "HEAD", "refs/heads/master"],
        bare_repo_path.to_str().unwrap(),
    );
}

fn run_git(args: &[&str], cwd: &str) -> String {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .unwrap_or_else(|e| panic!("Failed to run git {}: {e}", args.join(" ")));

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.contains("already exists") && !stderr.contains("nothing to commit") {
            panic!(
                "git {} failed in {cwd}: {}",
                args.join(" "),
                stderr
            );
        }
    }

    String::from_utf8_lossy(&output.stdout).trim().to_string()
}
