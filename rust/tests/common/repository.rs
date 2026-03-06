use std::fs;
use std::path::PathBuf;
use std::process::Command;

/// A test git repository (cloned from a bare origin).
pub struct Repository {
    root: PathBuf,
}

impl Repository {
    /// Clone a bare repo into a temp directory.
    pub fn new(bare_repo: &str, description: &str) -> Self {
        let tmp = tempfile::Builder::new()
            .prefix(&format!("beachball-{description}-"))
            .tempdir()
            .expect("failed to create temp dir");

        let root = tmp.keep();

        // Clone
        run_git(&["clone", bare_repo, root.to_str().unwrap()], ".");

        // Configure user for commits
        let root_str = root.to_str().unwrap();
        run_git(&["config", "user.email", "test@test.com"], root_str);
        run_git(&["config", "user.name", "Test User"], root_str);

        Repository { root }
    }

    pub fn root_path(&self) -> &str {
        self.root.to_str().unwrap()
    }

    pub fn path_to(&self, parts: &[&str]) -> PathBuf {
        let mut p = self.root.clone();
        for part in parts {
            p = p.join(part);
        }
        p
    }

    /// Run a git command in this repo.
    pub fn git(&self, args: &[&str]) -> String {
        run_git(args, self.root_path())
    }

    /// Write a file with dummy content, creating parent dirs if needed.
    pub fn write_file(&self, rel_path: &str) {
        self.write_file_content(rel_path, "test content");
    }

    pub fn write_file_content(&self, rel_path: &str, content: &str) {
        let path = self.root.join(rel_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).ok();
        }
        fs::write(&path, content).expect("failed to write file");
    }

    /// Write a file, stage it, but don't commit.
    pub fn stage_change(&self, rel_path: &str) {
        self.write_file(rel_path);
        self.git(&["add", rel_path]);
    }

    /// Write a file, stage it, and commit.
    pub fn commit_change(&self, rel_path: &str) {
        self.stage_change(rel_path);
        self.git(&["commit", "-m", &format!("committing {rel_path}")]);
    }

    /// Commit all changes.
    pub fn commit_all(&self, message: &str) {
        self.git(&["add", "-A"]);
        self.git(&["commit", "-m", message, "--allow-empty"]);
    }

    /// Checkout a branch (pass extra args like "-b" for new branch).
    pub fn checkout(&self, args: &[&str]) {
        let mut cmd_args = vec!["checkout"];
        cmd_args.extend(args);
        self.git(&cmd_args);
    }

    /// Push to origin.
    pub fn push(&self) {
        self.git(&["push", "origin", "HEAD"]);
    }

    /// Get git status output.
    pub fn status(&self) -> String {
        run_git(&["status", "--porcelain"], self.root_path())
    }

    pub fn clean_up(&self) {
        if std::env::var("CI").is_err() {
            let _ = fs::remove_dir_all(&self.root);
        }
    }
}

impl Drop for Repository {
    fn drop(&mut self) {
        self.clean_up();
    }
}

fn run_git(args: &[&str], cwd: &str) -> String {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .unwrap_or_else(|e| panic!("Failed to run git {}: {e}", args.join(" ")));

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Don't panic on expected failures
        if !stderr.contains("already exists") && !stderr.contains("nothing to commit") {
            panic!("git {} failed in {cwd}: {}", args.join(" "), stderr);
        }
    }

    String::from_utf8_lossy(&output.stdout).trim().to_string()
}
