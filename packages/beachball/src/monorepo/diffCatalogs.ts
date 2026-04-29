import type { Catalog, Catalogs, NamedCatalogs } from 'workspace-tools';

/**
 * Returns a `Catalogs` containing only the entries that were added or changed in `after`
 * relative to `before`. Removed entries (and removed named catalogs) are excluded.
 * Returns `undefined` if nothing was added or changed.
 *
 * (It's possible that newly-added catalog entries didn't actually change from their
 * prior versions, but it's better to be conservative and include them.)
 */
export function diffCatalogs(options: { before: Catalogs; after: Catalogs }): Catalogs | undefined {
  const { before, after } = options;
  let result: Catalogs | undefined;

  if (after.default) {
    const defaultDiff = diffCatalog(before.default, after.default);
    if (defaultDiff) {
      result = { default: defaultDiff };
    }
  }

  if (after.named) {
    const namedDiff: NamedCatalogs = {};
    for (const [catalogName, catalog] of Object.entries(after.named)) {
      const catalogDiff = diffCatalog(before.named?.[catalogName], catalog);
      if (catalogDiff) {
        namedDiff[catalogName] = catalogDiff;
      }
    }

    if (Object.keys(namedDiff).length) {
      result = { ...result, named: namedDiff };
    }
  }

  return result;
}

function diffCatalog(before: Catalog | undefined, after: Catalog): Catalog | undefined {
  const diff: Catalog = {};
  let hasDiff = false;
  for (const [name, version] of Object.entries(after)) {
    if (before?.[name] !== version) {
      diff[name] = version;
      hasDiff = true;
    }
  }
  return hasDiff ? diff : undefined;
}
