package git

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

// GitResult holds the result of a git command.
type GitResult struct {
	Success  bool
	Stdout   string
	Stderr   string
	ExitCode int
}

// Git runs a git command in the given directory.
func Git(args []string, cwd string) (GitResult, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = cwd

	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return GitResult{}, fmt.Errorf("failed to run git %s: %w", strings.Join(args, " "), err)
		}
	}

	result := GitResult{
		Success:  exitCode == 0,
		Stdout:   strings.TrimSpace(stdout.String()),
		Stderr:   strings.TrimSpace(stderr.String()),
		ExitCode: exitCode,
	}
	return result, nil
}

// gitStdout runs a git command and returns stdout, or error if it fails.
func gitStdout(args []string, cwd string) (string, error) {
	result, err := Git(args, cwd)
	if err != nil {
		return "", err
	}
	if !result.Success {
		return "", fmt.Errorf("git %s failed: %s", strings.Join(args, " "), result.Stderr)
	}
	return result.Stdout, nil
}

// FindGitRoot returns the root directory of the git repository.
func FindGitRoot(cwd string) (string, error) {
	return gitStdout([]string{"rev-parse", "--show-toplevel"}, cwd)
}

// FindProjectRoot walks up from cwd looking for a package.json with workspaces.
// Falls back to git root.
func FindProjectRoot(cwd string) (string, error) {
	gitRoot, err := FindGitRoot(cwd)
	if err != nil {
		return "", err
	}

	absPath, err := filepath.Abs(cwd)
	if err != nil {
		return gitRoot, nil
	}
	gitRootAbs, _ := filepath.Abs(gitRoot)

	dir := absPath
	for {
		pkgJSON := filepath.Join(dir, "package.json")
		if data, err := readFileIfExists(pkgJSON); err == nil && data != nil {
			if hasWorkspaces(data) {
				return dir, nil
			}
		}
		if dir == gitRootAbs {
			break
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return gitRoot, nil
}

// GetBranchName returns the current branch name.
func GetBranchName(cwd string) (string, error) {
	return gitStdout([]string{"rev-parse", "--abbrev-ref", "HEAD"}, cwd)
}

// GetUserEmail returns the user's git email.
func GetUserEmail(cwd string) string {
	email, err := gitStdout([]string{"config", "user.email"}, cwd)
	if err != nil {
		return ""
	}
	return email
}

// GetBranchChanges returns files changed between the current branch and the target branch.
func GetBranchChanges(branch, cwd string) ([]string, error) {
	result, err := Git([]string{
		"--no-pager", "diff", "--name-only", "--relative", "--no-renames",
		fmt.Sprintf("%s...", branch),
	}, cwd)
	if err != nil {
		return nil, err
	}
	if !result.Success {
		return nil, nil
	}
	return splitLines(result.Stdout), nil
}

// GetStagedChanges returns staged file changes.
func GetStagedChanges(cwd string) ([]string, error) {
	result, err := Git([]string{
		"--no-pager", "diff", "--cached", "--name-only", "--relative", "--no-renames",
	}, cwd)
	if err != nil {
		return nil, err
	}
	if !result.Success {
		return nil, nil
	}
	return splitLines(result.Stdout), nil
}

// GetChangesBetweenRefs returns changes between refs with optional filter and pattern.
func GetChangesBetweenRefs(fromRef string, diffFilter, pattern, cwd string) ([]string, error) {
	args := []string{"--no-pager", "diff", "--name-only", "--relative", "--no-renames"}
	if diffFilter != "" {
		args = append(args, fmt.Sprintf("--diff-filter=%s", diffFilter))
	}
	args = append(args, fmt.Sprintf("%s...", fromRef))
	if pattern != "" {
		args = append(args, "--", pattern)
	}

	result, err := Git(args, cwd)
	if err != nil {
		return nil, err
	}
	if !result.Success {
		return nil, nil
	}
	return splitLines(result.Stdout), nil
}

// GetUntrackedChanges returns untracked files.
func GetUntrackedChanges(cwd string) ([]string, error) {
	result, err := Git([]string{"status", "--short", "--untracked-files"}, cwd)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, line := range splitLines(result.Stdout) {
		if strings.HasPrefix(line, "??") {
			files = append(files, strings.TrimSpace(line[2:]))
		}
	}
	return files, nil
}

// Stage adds files to the staging area.
func Stage(files []string, cwd string) error {
	args := append([]string{"add"}, files...)
	_, err := gitStdout(args, cwd)
	return err
}

// Commit creates a commit with the given message.
func Commit(message, cwd string) error {
	_, err := gitStdout([]string{"commit", "-m", message}, cwd)
	return err
}

// IsShallowClone checks if the repo is a shallow clone.
func IsShallowClone(cwd string) bool {
	result, err := gitStdout([]string{"rev-parse", "--is-shallow-repository"}, cwd)
	if err != nil {
		return false
	}
	return result == "true"
}

// Fetch fetches from the remote branch.
func Fetch(remoteBranch, cwd string) error {
	parts := strings.SplitN(remoteBranch, "/", 2)
	if len(parts) != 2 {
		return fmt.Errorf("invalid remote branch format: %s", remoteBranch)
	}
	_, err := gitStdout([]string{"fetch", parts[0], parts[1]}, cwd)
	return err
}

// Deepen deepens a shallow clone.
func Deepen(depth int, cwd string) error {
	_, err := gitStdout([]string{"fetch", "--deepen", fmt.Sprintf("%d", depth)}, cwd)
	return err
}

// HasRef checks if a ref exists.
func HasRef(ref, cwd string) bool {
	result, err := Git([]string{"rev-parse", "--verify", ref}, cwd)
	if err != nil {
		return false
	}
	return result.Success
}

func splitLines(s string) []string {
	if s == "" {
		return nil
	}
	var lines []string
	for line := range strings.SplitSeq(s, "\n") {
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}
