import { describe, it, expect } from '@jest/globals';
import { renderChangelog, type RenderChangelogOptions } from '../renderChangelog.ts';
import { makeRelease } from '../__fixtures__/makeRelease.ts';

const repo = { owner: 'microsoft', repo: 'some-repo' };

function options(overrides: Partial<RenderChangelogOptions> = {}): RenderChangelogOptions {
  return { repo, ...overrides };
}

describe('renderChangelog', () => {
  it('uses the release name and does not demote when there are no h2 headings', () => {
    const releases = [
      makeRelease({
        tag_name: 'v2.0.0',
        name: 'The big rewrite',
        published_at: '2024-02-01T00:00:00Z',
        body: 'Second release.',
      }),
      makeRelease({
        tag_name: 'v1.0.0',
        name: 'v1.0.0',
        published_at: '2024-01-01T00:00:00Z',
        body: 'First release.\n\n### Details\n\nSome details.',
      }),
    ];
    expect(renderChangelog(releases, options())).toMatchInlineSnapshot(`
      "# Changelog - some-repo

      ## v2.0.0 - The big rewrite

      _Tag [\`v2.0.0\`](https://github.com/microsoft/some-repo/releases/tag/v2.0.0) • released 2024-02-01_

      Second release.

      ## v1.0.0

      _Tag [\`v1.0.0\`](https://github.com/microsoft/some-repo/releases/tag/v1.0.0) • released 2024-01-01_

      First release.

      ### Details

      Some details.
      "
    `);
  });

  it('uses a single h2 as the section heading, prefixing the tag when needed', () => {
    const releases = [
      makeRelease({
        tag_name: 'v1.0.0',
        name: 'v1.0.0',
        body: "## What's Changed\n\n- Did a thing\n\n### Subsection\n\nMore.",
      }),
    ];
    expect(renderChangelog(releases, options())).toMatchInlineSnapshot(`
      "# Changelog - some-repo

      ## v1.0.0 - What's Changed

      _Tag [\`v1.0.0\`](https://github.com/microsoft/some-repo/releases/tag/v1.0.0) • released 2024-01-01_

      - Did a thing

      ### Subsection

      More.
      "
    `);
  });

  it('uses a single h2 unmodified when it already references the version', () => {
    const releases = [
      makeRelease({
        tag_name: 'v1.2.3',
        name: 'v1.2.3',
        body: '## Release 1.2.3\n\nNotes.',
      }),
    ];
    expect(renderChangelog(releases, options())).toMatchInlineSnapshot(`
      "# Changelog - some-repo

      ## Release 1.2.3

      _Tag [\`v1.2.3\`](https://github.com/microsoft/some-repo/releases/tag/v1.2.3) • released 2024-01-01_

      Notes.
      "
    `);
  });

  it('uses the release name and demotes all headings when there are multiple h2 headings', () => {
    const releases = [
      makeRelease({
        tag_name: 'v1.0.0',
        name: 'Big release',
        body: '## Features\n\n- A feature\n\n## Fixes\n\n- A fix',
      }),
    ];
    expect(renderChangelog(releases, options())).toMatchInlineSnapshot(`
      "# Changelog - some-repo

      ## v1.0.0 - Big release

      _Tag [\`v1.0.0\`](https://github.com/microsoft/some-repo/releases/tag/v1.0.0) • released 2024-01-01_

      ### Features

      - A feature

      ### Fixes

      - A fix
      "
    `);
  });

  it('demotes everything by one level when the body has an h1 (becoming the single h2)', () => {
    const releases = [
      makeRelease({
        tag_name: 'v1.0.0',
        body: '# Features\r\n\r\n```sh\n# not a heading\n```\r\n\r\n## Details',
      }),
    ];
    expect(renderChangelog(releases, options())).toMatchInlineSnapshot(`
      "# Changelog - some-repo

      ## v1.0.0 - Features

      _Tag [\`v1.0.0\`](https://github.com/microsoft/some-repo/releases/tag/v1.0.0) • released 2024-01-01_

      \`\`\`sh
      # not a heading
      \`\`\`

      ### Details
      "
    `);
  });

  it('renders a placeholder when there are no releases', () => {
    expect(renderChangelog([], options())).toMatchInlineSnapshot(`
      "# Changelog - some-repo

      No releases found.
      "
    `);
  });

  it('uses the package name in the heading when provided', () => {
    expect(renderChangelog([], options({ package: '@scope/some-pkg' }))).toMatchInlineSnapshot(`
      "# Changelog - @scope/some-pkg

      No releases found.
      "
    `);
  });
});
