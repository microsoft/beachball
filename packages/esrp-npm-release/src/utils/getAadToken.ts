import type { AccessToken } from '@azure/core-auth';
import { ConfidentialClientApplication, type AuthenticationResult, type NodeAuthOptions } from '@azure/msal-node';
import type { ReleaseHttpParams } from './releaseHttp.ts';
import { getKeyAndCertificatesFromPFX, getThumbprint } from './signing.ts';
import { ReleaseError } from './ReleaseError.ts';

export interface GetAadTokenParams extends Pick<ReleaseHttpParams, 'clientId'> {
  tenantId: string;
  endpoint: string;
  auth: { certPfxContent: string } | { idToken: string };
}

export type { AccessToken };

/**
 * Get a `ConfidentialClientApplication` access token from AAD using a certificate.
 * Throws a `ReleaseError` on failure.
 */
export async function getAadToken(params: GetAadTokenParams): Promise<AccessToken> {
  const { clientId, tenantId, auth, endpoint } = params;

  const authOptions: NodeAuthOptions = {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
  };

  if ('idToken' in auth) {
    authOptions.clientAssertion = auth.idToken;
  } else {
    try {
      const { key, certificates } = getKeyAndCertificatesFromPFX(auth.certPfxContent);
      const thumbprintSha256 = getThumbprint(certificates[0], 'sha256').toString('hex');
      authOptions.clientCertificate = {
        thumbprintSha256,
        privateKey: key,
        x5c: certificates[0],
      };
    } catch (err) {
      throw new ReleaseError(`Error parsing cert info to acquire token`, { cause: err });
    }
  }

  let result: AuthenticationResult | null;
  const scope = `${endpoint}.default`;
  const errorMessageBase = `Failed to acquire token for client "${clientId}" in tenant "${tenantId}" with scope "${scope}"`;
  try {
    const cca = new ConfidentialClientApplication({ auth: authOptions });
    result = await cca.acquireTokenByClientCredential({ scopes: [scope] });
  } catch (ex) {
    throw new ReleaseError(errorMessageBase, { cause: ex });
  }

  if (!result || !result.expiresOn) {
    throw new ReleaseError(`${errorMessageBase}: no result returned`);
  }

  return {
    token: result.accessToken,
    expiresOnTimestamp: result.expiresOn.getTime(),
    refreshAfterTimestamp: result.refreshOn?.getTime(),
  };
}
