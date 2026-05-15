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
  sha1: 1,
});
export type FileHashType = (typeof FileHashType)[keyof typeof FileHashType];

export const FileLocationType = Object.freeze({
  AzureBlob: 'azureBlob',
});
export type FileLocationType = (typeof FileLocationType)[keyof typeof FileLocationType];

// Interfaces

export interface UserInfo {
  /** user email */
  userPrincipalName?: string;
}

export interface ApproverInfo {
  approver?: UserInfo;
  isAutoApproved?: boolean;
  isMandatory?: boolean;
}

export interface OwnerInfo {
  owner?: UserInfo;
}

export interface AccessPermissionsInfo {
  /** @example 'ESRPRelTest' */
  mainPublisher?: string;
  /** @deprecated */
  releasePublishers?: string[];
  /** @example { AllDownloadEntities: ['CBDSTEST'] } */
  channelDownloadEntityDetails?: Record<string, string[]>;
}

export interface FileLocation {
  type: FileLocationType;
  // these are not marked with NullValueHandling annotations, but aren't always provided in reality (not sure about blobUrl)
  /** blob URL for type AzureBlob */
  blobUrl?: string;
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
  name: string;
  /** sha256 hash of file (array of bytes or a string) */
  hash: number[] | string;
  sourceLocation: FileLocation;
  sizeInBytes?: number;
  hashType?: FileHashType;
  fileId?: unknown;
  distributionRelativePath?: string;
  partNumber?: string;
  friendlyFileName?: string;
  tenantFileLocationType: 'AzureBlob' | '1';
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
  title?: string;
  minimumNumberOfApprovers?: number;
  /**
   * @example { ReleaseContentType: 'sw electronic' }
   * @example { ReleaseContentType: 'InstallPackage' }
   * @example { ReleaseContentType: 'npm', IsRsm: 'false' }
   */
  properties?: Record<string, string>;
  isRevision?: boolean;
  revisionNumber?: string;
}

export interface ProductInfo {
  /** Name of the product */
  name?: string;
  /** Version of the product (for npm, this is arbitrary, not the package version) */
  version?: string;
  /** Description of the product */
  description?: string;
}

export interface RoutingInfo {
  /**
   * intent per onboarding
   * - `'Product Release'` for compliance or download center
   * - `'filedownloadlinkgeneration'` for static link release
   * - `'packagedistribution'` for npm release
   */
  intent?: string;
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
  /** email of the DRI for the team creating this release */
  driEmail?: string[];
  groupId?: string;
  customerCorrelationId?: string;
  esrpCorrelationId?: string;
  contextData?: Record<string, string>;
  releaseInfo?: ReleaseInfo;
  productInfo?: ProductInfo;
  files?: ReleaseFileInfo[];
  routingInfo?: RoutingInfo;
  createdBy?: UserInfo;
  owners?: OwnerInfo[];
  approvers?: ApproverInfo[];
  accessPermissionsInfo?: AccessPermissionsInfo;
  jwsToken?: string;
  publisherId?: string;
  downloadCenterInfo?: DownloadCenterInfo;
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
