import { beforeAll, describe, expect, it } from '@jest/globals';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createNpmReleaseRequest, redactReleaseRequest } from '../models/npmRelease.ts';
import { FileHashType, type ReleaseFileInfo, type ReleaseRequestMessage } from '../models/types.ts';
import { generateTestCert, isOpensslAvailable, type TestCert } from '../__fixtures__/testCert.ts';
import { setupTempDir } from '../__fixtures__/tempDir.ts';
import { ReleaseError } from '../utils/ReleaseError.ts';

// eslint-disable-next-line no-restricted-properties -- intentional skip when openssl is unavailable
const describeIfOpenssl = isOpensslAvailable() ? describe : describe.skip;

describe('redactReleaseRequest', () => {
  const blobUrl = 'https://acct.blob.core.windows.net/staging/someblob';
  const blobSasUrl = `${blobUrl}?sv=2021-01-01&sig=SECRET&se=2099-01-01T00:00:00Z`;

  /** Build a minimal ReleaseRequestMessage shape with potentially-sensitive fields populated. */
  function makeMessage(): ReleaseRequestMessage {
    return {
      driEmail: ['dri@example.com'],
      jwsToken: 'abc123.payload.signature',
      files: [
        { name: 'pkg.tgz', tenantFileLocation: blobSasUrl, sourceLocation: { type: 'azureBlob', blobUrl: blobSasUrl } },
      ] as ReleaseFileInfo[],
    };
  }

  it('replaces the JWS token with "***"', () => {
    const redacted = redactReleaseRequest(makeMessage());
    expect(redacted.jwsToken).toBe('***');
  });

  it('strips SAS query strings from tenantFileLocation and sourceLocation.blobUrl', () => {
    const redacted = redactReleaseRequest(makeMessage());
    const file = redacted.files![0];
    expect(file.tenantFileLocation).toBe(`${blobUrl}?***`);
    expect(file.sourceLocation.blobUrl).toBe(`${blobUrl}?***`);
  });

  it('does not mutate the original message (uses structuredClone)', () => {
    const original = Object.freeze(makeMessage());
    const originalJws = original.jwsToken;
    const originalLocation = original.files![0].tenantFileLocation;

    redactReleaseRequest(original);

    expect(original.jwsToken).toBe(originalJws);
    expect(original.files![0].tenantFileLocation).toBe(originalLocation);
    expect(original.files![0].tenantFileLocation).toContain('SECRET');
  });

  it('preserves non-sensitive fields untouched', () => {
    const redacted = redactReleaseRequest(makeMessage());
    expect(redacted.driEmail).toEqual(['dri@example.com']);
    expect(redacted.files![0].name).toBe('pkg.tgz');
  });

  it('leaves a tenantFileLocation without a query string unchanged', () => {
    const msg = makeMessage();
    msg.files![0].tenantFileLocation = blobUrl;
    msg.files![0].sourceLocation.blobUrl = blobUrl;

    const redacted = redactReleaseRequest(msg);
    expect(redacted.files![0].tenantFileLocation).toBe(blobUrl);
    expect(redacted.files![0].sourceLocation.blobUrl).toBe(blobUrl);
  });
});

describeIfOpenssl('createNpmReleaseRequest', () => {
  let testCert: TestCert;
  const fileDir = setupTempDir({ cleanup: 'afterAll' });

  beforeAll(() => {
    testCert = generateTestCert();
  });

  function makeFile(name: string, contents: string): string {
    const fullPath = path.join(fileDir.getTempDir(), name);
    fs.writeFileSync(fullPath, contents);
    return fullPath;
  }

  function baseParams(filePath: string) {
    return {
      correlationId: 'corr-1',
      driEmail: ['dri@example.com'],
      createdBy: 'creator@example.com',
      owners: ['owner1@example.com', 'owner2@example.com'],
      approvers: ['approver@example.com'],
      releaseTitle: 'TestProduct',
      productInfo: { name: 'TestProduct', version: 'commit-0', description: 'desc' },
      file: { path: filePath, sasBlobUrl: 'https://acct.blob.core.windows.net/staging/key?sig=SECRET' },
      requestSigningCertificates: [testCert.leafCertPem, testCert.caCertPem],
      requestSigningKey: testCert.keyPem,
    };
  }

  it('builds a request with the expected shape and JWS token', async () => {
    const filePath = makeFile('pkg.tgz', 'hello world');
    const params = baseParams(filePath);

    const result = await createNpmReleaseRequest(params);

    // The full message shape is part of the contract -- pin it in one assertion so any
    // accidental change to default values (e.g. mainPublisher, IsRsm, contentType) is caught.
    expect(result).toEqual({
      esrpCorrelationId: 'corr-1',
      customerCorrelationId: 'corr-1',
      driEmail: ['dri@example.com'],
      createdBy: { userPrincipalName: 'creator@example.com' },
      owners: [
        { owner: { userPrincipalName: 'owner1@example.com' } },
        { owner: { userPrincipalName: 'owner2@example.com' } },
      ],
      approvers: [
        { approver: { userPrincipalName: 'approver@example.com' }, isAutoApproved: true, isMandatory: false },
      ],
      accessPermissionsInfo: { mainPublisher: 'ESRPRELPACMAN' },
      productInfo: { name: 'TestProduct', version: 'commit-0', description: 'desc' },
      releaseInfo: {
        title: 'TestProduct',
        minimumNumberOfApprovers: 1,
        isRevision: false,
        properties: { ReleaseContentType: 'npm', IsRsm: 'false' },
      },
      // No npmTag → no productState
      routingInfo: { intent: 'packagedistribution', contentType: 'npm' },
      files: [
        {
          name: 'pkg.tgz',
          tenantFileLocation: params.file.sasBlobUrl,
          tenantFileLocationType: 'AzureBlob',
          sourceLocation: { type: 'azureBlob', blobUrl: params.file.sasBlobUrl },
          hashType: FileHashType.sha256,
          hash: Array.from(crypto.createHash('sha256').update('hello world').digest()),
          sizeInBytes: 11,
        },
      ],
      jwsToken: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/),
    });
  });

  it('includes productState when npmTag is provided', async () => {
    const filePath = makeFile('tagged.tgz', 'x');
    const result = await createNpmReleaseRequest({ ...baseParams(filePath), npmTag: 'beta' });

    expect(result.routingInfo).toEqual({
      intent: 'packagedistribution',
      contentType: 'npm',
      productState: 'beta',
    });
  });

  it('omits productState when npmTag is empty string', async () => {
    const filePath = makeFile('untagged.tgz', 'x');
    const result = await createNpmReleaseRequest({ ...baseParams(filePath), npmTag: '' });

    expect(result.routingInfo).toEqual({ intent: 'packagedistribution', contentType: 'npm' });
  });

  it('throws ReleaseError when the file does not exist', async () => {
    const params = baseParams('/no/such/file/exists.tgz');
    const err = await createNpmReleaseRequest(params).catch(e => e as unknown);

    expect(err).toBeInstanceOf(ReleaseError);
    expect((err as ReleaseError).message).toContain('Failed to stat or hash file /no/such/file/exists.tgz');
  });
});
