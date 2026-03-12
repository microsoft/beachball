package monorepo_test

import (
	"testing"

	"github.com/microsoft/beachball/internal/monorepo"
	"github.com/microsoft/beachball/internal/options"
	"github.com/microsoft/beachball/internal/testutil"
	"github.com/microsoft/beachball/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func getTestOptions(rootPath string) types.BeachballOptions {
	opts := types.DefaultOptions()
	opts.Path = rootPath
	opts.Branch = testutil.DefaultRemoteBranch
	opts.Fetch = false
	return opts
}

// TS: pnpm workspace detection
func TestGetPackageInfos_PnpmWorkspace(t *testing.T) {
	// Create a monorepo with packages but no npm workspaces in package.json
	rootPkg := map[string]any{
		"name":    "pnpm-monorepo",
		"version": "1.0.0",
		"private": true,
	}
	packages := map[string]map[string]any{
		"foo": {"name": "foo", "version": "1.0.0"},
		"bar": {"name": "bar", "version": "1.0.0"},
	}
	factory := testutil.NewCustomRepositoryFactory(t, rootPkg, map[string]map[string]map[string]any{
		"packages": packages,
	})
	repo := factory.CloneRepository()

	// Add pnpm-workspace.yaml
	repo.WriteFileContent("pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n")
	repo.Git([]string{"add", "-A"})
	repo.Git([]string{"commit", "-m", "add pnpm config"})

	opts := getTestOptions(repo.RootPath())
	parsed := options.GetParsedOptionsForTest(repo.RootPath(), types.CliOptions{}, opts)
	infos, err := monorepo.GetPackageInfos(&parsed.Options)
	require.NoError(t, err)

	assert.Contains(t, infos, "foo")
	assert.Contains(t, infos, "bar")
}

// TS: lerna workspace detection
func TestGetPackageInfos_LernaWorkspace(t *testing.T) {
	rootPkg := map[string]any{
		"name":    "lerna-monorepo",
		"version": "1.0.0",
		"private": true,
	}
	packages := map[string]map[string]any{
		"foo": {"name": "foo", "version": "1.0.0"},
		"bar": {"name": "bar", "version": "1.0.0"},
	}
	factory := testutil.NewCustomRepositoryFactory(t, rootPkg, map[string]map[string]map[string]any{
		"packages": packages,
	})
	repo := factory.CloneRepository()

	// Add lerna.json
	repo.WriteFileContent("lerna.json", `{"packages": ["packages/*"]}`)
	repo.Git([]string{"add", "-A"})
	repo.Git([]string{"commit", "-m", "add lerna config"})

	opts := getTestOptions(repo.RootPath())
	parsed := options.GetParsedOptionsForTest(repo.RootPath(), types.CliOptions{}, opts)
	infos, err := monorepo.GetPackageInfos(&parsed.Options)
	require.NoError(t, err)

	assert.Contains(t, infos, "foo")
	assert.Contains(t, infos, "bar")
}

// TS: rush workspace detection
func TestGetPackageInfos_RushWorkspace(t *testing.T) {
	rootPkg := map[string]any{
		"name":    "rush-monorepo",
		"version": "1.0.0",
		"private": true,
	}
	packages := map[string]map[string]any{
		"foo": {"name": "foo", "version": "1.0.0"},
		"bar": {"name": "bar", "version": "1.0.0"},
	}
	factory := testutil.NewCustomRepositoryFactory(t, rootPkg, map[string]map[string]map[string]any{
		"packages": packages,
	})
	repo := factory.CloneRepository()

	// Add rush.json with project folders
	repo.WriteFileContent("rush.json", `{
		"projects": [
			{"packageName": "foo", "projectFolder": "packages/foo"},
			{"packageName": "bar", "projectFolder": "packages/bar"}
		]
	}`)
	repo.Git([]string{"add", "-A"})
	repo.Git([]string{"commit", "-m", "add rush config"})

	opts := getTestOptions(repo.RootPath())
	parsed := options.GetParsedOptionsForTest(repo.RootPath(), types.CliOptions{}, opts)
	infos, err := monorepo.GetPackageInfos(&parsed.Options)
	require.NoError(t, err)

	assert.Contains(t, infos, "foo")
	assert.Contains(t, infos, "bar")
}
