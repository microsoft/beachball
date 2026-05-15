import jws from 'jws';
import type { ReleaseRequestMessage } from '../models/types.ts';
import { getThumbprint, pemToDer } from './signing.ts';

export interface JwsTokenParams {
  /** Certificate chain file content in PEM format */
  certificates: string[];
  /** Private key file content */
  privateKey: string;
}

export function generateJwsToken(params: JwsTokenParams & { releaseRequest: ReleaseRequestMessage }): string {
  const { releaseRequest, certificates, privateKey } = params;

  const expTicks = (BigInt(Date.now()) + 6n * 60n * 1000n) * 10000n + 621355968000000000n;

  // Create header with properly typed properties, then override x5c with the non-standard string format
  const header: jws.Header = {
    alg: 'RS256',
    crit: ['exp', 'x5t'],
    // Release service uses .NET ticks, not milliseconds (https://stackoverflow.com/a/7968483)
    exp: expTicks,
    // Release service uses hex format for thumbprint
    x5t: getThumbprint(certificates[0], 'sha1').toString('hex'),
  };

  // Release service expects x5c as a '.' separated string, not the standard array format
  (header as Record<string, unknown>)['x5c'] = certificates
    .map((c: string) => pemToDer(c).toString('base64url'))
    .join('.');

  return jws.sign({
    header,
    payload: releaseRequest,
    privateKey,
  });
}
