import type { BlobServiceClient } from '@azure/storage-blob';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs';
import jws from 'jws';
import path from 'path';
import type { CreateReleaseParams, ESRPReleaseService as ESRPReleaseServiceType } from '../ESRPReleaseService.ts';
import { MockLogger } from '../__fixtures__/MockLogger.ts';
import {
  createMockBlobServiceClient,
  createMockBlockBlobClient,
  createMockContainerClient,
  type MockBlobServiceClient,
  type MockBlockBlobClient,
  type MockContainerClient,
} from '../__fixtures__/mockAzure.ts';
import { createMockEsrpHttp } from '../__fixtures__/mockEsrpHttp.ts';
import { setupTempDir } from '../__fixtures__/tempDir.ts';
import { generateTestCert, isOpensslAvailable, type TestCert } from '../__fixtures__/testCert.ts';
import type * as getAadTokenModule from '../auth/getAadToken.ts';
import { esrpApiScope } from '../esrpApi/releaseHttp.ts';
import { ReleaseError } from '../utils/ReleaseError.ts';

const mockGetAadToken = jest.fn<typeof getAadTokenModule.getAadToken>();
jest.unstable_mockModule<typeof getAadTokenModule>('../auth/getAadToken.ts', () => ({
  getAadToken: mockGetAadToken,
}));

// Mock hashFileStream to avoid issues with fake timers (the hash isn't used)
jest.unstable_mockModule<typeof import('../utils/hashFileStream.ts')>('../utils/hashFileStream.ts', () => ({
  hashFileStream: () => Promise.resolve(Buffer.from('fake')),
}));

const mockEsrpHttp = createMockEsrpHttp();
jest.unstable_mockModule('../esrpApi/releaseHttp.ts', () => mockEsrpHttp);

// Late import after mocks are registered (required by jest.unstable_mockModule)
const { ESRPReleaseService } = await import('../ESRPReleaseService.ts');

// eslint-disable-next-line no-restricted-properties
const describeIfOpenssl = isOpensslAvailable() ? describe : describe.skip;

describeIfOpenssl('ESRPReleaseService.createRelease', () => {
  let testCert: TestCert;
  let zipFilePath: string;
  let logger: MockLogger;
  let blobClient: MockBlockBlobClient;
  let containerClient: MockContainerClient;
  let blobServiceClient: MockBlobServiceClient;
  let service: ESRPReleaseServiceType;
  const blobUrl = 'https://stagingaccount.blob.core.windows.net/staging/r/op-1';
  const zipName = 'layer-01-123456789.zip';

  // The staged "zip" file is a real file on disk for e2e testing
  const fileDir = setupTempDir({ cleanup: 'afterAll' });

  beforeAll(() => {
    testCert = generateTestCert();
    zipFilePath = path.join(fileDir.getTempDir(), zipName);
    fs.writeFileSync(zipFilePath, 'mock zip contents');
  });

  beforeEach(async () => {
    jest.useFakeTimers();
    // Default to a far-future expiry so polling doesn't trigger refresh; specific tests
    // override this to exercise the refresh path.
    mockGetAadToken.mockResolvedValue({ token: 'aad-token', expiresOnTimestamp: Date.now() + 24 * 60 * 60 * 1000 });
    mockEsrpHttp.submitRelease.mockResolvedValue({ operationId: 'mock-op-id' });
    mockEsrpHttp.getReleaseStatus.mockResolvedValue({ status: 'pass' });
    mockEsrpHttp.getReleaseDetails.mockResolvedValue({});
    logger = new MockLogger();
    blobClient = createMockBlockBlobClient(blobUrl);
    containerClient = createMockContainerClient({ blobClient });
    blobServiceClient = createMockBlobServiceClient({ containerClient });

    service = await ESRPReleaseService.create({
      logger,
      clientId: 'cid',
      tenantId: 'tid',
      // Used only for getAadToken (which is mocked), so the value is never parsed
      authCertificatePfx: 'auth-pfx-not-parsed',
      // Real PFX -- parsed by getKeyAndCertificatesFromPFX in the constructor
      requestSigningCertificatePfx: testCert.pfxBase64,
      stagingBlobServiceClient: blobServiceClient as unknown as BlobServiceClient,
    });
    logger.startGroup('layer-01', 'Releasing layer 01');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  function releaseParams(overrides?: Partial<CreateReleaseParams>): CreateReleaseParams {
    return {
      filePath: zipFilePath,
      stagingBlobPathPrefix: 'repo1',
      releaseRequestParams: {
        createdBy: 'me@example.com',
        driEmail: ['me@example.com'],
        owners: ['me@example.com'],
        approvers: ['me@example.com'],
        productInfo: { name: 'TestProduct', version: 'abc-01', description: 'desc' },
        releaseTitle: 'TestProduct',
        npmTag: undefined,
      },
      ...overrides,
    };
  }

  async function runCreateRelease(overrides?: Partial<CreateReleaseParams>) {
    const promise = service.createRelease(releaseParams(overrides));
    promise.catch(() => undefined); // suppress unhandled rejection while running timers
    await jest.runAllTimersAsync();
    return promise;
  }

  async function expectReleaseError(message: string, originalError?: Error) {
    const err = await runCreateRelease().catch(e => e as unknown);
    expect(err).toBeInstanceOf(ReleaseError);
    expect((err as ReleaseError).message).toContain(message);
    if (originalError) {
      expect((err as ReleaseError).cause).toBe(originalError);
    } else {
      expect((err as ReleaseError).cause).toBeUndefined();
    }
  }

  it('acquires creds, uploads blob, signs+submits, polls until pass, deletes blob', async () => {
    logger.addPath(fileDir.getTempDir(), '<temp>');

    await runCreateRelease();

    expect(mockGetAadToken).toHaveBeenCalledWith({
      scopes: [`${esrpApiScope}.default`],
      clientId: 'cid',
      tenantId: 'tid',
      auth: { certPfxContent: 'auth-pfx-not-parsed' },
      logger,
    });
    expect(blobServiceClient.getUserDelegationKey).toHaveBeenCalledTimes(1);
    expect(blobClient.uploadFile).toHaveBeenCalledWith(zipFilePath);
    expect(mockEsrpHttp.submitRelease).toHaveBeenCalledTimes(1);
    expect(mockEsrpHttp.getReleaseDetails).toHaveBeenCalledWith({
      clientId: 'cid',
      bearerToken: 'aad-token',
      releaseId: 'mock-op-id',
    });
    expect(blobClient.delete).toHaveBeenCalledTimes(1);

    // One snapshot of output to verify it looks reasonable (remove large objects and UUIDs)
    expect(
      logger.lines
        .map(line => line.replace(/\{[\s\S]*\}$/, '{ ... }'))
        .map(line => line.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, '<uuid>'))
    ).toMatchInlineSnapshot(`
      [
        "[log] Getting client and ensuring staging container "staging" exists",
        "[log] Extracting request signing key and certificates from PFX",
        "[log] Found 2 certificate(s) in PFX; leaf is at index 0 (using as-is)",
        "[log] ##[group]Releasing layer 01",
        "[log] [layer-01] Acquiring fresh credentials for release",
        "[log] [layer-01] Acquiring AAD access token for ESRP API at https://api.esrp.microsoft.com/",
        "[log] [layer-01] Requesting user delegation key for staging storage account "mockaccount"",
        "[log] [layer-01] Uploading <temp>/layer-01-123456789.zip to https://stagingaccount.blob.core.windows.net/staging/r/op-1",
        "[log] [layer-01] Generating SAS token for staging blob "repo1/<uuid>"",
        "[log] [layer-01] Preparing to submit release",
        "[log] [layer-01] Sending request to ESRP API: { ... }",
        "[log] [layer-01] Successfully submitted release mock-op-id. Polling for completion...",
        "[log] [layer-01] Release status: "pass"",
        "[log] [layer-01] Release mock-op-id passed. Last status details: { ... }",
        "[log] [layer-01] Release mock-op-id passed; fetching release details",
        "[log] [layer-01] Release details: { ... }",
        "[log] [layer-01] Deleting blob https://stagingaccount.blob.core.windows.net/staging/r/op-1",
      ]
    `);
  });

  it('submits a request whose file URLs include the SAS token suffix', async () => {
    await runCreateRelease();

    const { releaseRequest } = mockEsrpHttp.submitRelease.mock.calls[0][0];
    expect(releaseRequest.files).toHaveLength(1);
    const file = releaseRequest.files![0];
    expect(file.name).toBe(zipName);
    expect(file.tenantFileLocationType).toBe('AzureBlob');
    // The blob URL should be the staging URL + a SAS token query string ("?sv=...")
    expect(file.tenantFileLocation).toContain(`${blobUrl}?`);
    expect(file.sourceLocation.blobUrl).toBe(file.tenantFileLocation);
    // SAS token shape: must include Azure SAS query parameters (just test one)
    expect(file.tenantFileLocation).toMatch(/[?&]sig=/);
  });

  it('signs the request with a JWS verifiable against the configured signing cert', async () => {
    await runCreateRelease();

    const { releaseRequest } = mockEsrpHttp.submitRelease.mock.calls[0][0];
    expect(typeof releaseRequest.jwsToken).toBe('string');
    expect(releaseRequest.jwsToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(jws.verify(releaseRequest.jwsToken!, 'RS256', testCert.leafCertPem)).toBe(true);
  });

  // verifying current implementation (unclear if it's strictly needed)
  it('re-acquires AAD and SAS credentials per createRelease call', async () => {
    await runCreateRelease();
    await runCreateRelease();

    expect(mockGetAadToken).toHaveBeenCalledTimes(2);
    expect(blobServiceClient.getUserDelegationKey).toHaveBeenCalledTimes(2);
  });

  it('refreshes AAD access token during polling when near expiry', async () => {
    // First token: near-expiry (refresh threshold is 5 min before expiry, so this already
    // qualifies for refresh on the first poll). Second token: far-future.
    mockGetAadToken
      .mockResolvedValueOnce({ token: 'aad-token-1', expiresOnTimestamp: Date.now() + 10_000 })
      .mockResolvedValueOnce({ token: 'aad-token-2', expiresOnTimestamp: Date.now() + 24 * 60 * 60 * 1000 });
    mockEsrpHttp.queueStatuses(['inprogress', 'pass']);

    await runCreateRelease();

    // Initial acquisition + one refresh during polling.
    expect(mockGetAadToken).toHaveBeenCalledTimes(2);
    // Submit happens before polling refresh, so it uses the original token; all status
    // calls happen after the first refresh check, so they use the refreshed token.
    expect(mockEsrpHttp.submitRelease.mock.calls[0][0].bearerToken).toBe('aad-token-1');
    const statusCalls = mockEsrpHttp.getReleaseStatus.mock.calls;
    expect(statusCalls.every(c => c[0].bearerToken === 'aad-token-2')).toBe(true);
    expect(logger.lines.some(l => l.includes('AAD access token near expiry, refreshing'))).toBe(true);
  });

  it('polls every 5 seconds', async () => {
    mockEsrpHttp.queueStatuses(['inprogress', 'inprogress', 'pass']);

    const promise = service.createRelease(releaseParams());
    promise.catch(() => undefined);
    await jest.advanceTimersByTimeAsync(5000);
    expect(mockEsrpHttp.submitRelease).toHaveBeenCalledTimes(1);
    expect(mockEsrpHttp.getReleaseStatus).toHaveBeenCalledTimes(1);

    // Each additional 5s should produce one more poll until 'pass'.
    await jest.advanceTimersByTimeAsync(5000);
    expect(mockEsrpHttp.getReleaseStatus).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(5000);
    expect(mockEsrpHttp.getReleaseStatus).toHaveBeenCalledTimes(3);

    await jest.runAllTimersAsync();
    await promise;
  });

  it('logs status only when status changes (not every poll)', async () => {
    mockEsrpHttp.queueStatuses(['inprogress', 'inprogress', 'inprogress', 'pass']);

    await runCreateRelease();

    const statusLines = logger.lines.filter(l => l.includes('Release status:'));
    expect(statusLines).toEqual([
      '[log] [layer-01] Release status: "inprogress"',
      '[log] [layer-01] Release status: "pass"',
    ]);
  });

  it.each([
    ['aborted', 'Release was aborted'],
    ['cancelled', 'Release was aborted'],
    ['unexpected', 'Unexpected release status "unexpected"'],
  ] as const)('throws ReleaseError on "%s" status', async (status, messagePart) => {
    mockEsrpHttp.queueStatuses([status]);

    await expectReleaseError(messagePart);
    expect(blobClient.delete).toHaveBeenCalledTimes(1);
  });

  it('throws a custom auth-focused message for npm registry 404 errors', async () => {
    mockEsrpHttp.getReleaseStatus.mockResolvedValue({
      // Based on an actual failure response
      status: 'failDoNotRetry',
      errorInfo: {
        details: {
          errors: '404 Not Found - PUT https://registry.npmjs.org/@microsoft%2fsome-lib - Not found',
        },
      },
    });

    const err = await runCreateRelease().catch(e => e as unknown);
    expect(err).toBeInstanceOf(ReleaseError);
    const message = (err as ReleaseError).message;
    expect(message).toContain('Release failed with 404 on npm publish:');
    expect(message).toContain('Full status API response');
    expect(blobClient.delete).toHaveBeenCalledTimes(1);
  });

  it('throws ReleaseError after polling timeout (720 iterations of inprogress)', async () => {
    mockEsrpHttp.getReleaseStatus.mockResolvedValue({ status: 'inprogress' });

    await expectReleaseError('Timed out waiting for release. Most recent status');
    expect(mockEsrpHttp.getReleaseStatus).toHaveBeenCalledTimes(720);
  });

  it.each(['submitRelease', 'getReleaseStatus'] as const)('propagates %s failures', async method => {
    const originalError = new ReleaseError(`${method} failed`);
    mockEsrpHttp[method].mockRejectedValue(originalError);
    const err = await runCreateRelease().catch(e => e as unknown);
    expect(err).toBe(originalError);
  });

  it('logs getReleaseDetails failure as a warning but does not fail the release', async () => {
    mockEsrpHttp.getReleaseStatus.mockResolvedValue({ status: 'pass' });
    mockEsrpHttp.getReleaseDetails.mockRejectedValue(new Error('details failed'));

    await runCreateRelease(); // should not throw — packages were already published
    expect(logger.lines.some(l => l.startsWith('[warn]') && l.includes('succeeded but fetching details failed'))).toBe(
      true
    );
  });

  it('wraps SAS token generation failures with ReleaseError', async () => {
    const originalError = new Error('sas failed');
    blobServiceClient.getUserDelegationKey.mockRejectedValue(originalError);
    await expectReleaseError('Error generating SAS token', originalError);
  });

  it('wraps AAD token failures with ReleaseError', async () => {
    const originalError = new Error('aad failed');
    mockGetAadToken.mockRejectedValue(originalError);
    await expectReleaseError('Error acquiring access token for ESRP API', originalError);
  });

  it('wraps blob upload failures with ReleaseError', async () => {
    const originalError = new Error('upload failed');
    blobClient.uploadFile.mockRejectedValue(originalError);
    await expectReleaseError('Error uploading file to staging storage', originalError);
  });

  it('logs blob deletion failure as a warning but preserves the original outcome', async () => {
    mockEsrpHttp.getReleaseStatus.mockResolvedValue({ status: 'pass' });
    blobClient.delete.mockRejectedValue(new Error('delete failed'));

    await runCreateRelease(); // should not throw
    expect(logger.lines.some(l => l.startsWith('[warn]') && l.includes('Failed to delete blob'))).toBe(true);
  });

  it('preserves the original error when blob deletion also fails after a release error', async () => {
    mockEsrpHttp.queueStatuses(['aborted']);
    blobClient.delete.mockRejectedValue(new Error('delete failed'));

    await expectReleaseError('Release was aborted');
    expect(logger.lines.some(l => l.startsWith('[warn]') && l.includes('Failed to delete blob'))).toBe(true);
  });
});
