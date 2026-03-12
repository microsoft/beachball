package options

import (
	"path/filepath"

	"github.com/microsoft/beachball/internal/git"
	"github.com/microsoft/beachball/internal/logging"
	"github.com/microsoft/beachball/internal/types"
)

// GetParsedOptions merges defaults, repo config, and CLI options.
func GetParsedOptions(cwd string, cli types.CliOptions) (types.ParsedOptions, error) {
	if cli.Path != "" {
		cwd = cli.Path
	}

	absPath, err := filepath.Abs(cwd)
	if err != nil {
		absPath = cwd
	}

	// Find project root
	projectRoot, err := git.FindProjectRoot(absPath)
	if err != nil {
		projectRoot = absPath
	}

	opts := types.DefaultOptions()
	opts.Path = projectRoot

	// Load repo config
	repoCfg, _ := LoadRepoConfig(projectRoot, cli.ConfigPath)
	if repoCfg != nil {
		applyRepoConfig(&opts, repoCfg)
	}

	// Apply CLI overrides
	applyCliOptions(&opts, &cli)

	if opts.Verbose {
		logging.EnableVerbose()
	}

	// Only resolve the branch from git if CLI didn't specify one (matching TS getRepoOptions).
	// This avoids unnecessary git operations and potential log noise when --branch is explicit.
	if opts.Branch == "" {
		// No branch specified at all — detect default remote and branch
		opts.Branch = git.GetDefaultRemoteBranch(projectRoot, "")
	} else {
		// Config branch without remote prefix — add the default remote
		opts.Branch = git.GetDefaultRemoteBranch(projectRoot, opts.Branch)
	}

	return types.ParsedOptions{Options: opts, CliOptions: cli}, nil
}

// GetParsedOptionsForTest creates parsed options for testing with explicit overrides.
// opts is the repo options as if from the beachball config file.
// cwd is used as opts.Path if opts.Path is empty.
// NOTE: Properties of opts currently are not deep-copied (only matters for slices).
func GetParsedOptionsForTest(cwd string, cli types.CliOptions, opts types.BeachballOptions) types.ParsedOptions {
	if opts.Path == "" {
		opts.Path = cwd
	}

	// Apply CLI overrides
	applyCliOptions(&opts, &cli)

	return types.ParsedOptions{Options: opts, CliOptions: cli}
}

func applyRepoConfig(opts *types.BeachballOptions, cfg *RepoConfig) {
	if cfg.AuthType != "" {
		opts.AuthType = types.AuthType(cfg.AuthType)
	}
	if cfg.Branch != "" {
		opts.Branch = cfg.Branch
	}
	if cfg.ChangeDir != "" {
		opts.ChangeDir = cfg.ChangeDir
	}
	if cfg.ChangeHint != "" {
		opts.ChangeHint = cfg.ChangeHint
	}
	if cfg.Commit != nil {
		opts.Commit = *cfg.Commit
	}
	if cfg.DependentChangeType != "" {
		opts.DependentChangeType = types.ChangeType(cfg.DependentChangeType)
	}
	if cfg.DisallowedChangeTypes != nil {
		dct := make([]types.ChangeType, len(cfg.DisallowedChangeTypes))
		for i, s := range cfg.DisallowedChangeTypes {
			dct[i] = types.ChangeType(s)
		}
		opts.DisallowedChangeTypes = dct
	}
	if cfg.DisallowDeletedChangeFiles != nil {
		opts.DisallowDeletedChangeFiles = *cfg.DisallowDeletedChangeFiles
	}
	if cfg.Fetch != nil {
		opts.Fetch = *cfg.Fetch
	}
	if cfg.GroupChanges != nil {
		opts.GroupChanges = *cfg.GroupChanges
	}
	if cfg.IgnorePatterns != nil {
		opts.IgnorePatterns = cfg.IgnorePatterns
	}
	if cfg.Scope != nil {
		opts.Scope = cfg.Scope
	}
	if cfg.Groups != nil {
		opts.Groups = cfg.Groups
	}
}

func applyCliOptions(opts *types.BeachballOptions, cli *types.CliOptions) {
	if cli.All != nil {
		opts.All = *cli.All
	}
	if cli.Branch != "" {
		opts.Branch = cli.Branch
	}
	if cli.Command != "" {
		opts.Command = cli.Command
	}
	if cli.ChangeType != "" {
		opts.Type = types.ChangeType(cli.ChangeType)
	}
	if cli.Commit != nil {
		opts.Commit = *cli.Commit
	}
	if cli.DependentChangeType != "" {
		opts.DependentChangeType = types.ChangeType(cli.DependentChangeType)
	}
	if cli.Fetch != nil {
		opts.Fetch = *cli.Fetch
	}
	if cli.Message != "" {
		opts.Message = cli.Message
	}
	if cli.Package != nil {
		opts.Package = cli.Package
	}
	if cli.Path != "" {
		opts.Path = cli.Path
	}
	if cli.Scope != nil {
		opts.Scope = cli.Scope
	}
	if cli.Verbose != nil {
		opts.Verbose = *cli.Verbose
	}
}
