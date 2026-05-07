import fs from 'fs';
import { createRelease } from './createRelease.ts';
import { createNpmReleaseRequest } from '../models/npmRelease.ts';
import { generateJwsToken } from '../utils/generateJwsToken.ts';
import { getCertificatesFromPemFile } from '../utils/signing.ts';
import { esrpApiEndpoint } from '../utils/getAadToken.ts';
import { randomUUID } from 'crypto';

const authCertPath = '<authentication-certificate-path>';
const authCertPrivateKeyPath = '<authentication-certificate-private-key-path>';
const signingCertPath = '<signing-certificate-path>';
const signingCertPrivateKeyPath = '<signing-certificate-private-key-path>';
// // optional, defaults to signingCertPath
// const signingCertChainPath = '<signing-certificate-chain-path>';
const clientId = 'esrp-onboarded-aad-app-client-id';
const tenantId = '72f988bf-86f1-41af-91ab-2d7cd011db47';

async function main(): Promise<void> {
  // TODO fill in params
  const releaseRequest = createNpmReleaseRequest({
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
    // files: [
    //   {
    //     name: ' my-product-1.3.0.zip',
    //     hash: '******',
    //     hashType: 0,
    //     sizeInBytes: 123456,
    //     tenantFileLocationType: '1',
    //     // unclear how this would work as a local path
    //     tenantFileLocation: '/__w/1/s/<repo path>/out',
    //     sourceLocation: {
    //       blobUrl: '<azure blob URL of zip file>',
    //       type: 0 as unknown as FileLocationType,
    //     },
    //   },
    // ],
  });
  releaseRequest.customerCorrelationId = releaseRequest.esrpCorrelationId = randomUUID();
  releaseRequest.jwsToken = generateJwsToken({
    releaseRequest,
    certificates: getCertificatesFromPemFile(signingCertPath),
    privateKey: fs.readFileSync(signingCertPrivateKeyPath, 'utf-8'),
  });

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
