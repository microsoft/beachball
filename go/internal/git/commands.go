package git

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"

	"github.com/microsoft/beachball/internal/logging"
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

// managerFiles are workspace/monorepo manager config files, in precedence order.
// Matches the workspace-tools detection order.
var ManagerFiles = []string{
	"lerna.json",
	"rush.json",
	"yarn.lock",
	"pnpm-workspace.yaml",
	"package-lock.json",
}

// searchUp walks up the directory tree from cwd looking for any of the given files.
// Returns the full path of the first match, or "" if none found.
func searchUp(files []string, cwd string) string {
	absPath, err := filepath.Abs(cwd)
	if err != nil {
		return ""
	}
	root := filepath.VolumeName(absPath) + string(filepath.Separator)

	dir := absPath
	for dir != root {
		for _, f := range files {
			candidate := filepath.Join(dir, f)
			if _, err := os.Stat(candidate); err == nil {
				return candidate
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ""
}

// FindProjectRoot searches up from cwd for a workspace manager root,
// falling back to the git root. Matches workspace-tools findProjectRoot.
func FindProjectRoot(cwd string) (string, error) {
	if found := searchUp(ManagerFiles, cwd); found != "" {
		return filepath.Dir(found), nil
	}
	return FindGitRoot(cwd)
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
		"--no-pager", "diff", "--name-only", "--relative",
		fmt.Sprintf("%s...", branch),
	}, cwd)
	if err != nil {
		return nil, err
	}
	if !result.Success {
		return nil, nil
	}
	return processGitOutput(result.Stdout), nil
}

// GetStagedChanges returns staged file changes.
func GetStagedChanges(cwd string) ([]string, error) {
	result, err := Git([]string{
		"--no-pager", "diff", "--staged", "--name-only", "--relative",
	}, cwd)
	if err != nil {
		return nil, err
	}
	if !result.Success {
		return nil, nil
	}
	return processGitOutput(result.Stdout), nil
}

// GetChangesBetweenRefs returns changes between refs with optional filter and pattern.
func GetChangesBetweenRefs(fromRef string, diffFilter, pattern, cwd string) ([]string, error) {
	args := []string{"--no-pager", "diff", "--name-only", "--relative"}
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
	return processGitOutput(result.Stdout), nil
}

// GetUntrackedChanges returns untracked files (not in index, respecting .gitignore).
func GetUntrackedChanges(cwd string) ([]string, error) {
	result, err := Git([]string{"ls-files", "--others", "--exclude-standard"}, cwd)
	if err != nil {
		return nil, err
	}
	if !result.Success {
		return nil, nil
	}
	return processGitOutput(result.Stdout), nil
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
	_, err := gitStdout([]string{"fetch", "--", parts[0], parts[1]}, cwd)
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

// GetDefaultRemote returns the default remote name, matching workspace-tools getDefaultRemote.
//
// The order of preference is:
//  1. If `repository` is defined in package.json at the git root, the remote with a matching URL
//  2. "upstream" if defined
//  3. "origin" if defined
//  4. The first defined remote
//  5. "origin" as final fallback
//
// Note: ADO/VSO URL formats are not currently handled by getRepositoryName.
// This is probably fine since usage of forks with ADO is uncommon.
func GetDefaultRemote(cwd string) string {
	gitRoot, err := FindGitRoot(cwd)
	if err != nil {
		return "origin"
	}

	// Read package.json at git root for repository field
	repositoryName := ""
	packageJsonPath := filepath.Join(gitRoot, "package.json")
	pkgData, err := os.ReadFile(packageJsonPath)
	if err != nil {
		logging.Info.Printf(`Valid "repository" key not found in "%s". Consider adding this info for more accurate git remote detection.`, packageJsonPath)
	} else {
		var pkg struct {
			Repository json.RawMessage `json:"repository"`
		}
		if err := json.Unmarshal(pkgData, &pkg); err == nil && pkg.Repository != nil {
			repositoryURL := extractRepositoryURL(pkg.Repository)
			if repositoryURL == "" {
				logging.Info.Printf(`Valid "repository" key not found in "%s". Consider adding this info for more accurate git remote detection.`, packageJsonPath)
			} else {
				repositoryName = getRepositoryName(repositoryURL)
			}
		} else {
			logging.Info.Printf(`Valid "repository" key not found in "%s". Consider adding this info for more accurate git remote detection.`, packageJsonPath)
		}
	}

	// Get remotes with URLs
	remotesResult, err := Git([]string{"remote", "-v"}, cwd)
	if err != nil || !remotesResult.Success {
		return "origin"
	}

	// Build mapping from repository name → remote name
	remotesByRepoName := map[string]string{}
	var allRemoteNames []string
	seen := map[string]bool{}
	for _, line := range splitLines(remotesResult.Stdout) {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		remoteName, remoteURL := fields[0], fields[1]
		repoName := getRepositoryName(remoteURL)
		if repoName != "" {
			remotesByRepoName[repoName] = remoteName
		}
		if !seen[remoteName] {
			allRemoteNames = append(allRemoteNames, remoteName)
			seen[remoteName] = true
		}
	}

	// 1. Match by repository name from package.json
	if repositoryName != "" {
		if matched, ok := remotesByRepoName[repositoryName]; ok {
			return matched
		}
	}

	// 2-4. Fall back to upstream > origin > first
	if slices.Contains(allRemoteNames, "upstream") {
		return "upstream"
	}
	if slices.Contains(allRemoteNames, "origin") {
		return "origin"
	}
	if len(allRemoteNames) > 0 {
		return allRemoteNames[0]
	}

	return "origin"
}

// extractRepositoryURL gets the URL from a package.json "repository" field,
// which can be a string or an object with a "url" property.
func extractRepositoryURL(raw json.RawMessage) string {
	// Try as string first
	var s string
	if json.Unmarshal(raw, &s) == nil && s != "" {
		return s
	}
	// Try as object with url field
	var obj struct {
		URL string `json:"url"`
	}
	if json.Unmarshal(raw, &obj) == nil {
		return obj.URL
	}
	return ""
}

// sshPattern matches SSH git URLs like git@github.com:owner/repo.git
var sshPattern = regexp.MustCompile(`^[^@]+@([^:]+):(.+?)(?:\.git)?$`)

// shorthandPattern matches shorthand URLs like github:owner/repo
var shorthandPattern = regexp.MustCompile(`^[a-z]+:([^/].+)$`)

// getRepositoryName extracts the "owner/repo" full name from a git URL.
// Handles HTTPS, SSH, git://, and shorthand (github:owner/repo) formats for
// common hosts (GitHub, GitLab, Bitbucket, etc.).
//
// Note: Azure DevOps and Visual Studio Online URL formats are not currently handled.
// Those would require more complex parsing similar to workspace-tools' git-url-parse usage.
func getRepositoryName(rawURL string) string {
	if rawURL == "" {
		return ""
	}

	// SSH format: git@github.com:owner/repo.git
	if m := sshPattern.FindStringSubmatch(rawURL); m != nil {
		return strings.TrimSuffix(m[2], ".git")
	}

	// Shorthand format: github:owner/repo
	if m := shorthandPattern.FindStringSubmatch(rawURL); m != nil {
		// e.g. "github:microsoft/workspace-tools" → "microsoft/workspace-tools"
		return strings.TrimSuffix(m[1], ".git")
	}

	// HTTPS or git:// format
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	path := strings.TrimPrefix(parsed.Path, "/")
	path = strings.TrimSuffix(path, ".git")
	if path == "" {
		return ""
	}
	return path
}

// GetDefaultRemoteBranch returns the default remote branch reference (e.g. "origin/main").
// If branch is non-empty, it's combined with the default remote.
// If branch is empty, detects the remote's HEAD branch, falling back to
// git config init.defaultBranch or "master".
func GetDefaultRemoteBranch(cwd string, branch string) string {
	remote := GetDefaultRemote(cwd)

	if branch != "" {
		return remote + "/" + branch
	}

	// Try to detect HEAD branch from remote
	result, err := Git([]string{"remote", "show", remote}, cwd)
	if err == nil && result.Success {
		for line := range strings.SplitSeq(result.Stdout, "\n") {
			trimmed := strings.TrimSpace(line)
			if after, ok := strings.CutPrefix(trimmed, "HEAD branch:"); ok {
				headBranch := strings.TrimSpace(after)
				return remote + "/" + headBranch
			}
		}
	}

	// Fallback: git config init.defaultBranch, or "master"
	if defaultBranch, err := gitStdout([]string{"config", "init.defaultBranch"}, cwd); err == nil && defaultBranch != "" {
		return remote + "/" + defaultBranch
	}

	return remote + "/master"
}

// processGitOutput splits git output into lines, trims whitespace, and filters out
// empty lines and node_modules paths. Matches workspace-tools processGitOutput with
// excludeNodeModules: true.
func processGitOutput(s string) []string {
	if s == "" {
		return nil
	}
	var lines []string
	for line := range strings.SplitSeq(s, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" && !strings.Contains(trimmed, "node_modules") {
			lines = append(lines, trimmed)
		}
	}
	return lines
}

// splitLines splits output into non-empty lines (without node_modules filtering).
// Used for non-file-path output like remote names.
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
