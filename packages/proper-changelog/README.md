# proper-changelog

GitHub releases are useful in some ways, but they're horrible as changelogs if you need to look at changes across multiple versions or figure out when a specific change was introduced. This tool reads GitHub releases and generates a single markdown changelog.

## Usage

```bash
# By GitHub repository
npx proper-changelog --repo <owner>/<repo>

# By npm package name (the GitHub repository is read from the latest published version)
npx proper-changelog --package <package-name>
```

Exactly one of `--repo` or `--package` is required, and they cannot be used together.

By default this writes the changelog to `<repo>-changelog.md` in the current directory. Use `--stdout` to print it instead, or `--out` to choose a different file name.

```bash
# Write to a custom file
npx proper-changelog --repo microsoft/beachball --out CHANGELOG.md

# Print to stdout
npx proper-changelog --repo microsoft/beachball --stdout

# Resolve the repository from an npm package
npx proper-changelog --package @fluentui/react --stdout
```

## Authentication

The GitHub API is rate-limited for unauthenticated requests. To use a token, the tool checks the following in order:

1. The `--token` option
2. The `GITHUB_TOKEN` or `GH_TOKEN` environment variables
3. The output of `gh auth token` (if the [GitHub CLI](https://cli.github.com/) is installed and authenticated)

If no token is found, the tool prints a warning and continues unauthenticated.

## Options

| Option                  | Description                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--repo <owner/repo>`   | GitHub repository to read releases from. Required unless `--package` is given; cannot be used with it.                                                             |
| `--package <name>`      | npm package whose GitHub repository should be used (read from the latest published version's manifest). Required unless `--repo` is given; cannot be used with it. |
| `-o, --out <file>`      | Output file name (default: `<repo>-changelog.md`). Cannot be used with `--stdout`.                                                                                 |
| `--stdout`              | Write the changelog to stdout instead of a file. Cannot be used with `--out`.                                                                                      |
| `--token <token>`       | GitHub token (see [Authentication](#authentication)).                                                                                                              |
| `--include-prereleases` | Include prerelease releases. Draft releases are always excluded.                                                                                                   |
| `--from <tag>`          | Include releases up to and including this tag.                                                                                                                     |
| `--to <tag>`            | Include releases down to and including this tag.                                                                                                                   |
| `--limit <n>`           | Maximum number of releases to include.                                                                                                                             |

Releases are listed newest-first by published date. Draft releases are always excluded, and prereleases are excluded unless `--include-prereleases` is passed.

When using `--package`, only packages whose repository is on github.com are supported.

## API

The package currently does not have an importable API. If you want this, please open a feature request describing your use case.
