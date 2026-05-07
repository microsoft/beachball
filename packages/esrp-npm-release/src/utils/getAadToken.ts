import fs from 'fs';
import type { AccessToken } from '@azure/core-auth';
import { ConfidentialClientApplication, type AuthenticationResult, type NodeAuthOptions } from '@azure/msal-node';
import type { ReleaseHttpParams } from './releaseHttp.ts';
import { getCertificatesFromPFX, getKeyFromPFX, getThumbprint } from './signing.ts';

export interface GetAadTokenParams extends Pick<ReleaseHttpParams, 'clientId'> {
  tenantId: string;
  endpoint: string;
  auth: { certPath: string; privateKeyPath: string } | { certPfxContent: string } | { idToken: string };
}

export type { AccessToken };

export const esrpApiEndpoint = 'https://api.esrp.microsoft.com/';

/**
 * Get a `ConfidentialClientApplication` access token from AAD using a certificate.
 */
export async function getAadToken(params: GetAadTokenParams): Promise<AccessToken> {
  const { clientId, auth, endpoint } = params;

  const authOptions: NodeAuthOptions = {
    clientId,
    authority: `https://login.microsoftonline.com/${params.tenantId}`,
  };

  if ('idToken' in auth) {
    authOptions.clientAssertion = auth.idToken;
  } else {
    let certContent: string;
    let keyContent: string;
    if ('certPath' in auth) {
      certContent = fs.readFileSync(auth.certPath, 'utf-8');
      keyContent = fs.readFileSync(auth.privateKeyPath, 'utf-8');
    } else {
      certContent = getCertificatesFromPFX(auth.certPfxContent)[0];
      keyContent = getKeyFromPFX(auth.certPfxContent);
    }
    const thumbprintSha256 = getThumbprint(certContent, 'sha256').toString('hex');
    authOptions.clientCertificate = {
      thumbprintSha256,
      privateKey: keyContent,
      x5c: certContent,
    };
  }

  const cca = new ConfidentialClientApplication({ auth: authOptions });

  let result: AuthenticationResult | null;
  try {
    result = await cca.acquireTokenByClientCredential({
      scopes: [`${endpoint}.default`],
    });
  } catch (ex: unknown) {
    const message = ex instanceof Error ? ex.message : String(ex);
    throw new Error(`Error acquiring AAD token: ${message}`);
  }

  if (!result || !result.expiresOn) {
    throw new Error('Failed to acquire AAD token: no result returned');
  }

  return {
    token: result.accessToken,
    expiresOnTimestamp: result.expiresOn.getTime(),
    refreshAfterTimestamp: result.refreshOn?.getTime(),
  };
}
