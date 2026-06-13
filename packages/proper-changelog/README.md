# proper-changelog

GitHub releases are useful in some ways, but they're horrible as changelogs if you need to look at changes across multiple versions or figure out when a specific change was introduced. This tool reads GitHub releases and generates a single markdown changelog.

## Usage

```bash
# By GitHub repository
npx proper-changelog --repo <owner>/<repo>

# By npm package name (the GitHub repository is read from the latest published version)
npx proper-changelog --package <package-name>
```

Exactly one of `--repo` or `--package` is required.

Releases are listed newest-first by published date. Draft releases are always excluded, and prereleases are excluded unless `--include-prereleases` is passed.

By default this writes the changelog to `CHANGELOG-<package-or-repo>.md` in the current directory (using the package name when `--package` is given, otherwise the repo name). Use `--stdout` to print it instead, or `--out` to choose a different file name.

```bash
# Write to a custom file
npx proper-changelog --repo microsoft/beachball --out CHANGELOG.md

# Print to stdout
npx proper-changelog --repo microsoft/beachball --stdout

# Resolve the repository from an npm package
npx proper-changelog --package @fluentui/react --stdout
```

## Options

Either `--package` or `--repo` is required, and they're mutually exclusive.

<!-- prettier-ignore -->
| Option | Description |
| ------ | ----------- |
| `--repo <owner/repo>` | GitHub repository to read releases from. |
| `--package <name>` | npm package whose GitHub repository should be used (read from the latest published version on npmjs.com; only supports github.com repos). Note that for a monorepo, this does **not** do any filtering of releases by package. |
| `-o, --out <file>` | Output file name (default: `CHANGELOG-<package-or-repo>.md`). Mutually exclusive with `--stdout`. |
| `--stdout` | Write the changelog to stdout instead of a file. Mutually exclusive with `--out`. |
| `--token <token>` | GitHub token (see [Authentication](#authentication)). |
| `--include-prereleases` | Include prerelease releases. Draft releases are always excluded. |
| `--from <tag>` | Include releases up to and including this tag (based on date, **not** semver). |
| `--to <tag>` | Include releases down to and including this tag (based on date, **not** semver). |
| `--limit <n>` | Maximum number of releases to include. |
| `--filter <pattern>` | Only include releases whose **tag** matches `<pattern>`. A plain string matches tags containing it (case-insensitive); wrap the value in slashes (e.g. `/^v1\./i`) to match with a regular expression. Useful for monorepos that tag releases per package. (Warning: this is _not_ sanitized, so ReDOS yourself at will.) |
| `--since <date>` | Only include releases published after this date. Accepts any value parseable by `new Date()`, such as `2024-01-01`. |

## Authentication

The GitHub API is rate-limited for unauthenticated requests. To use a token, the tool checks the following in order:

1. The `--token` option
2. The `GITHUB_TOKEN` or `GH_TOKEN` environment variables
3. The output of `gh auth token` (if the [GitHub CLI](https://cli.github.com/) is installed and authenticated)

If no token is found, the tool prints a warning and continues unauthenticated.

## API

The package currently does not have an importable API. If you want this, please open a feature request describing your use case.
