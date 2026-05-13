# check-for-modified-files

Run this at the end of a workflow to determine if any files were modified, and if so, fail.

One example of how this is useful is to prevent forgotten lock file updates.

(Despite the repo name, this particular action is not specific to [Beachball](https://microsoft.github.io/beachball).)

## Getting started

To run this action:

```yaml
jobs:
  build:
    steps:
      # at the end of your workflow:
      - uses: microsoft/beachball/actions/check-for-modified-files@v3
```

## Inputs

| Name         | Type   | Description                                           |
| ------------ | ------ | ----------------------------------------------------- |
| `extraError` | string | Optional extra error message to display in the output |
