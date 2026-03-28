---
tags:
  - overview
category: doc
---

# Change types

When running [`beachball change`](../cli/change), you need to choose a **change type** that describes the impact of your changes. Beachball uses this to determine how to bump the package version.

The available types follow [semantic versioning](https://semver.org/) conventions.

## Choosing a change type

### Stable packages (version >= 1.0.0)

<!-- prettier-ignore -->
| Type | When to use | Version bump |
| ---- | ----------- | ------------ |
| `patch` | Bug fixes or internal changes that don't affect exported API signatures | 1.0.0 → 1.0.1 |
| `minor` | New exported APIs, non-breaking changes to exported API signatures, or significant changes to internal logic | 1.0.0 → 1.1.0 |
| `major` | Breaking changes to exported APIs (removals or breaking signature changes), critical dependency updates, or behavior changes that could break consumers | 1.0.0 → 2.0.0 |
| `none` | Changes that don't affect consumers at all (tests, documentation, internal config) | no bump |

When in doubt between `minor`/`patch` or `patch`/`none`, it's generally best to choose the larger change type.

### Zero-version packages (version 0.x.y)

Packages with a major version of 0 are considered unstable per the semver spec. The conventions are slightly different:

| Type    | When to use                                    | Version bump  |
| ------- | ---------------------------------------------- | ------------- |
| `patch` | Any non-breaking changes that affect consumers | 0.1.0 → 0.1.1 |
| `minor` | Breaking changes                               | 0.1.0 → 0.2.0 |
| `none`  | Changes that don't affect consumers at all     | no bump       |

## Disallowed change types

Some repos or packages may restrict which change types are allowed using the [`disallowedChangeTypes`](../overview/configuration#options) config option. For example, `major` bumps are often disallowed to ensure coordination of major release efforts. Any disallowed options will be omitted from the interactive prompt, and a change file or `--type` argument that uses a disallowed type will cause an error.

## Tips for reviewers

Change files show up as part of the PR diff, making it easy to verify the change type during code review. Common things to watch for:

- A `patch` that should be `minor` because a new API was added
- A `minor` that should be `major` because an existing API was changed in a breaking way
- A `none` that should be `patch` because the change does affect published output
