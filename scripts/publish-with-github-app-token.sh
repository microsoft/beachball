#!/usr/bin/env bash
set -euox pipefail

#
# This script acquires and sets credentials, then runs the publish command.
# It's meant to be run in ADO pipelines only.
#

key_id="https://ogx-oss-release-keyvault.vault.azure.net/keys/office-ogx-auth-helper-key"
# office-ogx-auth-helper GitHub App
app_client_id="Iv23ligBoU5jc9SIFnGR"
git_user_email="257645319+office-ogx-auth-helper[bot]@users.noreply.github.com"
git_user_name="OGX bot"
pack_dir="$BUILD_STAGINGDIRECTORY/out/packed-packages"

# Derive owner/repo from BUILD_REPOSITORY_ID (format: owner/repo)
# %% removes the longest matches of the pattern /* from the end of the string, leaving the owner
owner="${BUILD_REPOSITORY_ID%%/*}"
# # removes the shortest matches of the pattern */ from the start of the string, leaving the repository
repositories="${BUILD_REPOSITORY_ID#*/}"

# Mint a GitHub App installation token (CLI form; env-driven, prints to stdout).
token="$(
  APP_CLIENT_ID="$app_client_id" \
  KEY_ID="$key_id" \
  OWNER="$owner" \
  REPOSITORIES="$repositories" \
  PERMISSIONS="contents:write" \
  OUTPUT=stdout \
  node scripts/create-github-app-token.cjs
)"

# Configure the git author identity.
git config user.email "$git_user_email"
git config user.name "$git_user_name"

# Fail fast if the token wasn't produced or isn't a GitHub App installation token.
if [[ "$token" != ghs_* ]]; then
  echo "error: token is not in the expected GitHub App installation token format (ghs_...); starts with '${token:0:4}'" >&2
  exit 1
fi

# Encode the auth header value to be used below
authHeader=$(printf "x-access-token:%s" "$token" | base64 | tr -d '\n')

# Mark secrets to be masked in logs
echo "##vso[task.setsecret]$authHeader"
echo "##vso[task.setsecret]$token"

# Clear any existing extraheader config values before setting our own, and save them to be restored
# on exit. (The checkout step in 1ES templates ignores persistCredentials: false...)
# Each entry is "key\nvalue" (NUL-separated so values with spaces are preserved).
saved_extraheaders=()
while IFS= read -r -d '' entry; do
  saved_extraheaders+=("$entry")
done < <(git config -z --get-regexp '\.extraheader$' 2>/dev/null || true)

# The unique keys to clear before setting ours (a key may hold multiple values).
extraheader_keys=()
for entry in "${saved_extraheaders[@]}"; do
  extraheader_keys+=("${entry%%$'\n'*}")
done

# On exit: remove our temporary header and any leftovers, then restore the originals.
restore_git_config() {
  git config --unset-all "http.$BUILD_REPOSITORY_URI.extraheader" 2>/dev/null || true
  for key in "${extraheader_keys[@]}"; do
    git config --unset-all "$key" 2>/dev/null || true
  done
  for entry in "${saved_extraheaders[@]}"; do
    git config --add "${entry%%$'\n'*}" "${entry#*$'\n'}"
  done
}
trap restore_git_config EXIT

# Clear the saved extraheaders, then set our own so it's the only one on the wire.
for key in "${extraheader_keys[@]}"; do
  git config --unset-all "$key" 2>/dev/null || true
done
git config "http.$BUILD_REPOSITORY_URI.extraheader" "AUTHORIZATION: basic $authHeader"

# Make the pack output directory so it exists for artifact output even if nothing was packed.
mkdir -p "$pack_dir"

# TODO re-enable tagging
# TODO (release): change back to regular command
yarn release:others --git-tags=false --verbose --pack-to-path "$pack_dir"
# TODO: figure out if this should bump or not (currently does bump)
# TODO: update beachball to read the registry from .npmrc and/or .yarnrc.yml
# yarn release:canary --no-push --verbose --pack-to-path "$pack_dir"
# yarn beachball publish --prerelease-prefix test --no-push --pack-to-path "$pack_dir"
