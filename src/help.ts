import type { PackageJson } from './types/PackageInfo';

export function showVersion(): void {
  const packageJson = require('../package.json') as PackageJson;
  console.log(`beachball v${packageJson.version} - the sunniest version bumping tool`);
}

export function showHelp(): void {
  showVersion();

  console.log(`Usage:

  beachball [command] [options]

Examples:

    $ beachball
    $ beachball check
    $ beachball publish -r http://localhost:4873 -t beta -b beta

Commands:

    change (default)  - create change files in the change/ folder
    check             - checks whether a change file is needed for this branch
    bump              - bumps versions as well as generating changelogs
    publish           - bumps, publishes to npm registry (optionally does dist-tags), and
                        pushes changelogs back into the default branch
    sync              - synchronize published versions of packages from the registry with
                        local package.json versions

Options supported by all commands:

    --branch, -b      - target branch from remote (default: git config init.defaultBranch)
    --change-dir      - name of the directory to store change files (default: change)
    --config-path, -c - custom beachball config path (default: cosmiconfig standard paths)
    --no-fetch        - skip fetching from the remote before determining changes
    --scope           - only consider package paths matching this pattern
                        (can be specified multiple times; supports negations)
    --since           - consider changes or change files since this git ref (branch name, commit SHA)
    --verbose         - prints additional information to the console

'change' options:

    --message, -m           - description for all changed packages (instead of prompting)
    --type                  - type of change: minor, patch, none, ... (instead of prompting)
    --package, -p           - force creating a change file for this package, regardless of diffs
                              (can be specified multiple times)
    --all                   - generate change files for all packages
    --dependent-change-type - use this change type for dependent packages (default patch)
    --no-commit             - stage change files only

'check' options:

    --changehint                    - give your developers a customized hint message when they
                                      forget to add a change file
    --disallow-deleted-change-files - verifies that no change files were deleted between head and
                                      target branch.

'bump' options:

    --keep-change-files     - don't delete the change files from disk after bumping
    --prerelease-prefix     - prerelease prefix for packages that will receive a prerelease bump

'publish' options:

    Also supports all 'bump' options.

    --auth-type             - npm auth type: 'authtoken' or 'password'
    --message, -m           - commit message (default: "applying package updates")
    --no-bump               - skip both bumping versions and pushing changes back to git remote
    --no-git-tags           - don't create git tags for each published package version
    --no-publish            - skip publishing to the npm registry
    --no-push               - skip committing changes and pushing them back to the git remote
    --registry, -r          - registry (default https://registry.npmjs.org)
    --retries               - number of retries for npm publishes (default: 3)
    --tag, -t               - dist-tag for npm publishes (default: "latest")
    --token                 - npm token or password
    --yes, -y               - skip the confirmation prompts

'sync' options:

    --registry, -r          - registry (default https://registry.npmjs.org)
    --tag, -t               - sync to the specified npm dist-tag (default: 'latest')
    --force                 - use the version from the registry even if it's older than local

`);
}
