// These types are derived from the ESRP OpenAPI specification.
// It doesn't appear to correctly specify which properties are required or optional, so what's below
// is the best guess based on what's been observed for usage with npm.
// Enum format also appears to be flexible with casing or numeric/string in some cases.

// Enums (in a format that allows running TS in Node natively)

export const StatusCode = Object.freeze({
  /** The workflow is in passed state and is successful. */
  Pass: 'pass',
  /** System is still running the workflow. */
  Inprogress: 'inprogress',
  /** There are problems with the workflow and user can resubmit the same file again for signing or scanning. */
  FailCanRetry: 'failCanRetry',
  /**
   * There are problems with the user provided input to the workflow.
   * It's recommended not to resubmit same workflow without changing input values which may be wrong.
   */
  FailDoNotRetry: 'failDoNotRetry',
  /** File may have been flagged by malware engine or may have been under investigation by support. */
  PendingAnalysis: 'pendingAnalysis',
  /** Release has been cancelled. -- TODO seeing some code checking "aborted"? */
  Cancelled: 'cancelled',
});
export type StatusCode = (typeof StatusCode)[keyof typeof StatusCode];

export const FileHashType = Object.freeze({
  sha256: 0,
});
export type FileHashType = (typeof FileHashType)[keyof typeof FileHashType];

export type FileLocationType = 'azureBlob';

// Interfaces

export interface UserInfo {
  /** Individual user email (DL/SG not supported) */
  userPrincipalName: string;
}

export interface ApproverInfo {
  /** Individual user (DL/SG not supported) */
  approver: UserInfo;
  isAutoApproved?: boolean;
  isMandatory?: boolean;
}

export interface OwnerInfo {
  /** Individual user (DL/SG not supported) */
  owner: UserInfo;
}

export interface AccessPermissionsInfo {
  /** Your team's publisher value, e.g. `ESRPRELPACMAN` (npm), `ESRPRelTest` */
  mainPublisher?: string;
  /** @example { AllDownloadEntities: ['CBDSTEST'] } */
  channelDownloadEntityDetails?: Record<string, string[]>;
}

export interface FileLocation {
  type: FileLocationType;
  /** blob SAS URL */
  blobUrl: string;
  /** URI */
  uncPath?: string;
  /** URI */
  url?: string;
}

export interface FileDownloadDetails {
  portalName?: string;
  downloadUrl?: string;
}

export interface ReleaseFileInfo {
  /** Arbitrary file name */
  name: string;
  /** sha256 hash of file as a base64 string */
  hash: string;
  /** file blob location */
  sourceLocation: FileLocation;
  sizeInBytes: number;
  hashType: FileHashType;
  fileId?: unknown;
  distributionRelativePath?: string;
  partNumber?: string;
  friendlyFileName?: string;
  tenantFileLocationType: 'AzureBlob';
  /** blob SAS URL for updated file */
  tenantFileLocation: string;
  signedEngineeringCopyLocation?: string;
  encryptedDistributionBlobLocation?: string;
  preEncryptedDistributionBlobLocation?: string;
  secondaryDistributionHashRequired?: boolean;
  secondaryDistributionHashType?: FileHashType;
  lastModifiedAt?: string;
  cultureCodes?: string[];
  displayFileInDownloadCenter?: boolean;
  isPrimaryFileInDownloadCenter?: boolean;
  fileDownloadDetails?: FileDownloadDetails[];
}

export interface ReleaseInfo {
  title: string;
  minimumNumberOfApprovers: number;
  properties:
    | {
        /** may be case-insensitive; other values may exist */
        ReleaseContentType: 'sw electronic' | 'InstallPackage' | 'npm';
        IsRsm: 'false';
      }
    | Record<string, string>;
  isRevision?: boolean;
  revisionNumber?: string;
}

export interface ProductInfo {
  /** Name of the product */
  name: string;
  /** Version of the product (for npm, this is arbitrary, not the package version) */
  version: string;
  /** Description of the product */
  description: string;
}

export interface RoutingInfo {
  /**
   * intent per onboarding
   * - `'packagedistribution'` or `'PackageDistribution'` for publishing to npm or other package manager
   * - `'Product Release'` for compliance or download center
   * - `'filedownloadlinkgeneration'` or `'FileLinkGeneration'` for static link release
   * - `'Winget'` for publishing to Windows Package Manager
   */
  intent: string;
  /** `'npm'` for npm */
  contentType?: string;
  contentOrigin?: string;
  /** for npm releases, this is the dist-tag */
  productState?: string;
  audience?: string;
}

export interface DownloadCenterLocaleInfo {
  cultureCode?: string;
  downloadTitle?: string;
  shortName?: string;
  shortDescription?: string;
  longDescription?: string;
  instructions?: string;
  additionalInfo?: string;
  keywords?: string[];
  version?: string;
  relatedLinks?: Record<string, string>;
}

export interface DownloadCenterInfo {
  downloadCenterId?: number;
  publishToDownloadCenter?: boolean;
  publishingGroup?: string;
  operatingSystems?: string[];
  relatedReleases?: string[];
  /** @example ['KB123456'] */
  kbNumbers?: string[];
  sbNumbers?: string[];
  locales?: DownloadCenterLocaleInfo[];
  additionalProperties?: Record<string, string>;
}

export interface ReleaseRequestMessage {
  /**
   * email(s) of the DRI for the team creating this release, possibly used if a release request fails
   * (supports DL/SG)
   */
  driEmail?: string[];
  groupId?: string;
  /** your unique correlation ID for this release request */
  customerCorrelationId?: string;
  /** same as `customerCorrelationId` */
  esrpCorrelationId?: string;
  contextData?: Record<string, string>;
  /** release title, content type, etc */
  releaseInfo: ReleaseInfo;
  /** product name, version, description */
  productInfo: ProductInfo;
  /** files to release */
  files?: ReleaseFileInfo[];
  /** info about how to handle the release */
  routingInfo: RoutingInfo;
  /** created by user (DL/SG not supported) */
  createdBy: UserInfo;
  /** individual owners (DL/SG not supported) */
  owners: OwnerInfo[];
  /** individual approvers (DL/SG not supported; all are non-mandatory and auto-approved) */
  approvers: ApproverInfo[];
  /** publisher and channel info */
  accessPermissionsInfo?: AccessPermissionsInfo;
  publisherId?: string;
  downloadCenterInfo?: DownloadCenterInfo;
  /**
   * JSON Web Signature token for the release request (must generate before sending).
   * This is created with the request signing certificate from initial options.
   */
  jwsToken?: string;
}

export interface ReleaseSubmitResponse {
  operationId?: string;
  esrpCorrelationId?: string;
  code?: string;
  message?: string;
  target?: string;
  innerError?: unknown;
}

export interface InnerServiceError {
  code?: string;
  details?: Record<string, string>;
  innerError?: InnerServiceError;
}

export interface ReleaseError {
  errorCode?: number;
  errorMessages?: string[];
}

export interface ReleaseActivityInfo {
  activityId?: string;
  activityType?: string;
  name?: string;
  status?: string;
  errorCode?: number;
  errorMessages?: string[];
  beginTime?: string;
  endTime?: string;
  lastModifiedAt?: string;
}

export interface ReleaseResultMessage {
  activities?: ReleaseActivityInfo[];
  // TODO should this be childworkflowType or childWorkflowType?
  childworkflowType?: string;
  childWorkflowType?: string;
  clientId?: string;
  customerCorrelationId?: string;
  // TODO should this be errorinfo or errorInfo?
  errorinfo?: InnerServiceError;
  errorInfo?: InnerServiceError;
  groupId?: string; //
  lastModifiedAt?: string;
  operationId?: string;
  releaseError?: ReleaseError;
  releaseVersion?: number;
  requestSubmittedAt?: string;
  routedRegion?: string;
  status?: StatusCode;
  totalFileCount?: number;
  totalReleaseSize?: number;
  version?: string;
}

export interface ReleaseDetailsMessage extends ReleaseResultMessage {
  clusterRegion?: string;
  correlationVector?: string;
  releaseCompletedAt?: string;
  releaseInfo?: ReleaseInfo;
  productInfo?: ProductInfo;
  createdBy?: UserInfo;
  owners?: OwnerInfo[];
  accessPermissionsInfo?: AccessPermissionsInfo;
  files?: ReleaseFileInfo[];
  comments?: string[];
  cancellationReason?: string;
  downloadCenterInfo?: DownloadCenterInfo;
}
