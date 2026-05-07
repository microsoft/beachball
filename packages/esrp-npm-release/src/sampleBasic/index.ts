import fs from 'fs';
import { createRelease } from './createRelease.ts';
import type { FileLocationType } from '../models/types.ts';
import { createNpmReleaseRequest, type CreateNpmReleaseRequestMessageParams } from '../releaseRequests/index.ts';
import type { JwsTokenParams } from '../utils/generateJwsToken.ts';
import { getCertificatesFromPemFile } from '../utils/signing.ts';
import { esrpApiEndpoint } from '../utils/getAadToken.ts';

const authCertPath = '<authentication-certificate-path>';
const authCertPrivateKeyPath = '<authentication-certificate-private-key-path>';
const signingCertPath = '<signing-certificate-path>';
const signingCertPrivateKeyPath = '<signing-certificate-private-key-path>';
// // optional, defaults to signingCertPath
// const signingCertChainPath = '<signing-certificate-chain-path>';
const clientId = 'esrp-onboarded-aad-app-client-id';
const tenantId = '72f988bf-86f1-41af-91ab-2d7cd011db47';

// TODO fill in params
const releaseParams: CreateNpmReleaseRequestMessageParams = {
  createdBy: 'me',
  driEmail: ['email'],
  owners: ['owner'],
  approvers: ['approver'],
  productInfo: {
    name: ' my-product',
    version: '1.3.0',
    description: 'Package Distribution through ESRP Release.',
  },
  releaseTitle: ' my-product',
  files: [
    {
      name: ' my-product-1.3.0.zip',
      hash: '******',
      hashType: 0,
      sizeInBytes: 123456,
      tenantFileLocationType: '1',
      // unclear how this would work as a local path
      tenantFileLocation: '/__w/1/s/<repo path>/out',
      sourceLocation: {
        blobUrl: '<azure blob URL of zip file>',
        type: 0 as unknown as FileLocationType,
      },
    },
  ],
};

async function main(): Promise<void> {
  const jwsParams: JwsTokenParams = {
    certificates: getCertificatesFromPemFile(signingCertPath),
    privateKey: fs.readFileSync(signingCertPrivateKeyPath, 'utf-8'),
  };

  const releaseRequest = createNpmReleaseRequest(releaseParams, jwsParams);

  await createRelease({
    endpoint: esrpApiEndpoint,
    clientId,
    tenantId,
    auth: { certPath: authCertPath, privateKeyPath: authCertPrivateKeyPath },
    releaseRequest,
  });
}

main().catch(err => {
  console.error((err as Error).stack || err);
  // eslint-disable-next-line no-restricted-properties -- main exit handler
  process.exit(1);
});
