import type { ReleaseFileInfo } from './types.ts';

type CreateReleaseFileInfo = ReleaseFileInfo &
  Required<
    Pick<
      ReleaseFileInfo,
      'name' | 'tenantFileLocation' | 'tenantFileLocationType' | 'hash' | 'hashType' | 'sizeInBytes' | 'sourceLocation'
    >
  >;

export interface CreateReleaseFileInfoParams {
  files: CreateReleaseFileInfo[];
  /** only applicable for download center release */
  cultureCodes?: string[];
}

export function createReleaseFileInfo(params: CreateReleaseFileInfoParams): ReleaseFileInfo[] {
  const { cultureCodes, files } = params;

  return files.map(file => ({
    ...file,
    ...(!!cultureCodes?.length && {
      cultureCodes,
      displayFileInDownloadCenter: true,
      isPrimaryFileInDownloadCenter: true,
    }),
  }));
}
