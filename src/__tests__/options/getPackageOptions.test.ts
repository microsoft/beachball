import { cosmiconfigSync } from 'cosmiconfig';
import { getPackageOptions } from '../../options/getPackageOptions';
import { PackageOptions } from '../../types/BeachballOptions';

jest.mock('cosmiconfig');

describe('getPackageOptions', () => {
  const defaultConfig: PackageOptions = {
    gitTags: true,
    defaultNpmTag: 'latest',
    disallowedChangeTypes: ['major'],
    tag: null,
  };
  const mockCosmiconfig = (options: Partial<PackageOptions> = {}, result: any = {}) => {
    (cosmiconfigSync as jest.Mock).mockReturnValue({
      load: (): any => ({
        filepath: '',
        config: {
          ...defaultConfig,
          ...options,
        },
        ...result,
      }),
    });
  };

  it('should return config if defined', () => {
    // Arrange
    mockCosmiconfig();

    // Act
    const res = getPackageOptions('/path/test');

    // Assert
    expect(res).toEqual(defaultConfig);
  });

  it.each([null, undefined])('should return empty object if config is %s', config => {
    // Arrange
    mockCosmiconfig({}, { config });

    // Act & Assert
    expect(getPackageOptions('/path/test')).toEqual({});
  });

  it.each([null, undefined])('should return empty object if config is %s', returnValue => {
    // Arrange
    (cosmiconfigSync as jest.Mock).mockReturnValue({ load: () => returnValue });

    // Act & Assert
    expect(getPackageOptions('/path/test')).toEqual({});
  });
});
