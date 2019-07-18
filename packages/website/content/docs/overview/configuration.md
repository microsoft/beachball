---
title: 'Additional Configuration'
tags: overview
category: doc
---

For most uses you probably do not need any specific configuration on each package within your repository.  But there are a couple of options to customize `beachball`'s behavior.  These settings are specified in a `beachball` property in each package's `package.json`.  


### disallowedChangeTypes

If you want to restrict the change types that are available within a specific package `beachball` you can specify a list of change types that will be hidden from the options when creating change files.


```json
{
  "beachball": {
    "disallowedChangeTypes": [
      "major",
      "minor"
    ]
  }
}
```

This will prevent the user from selecting `major` or `minor` for their change types for this package.  Effectively restricting the change types to `patch`.


### shouldPublish

By default `beachball` will not create change files for packages that are marked as private.  If you have a package that is not marked private, but that you want to manage the publishing of manually you can specify `shouldPublish` to be false.


```json
{
  "beachball": {
    "shouldPublish": false
  }
}
```
