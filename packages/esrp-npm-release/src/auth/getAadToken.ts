import type { AccessToken } from '@azure/core-auth';
import { ConfidentialClientApplication, type AuthenticationResult, type NodeAuthOptions } from '@azure/msal-node';
import type { Logger } from '../utils/Logger.ts';
import type { ReleaseHttpParams } from '../esrpApi/releaseHttp.ts';
import { getKeyAndCertificatesFromPFX, getThumbprint } from './signing.ts';
import { ReleaseError } from '../utils/ReleaseError.ts';

export interface GetAadTokenParams extends Pick<ReleaseHttpParams, 'clientId'> {
  tenantId: string;
  scopes: string[];
  auth: { certPfxContent: string } | { idToken: string };
  logger: Logger;
}

export type { AccessToken };

/**
 * Get a `ConfidentialClientApplication` access token from AAD using a certificate.
 * Throws a `ReleaseError` on failure.
 */
export async function getAadToken(params: GetAadTokenParams): Promise<AccessToken> {
  const { clientId, tenantId, auth, scopes, logger } = params;

  const authOptions: NodeAuthOptions = {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
  };

  if ('idToken' in auth) {
    authOptions.clientAssertion = auth.idToken;
  } else {
    try {
      const { key, certificates } = getKeyAndCertificatesFromPFX(auth.certPfxContent, logger);
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
  const errorMessageBase = `Failed to acquire token for client "${clientId}" in tenant "${tenantId}" with scope ${JSON.stringify(scopes)}`;
  try {
    const cca = new ConfidentialClientApplication({ auth: authOptions });
    result = await cca.acquireTokenByClientCredential({ scopes });
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
