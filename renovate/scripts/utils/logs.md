# Sample Renovate log entries

Documenting expected log and error format examples...

Some irrelevant JSON properties are removed throughout.

## Basic tests (`renovate-config-validator`)

These logs come from `renovate-config-validator` in `testPresetsBasic.ts`.

### Invalid property

`default.json` has an invalid property `asdf`.

```jsonc
[
  {
    "level": 30,
    "msg": "Validating /<path>/renovate/presets/default.json as repo config",
  },
  {
    "level": 50,
    "file": "/<path>/renovate/presets/groupFluent.json",
    "errors": [{ "topic": "Configuration Error", "message": "Invalid configuration option: asdf" }],
    "msg": "Found errors in configuration",
  },
]
```

### Migration needed

`default.json` has a setting that needs migration.

```jsonc
[
  { "level": 30, "msg": "Validating /<path>/renovate/presets/default.json as repo config" },
  {
    "level": 40,
    "oldConfig": {
      // whole old config
    },
    "newConfig": {
      // whole migrated config
    },
    "msg": "Config migration necessary",
  },
  {
    "level": 40,
    // whole formatted diff
    "msg": "Config migration diff:\n...\"matchPackageNames\": [\n          \"@fluentui/*\",\n          \"foo{/,}**\"\n        ],\n\u001b[31m- \u001b[39m      \"matchPackagePrefixes\": \"foo\",...",
  },
]
```

## Full tests (`renovate` dry run)

These logs come from `renovate` in `testPresetsFull.ts`.

### Invalid preset name

_(outdated)_

A config extends `github>microsoft/beachball//renovate/presets/oops` which doesn't exist.

If the fetch URL does not include `?ref=...` (e.g. `https://api.github.com/repos/microsoft/m365-renovate-config/contents/newPreset.json`) it probably means some preset extends `newPreset` which was newly-added in this PR (see comment in `serverConfig.ts`).

```jsonc
[
  {
    "level": 20,
    "msg": "GET https://api.github.com/repos/microsoft/m365-renovate-config/contents/oops.json?ref=refs/pull/232/merge = (code=ERR_NON_2XX_3XX_RESPONSE, statusCode=404 retryCount=0, duration=129)",
  },
  {
    "level": 20,
    "msg": "Preset fetch error",
    // this is the only place the preset name is specified
    "preset": "github>microsoft/beachball//renovate/presets/oops#refs/pull/232/merge",
    "err": {
      "err": {
        "name": "HTTPError",
        "code": "ERR_NON_2XX_3XX_RESPONSE",
        "message": "Response code 404 (Not Found)",
        "stack": "HTTPError: Response code 404 (Not Found)\n    at Request.<anonymous> (/home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/got/dist/source/as-promise/index.js:118:42)\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)",
        "options": {
          "url": "https://api.github.com/repos/microsoft/m365-renovate-config/contents/oops.json?ref=refs/pull/232/merge",
        },
        "response": {
          "statusCode": 404,
          "statusMessage": "Not Found",
        },
      },
      "message": "external-host-error",
      "stack": "Error: external-host-error\n    at GithubHttp.request (/home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/util/http/http.ts:244:15)\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at GithubHttp.requestJsonUnsafe (/home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/util/http/github.ts:353:20)\n    at GithubHttp.requestJson (/home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/util/http/http.ts:361:17)\n    at fetchJSONFile (/home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/config/presets/github/index.ts:29:11)\n    at fetchPreset (/home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/config/presets/util.ts:61:19)\n    at getPreset (/home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/config/presets/index.ts:133:20)\n    at fetchPreset (/home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/config/presets/index.ts:268:12)\n    at resolveConfigPresets (/home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/config/presets/index.ts:201:31)\n    at validatePresets (/home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/workers/global/index.ts:90:5)\n    at /home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/workers/global/index.ts:140:7\n    at start (/home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/workers/global/index.ts:120:5)\n    at /home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/renovate.ts:19:22",
    },
  },
  {
    "level": 50,
    "msg": "config-presets-invalid",
    // same object from above
    "err": {},
  },
  {
    "level": 60,
    "msg": "Unknown error",
    "err": {
      "message": "config-presets-invalid",
      "stack": "Error: config-presets-invalid\n    at validatePresets (/home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/workers/global/index.ts:93:11)\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at /home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/workers/global/index.ts:140:7\n    at start (/home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/workers/global/index.ts:120:5)\n    at /home/runner/work/m365-renovate-config/m365-renovate-config/node_modules/renovate/lib/renovate.ts:19:22",
    },
  },
  {
    "level": 30,
    "loggerErrors": [
      {
        "name": "renovate",
        "level": 50,
        "msg": "config-presets-invalid",
        // same object from above
        "err": {},
      },
      {
        "name": "renovate",
        "level": 60,
        "msg": "Unknown error",
        // same object from above
        "err": {},
      },
    ],
    "msg": "Renovate is exiting with a non-zero code due to the following logged errors",
  },
]
```

### Preset 404 (usually does not exist in main yet)

```jsonc

```
