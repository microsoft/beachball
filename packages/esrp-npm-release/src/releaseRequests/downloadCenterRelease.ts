import type { CreateReleaseFileInfoParams } from '../models/releaseFileInfo.ts';
import type { DownloadCenterInfo } from '../models/types.ts';
import type { JwsTokenParams } from '../utils/generateJwsToken.ts';
import {
  createReleaseRequest,
  type CreateReleaseRequestMessageParams,
  type GeneratedReleaseRequestMessage,
} from './baseRelease.ts';

export function createDownloadCenterReleaseRequest(
  params: CreateReleaseRequestMessageParams &
    Required<CreateReleaseFileInfoParams> & {
      downloadCenterInfo: DownloadCenterInfo;
    },
  signingParams?: JwsTokenParams
): GeneratedReleaseRequestMessage {
  return createReleaseRequest(params, signingParams, request => {
    request.routingInfo = {
      intent: 'Product Release', //this will be available after onboarding is completed
    };
    request.releaseInfo.properties = {
      ReleaseContentType: 'sw electronic', //update this after onboarding is complete
    };
    request.downloadCenterInfo = params.downloadCenterInfo;
  });
}

// files: [createReleaseFileInfo(['en-us'])],
// downloadCenterInfo: {
//   kbNumbers: ['KB123456'], //list of KB numbers
//   locales: [
//     {
//       //these fields are required for download center and would be visible on the download center page
//       cultureCode: 'en-us', //culture code
//       downloadTitle: 'DownloadTitle', //download title
//       longDescription: 'LongDescription', //long description
//       instructions: 'Instructions', //instructions
//       shortDescription: 'ShortDescription', //short description
//       version: '1.0', //version
//       additionalInfo: 'AdditionalInformation', //additional information
//     },
//   ],
