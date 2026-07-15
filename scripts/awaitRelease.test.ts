import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as realHelpers from './helpers.ts';
import type { PipelineRun } from './awaitRelease.ts';

const mockFetch = jest.fn<typeof realHelpers.fetchWithRetry>();
// Resolve immediately so polling loops advance without real (or faked) delays.
const mockSleep = jest.fn<typeof realHelpers.sleep>(() => Promise.resolve());
jest.unstable_mockModule<typeof realHelpers>('./helpers.ts', () => ({
  ...realHelpers,
  sleep: mockSleep,
  fetchWithRetry: mockFetch as typeof realHelpers.fetchWithRetry,
}));
jest.resetModules();

const { awaitRelease } = await import('./awaitRelease.ts');

const alias = 'publish-pipeline';
const baseEnv: NodeJS.ProcessEnv = {
  AUTH_TOKEN: 'auth-token',
  ESRP_PIPELINE_ID: '42',
  PUBLISH_PIPELINE_ALIAS: alias,
  SYSTEM_COLLECTIONURI: 'https://dev.azure.com/org/',
  SYSTEM_TEAMPROJECT: 'proj',
  BUILD_BUILDID: '1234',
};

const runsUrl = 'https://dev.azure.com/org/proj/_apis/pipelines/42/runs';
const listUrl = `${runsUrl}?api-version=7.1`;
const detailUrl = (id: number) => `${runsUrl}/${id}?api-version=7.1`;

/** A run whose source resource points back at our build (so discovery matches it). */
function matchingRun(id: number, extra: Record<string, unknown> = {}): PipelineRun {
  return { id, resources: { pipelines: { [alias]: { run: { id: 1234 } } } }, ...extra };
}

/** Set the mocked `fetchWithRetry` implementation from a URL handler. */
function setFetchMock(handler: (url: string) => unknown): void {
  mockFetch.mockImplementation(((url: string) =>
    Promise.resolve(handler(url))) as unknown as typeof realHelpers.fetchWithRetry);
}

describe('awaitRelease', () => {
  let logs: string[];

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });
  });

  beforeEach(() => {
    mockFetch.mockReset();
    logs = [];
  });

  it('fails when required env inputs are missing', async () => {
    await expect(awaitRelease({})).rejects.toThrow('process.exit');
    expect(logs.join('\n')).toContain('Required env input(s) not set: AUTH_TOKEN ESRP_PIPELINE_ID');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('gates successfully when the release run completes as succeeded', async () => {
    setFetchMock(url => {
      if (url === listUrl) return { value: [{ id: 100 }] };
      if (url === detailUrl(100)) return matchingRun(100, { state: 'completed', result: 'succeeded' });
      throw new Error(`unexpected url ${url}`);
    });

    await expect(awaitRelease(baseEnv)).resolves.toBeUndefined();
    expect(logs).toContain('Found release run 100');
    expect(logs).toContain('state=completed result=succeeded');
  });

  it('correlates via resources.pipelines[alias].run.id and skips non-matching runs', async () => {
    setFetchMock(url => {
      if (url === listUrl) return { value: [{ id: 100 }, { id: 200 }] };
      // 100 belongs to a different build; 200 is ours.
      if (url === detailUrl(100))
        return { id: 100, resources: { pipelines: { [alias]: { run: { id: 9999 } } } } } satisfies PipelineRun;
      if (url === detailUrl(200)) return matchingRun(200, { state: 'completed', result: 'succeeded' });
      throw new Error(`unexpected url ${url}`);
    });

    await expect(awaitRelease(baseEnv)).resolves.toBeUndefined();
    expect(logs).toContain('Found release run 200');
  });

  it('polls until the release run is queued', async () => {
    let listCalls = 0;
    setFetchMock(url => {
      if (url === listUrl) {
        listCalls++;
        // The run isn't queued on the first two polls, then appears.
        return { value: listCalls < 3 ? [] : [{ id: 100 }] };
      }
      if (url === detailUrl(100)) return matchingRun(100, { state: 'completed', result: 'succeeded' });
      throw new Error(`unexpected url ${url}`);
    });

    await expect(awaitRelease(baseEnv)).resolves.toBeUndefined();
    expect(listCalls).toBe(3);
    expect(logs.filter(l => l.startsWith('release run not queued yet'))).toHaveLength(2);
    expect(logs).toContain('Found release run 100');
  });

  it('polls until the release run completes', async () => {
    // The first entry is consumed by the discovery lookup (which only reads resources),
    // leaving two in-progress polls before completion.
    const states = ['inProgress', 'inProgress', 'inProgress', 'completed'];
    setFetchMock(url => {
      if (url === listUrl) return { value: [{ id: 100 }] };
      if (url === detailUrl(100)) {
        // First call is the discovery lookup; subsequent calls poll for completion.
        const state = states.shift()!;
        return matchingRun(100, { state, result: state === 'completed' ? 'succeeded' : undefined });
      }
      throw new Error(`unexpected url ${url}`);
    });

    await expect(awaitRelease(baseEnv)).resolves.toBeUndefined();
    expect(logs.filter(l => l === 'state=inProgress result=')).toHaveLength(2);
    expect(logs).toContain('state=completed result=succeeded');
  });

  it.each(['failed', 'canceled'])('fails when the release result is %s', async result => {
    setFetchMock(url => {
      if (url === listUrl) return { value: [{ id: 100 }] };
      if (url === detailUrl(100)) return matchingRun(100, { state: 'completed', result });
      throw new Error(`unexpected url ${url}`);
    });

    await expect(awaitRelease(baseEnv)).rejects.toThrow('process.exit');
    expect(logs.join('\n')).toContain(`Release result: ${result}`);
  });

  it('fails after exhausting the discovery timeout', async () => {
    setFetchMock(url => {
      if (url === listUrl) return { value: [] };
      throw new Error(`unexpected url ${url}`);
    });

    await expect(awaitRelease(baseEnv)).rejects.toThrow('process.exit');
    expect(mockFetch).toHaveBeenCalledTimes(60);
    expect(logs.join('\n')).toContain('No release run for build run 1234');
  });
});
