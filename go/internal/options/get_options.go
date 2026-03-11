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

	return types.ParsedOptions{Options: opts, CliOptions: cli}, nil
}

// GetParsedOptionsForTest creates parsed options for testing with explicit overrides.
func GetParsedOptionsForTest(cwd string, cli types.CliOptions, repoOpts types.BeachballOptions) types.ParsedOptions {
	opts := types.DefaultOptions()
	opts.Path = cwd

	// Apply repo overrides
	if repoOpts.Branch != "" {
		opts.Branch = repoOpts.Branch
	}
	if !repoOpts.Fetch {
		opts.Fetch = false
	}
	if repoOpts.All {
		opts.All = true
	}
	if repoOpts.Verbose {
		opts.Verbose = true
	}
	if repoOpts.Commit {
		opts.Commit = repoOpts.Commit
	}
	if !repoOpts.Commit {
		opts.Commit = false
	}
	if repoOpts.ChangeDir != "" {
		opts.ChangeDir = repoOpts.ChangeDir
	}
	if repoOpts.IgnorePatterns != nil {
		opts.IgnorePatterns = repoOpts.IgnorePatterns
	}
	if repoOpts.Scope != nil {
		opts.Scope = repoOpts.Scope
	}
	if repoOpts.Path != "" {
		opts.Path = repoOpts.Path
	}
	if repoOpts.DisallowDeletedChangeFiles {
		opts.DisallowDeletedChangeFiles = true
	}
	if repoOpts.Groups != nil {
		opts.Groups = repoOpts.Groups
	}
	if repoOpts.GroupChanges {
		opts.GroupChanges = true
	}

	// Apply CLI overrides
	applyCliOptions(&opts, &cli)

	return types.ParsedOptions{Options: opts, CliOptions: cli}
}

func applyRepoConfig(opts *types.BeachballOptions, cfg *RepoConfig) {
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
