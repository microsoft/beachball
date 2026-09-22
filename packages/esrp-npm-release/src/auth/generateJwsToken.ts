import jws from 'jws';
import type { ReleaseRequestMessage } from '../types/api.ts';
import { getThumbprint, pemToDer } from './signing.ts';

export interface JwsTokenParams {
  /** Certificate chain file content in PEM format */
  certificates: string[];
  /** Private key file content */
  privateKey: string;
}

export type ReleaseJwsHeader = Pick<jws.Header, 'alg' | 'crit'> & {
  /** X.509 certificate chain in non-standard '.' separated base64url format */
  x5c?: string;
  /** Expiration time in .NET ticks */
  exp: bigint;
  /** X.509 certificate thumbprint in hex format */
  x5t: string;
};

export function generateJwsToken(
  params: JwsTokenParams & { releaseRequest: Omit<ReleaseRequestMessage, 'jwsToken'> }
): string {
  const { releaseRequest, certificates, privateKey } = params;

  const header: ReleaseJwsHeader = {
    alg: 'RS256',
    crit: ['exp', 'x5t'],
    // Release service uses .NET ticks, not milliseconds (https://stackoverflow.com/a/7968483)
    exp: (BigInt(Date.now()) + 6n * 60n * 1000n) * 10000n + 621355968000000000n,
    // Release service uses hex format for thumbprint
    x5t: getThumbprint(certificates[0], 'sha1').toString('hex'),
    // Release service expects x5c as a '.' separated string, not the standard array format
    x5c: certificates.map((c: string) => pemToDer(c).toString('base64url')).join('.'),
  };

  return jws.sign({
    header: header as jws.Header,
    payload: releaseRequest,
    privateKey,
  });
}
