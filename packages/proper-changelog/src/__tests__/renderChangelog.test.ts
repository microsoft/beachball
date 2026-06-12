import { describe, it, expect } from '@jest/globals';
import { renderChangelog } from '../renderChangelog.ts';
import { makeRelease } from '../__fixtures__/makeRelease.ts';
import type { ProperChangelogOptions } from '../types.ts';

const repo = { owner: 'microsoft', repo: 'some-repo' };

function options(overrides: Partial<ProperChangelogOptions> = {}): ProperChangelogOptions {
  return { repo, ...overrides };
}

describe('renderChangelog', () => {
  it('renders a heading and per-release sections', () => {
    const releases = [
      makeRelease({
        tag_name: 'v2.0.0',
        name: 'Version 2.0.0',
        published_at: '2024-02-01T00:00:00Z',
        body: 'Second release.',
      }),
      makeRelease({
        tag_name: 'v1.0.0',
        name: 'v1.0.0',
        published_at: '2024-01-01T00:00:00Z',
        body: 'First release.',
      }),
    ];
    expect(renderChangelog(releases, options())).toMatchInlineSnapshot(`
      "# some-repo changelog

      ## Version 2.0.0

      _Tag [\`v2.0.0\`](https://github.com/microsoft/some-repo/releases/tag/v2.0.0) • released 2024-02-01_

      Second release.

      ## v1.0.0

      _Tag [\`v1.0.0\`](https://github.com/microsoft/some-repo/releases/tag/v1.0.0) • released 2024-01-01_

      First release.
      "
    `);
  });

  it('demotes headings in release bodies but leaves fenced code untouched', () => {
    const releases = [
      makeRelease({
        tag_name: 'v1.0.0',
        body: '# Features\r\n\r\n```sh\n# not a heading\n```\r\n\r\n## Details',
      }),
    ];
    expect(renderChangelog(releases, options())).toMatchInlineSnapshot(`
      "# some-repo changelog

      ## v1.0.0

      _Tag [\`v1.0.0\`](https://github.com/microsoft/some-repo/releases/tag/v1.0.0) • released 2024-01-01_

      ### Features

      \`\`\`sh
      # not a heading
      \`\`\`

      #### Details
      "
    `);
  });

  it('renders a placeholder when there are no releases', () => {
    expect(renderChangelog([], options())).toMatchInlineSnapshot(`
      "# some-repo changelog

      No releases found.
      "
    `);
  });
});
