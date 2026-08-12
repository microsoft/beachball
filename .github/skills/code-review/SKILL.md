## Validating of change file change type

When determining correctness of a package's semver change `type` in a change file (`change/*.json`), first get its current `version` from `package.json`.

The minimum `type` should be as follows depending on the package's version (the user may also specify a more significant `type`):

| Package version  | Consumer impact                                                     | Minimum `type` |
| ---------------- | ------------------------------------------------------------------- | -------------- |
| Any              | No consumer-visible effect (e.g. test-only or internal doc changes) | `none`         |
| Prerelease       | Any consumer-visible effect                                         | `prerelease`   |
| Stable `0.x`     | Breaking API or behavior change                                     | `minor`        |
| Stable `0.x`     | Any other consumer-visible change                                   | `patch`        |
| Stable `>=1.0.0` | Breaking API or behavior change                                     | `major`        |
| Stable `>=1.0.0` | New backward-compatible public functionality                        | `minor`        |
| Stable `>=1.0.0` | Backward-compatible fix or behavior correction                      | `patch`        |

For stable `0.x` packages, they should not use `type: "minor"` unless there are breaking changes (this is a common mistake).
