import { describe, expect, it } from '@jest/globals';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { validatePackageDependencies } from '../../publish/validatePackageDependencies';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

describe('validatePackageDependencies', () => {
  const logs = initMockLogs();

  it.each(['dependencies', 'peerDependencies', 'optionalDependencies'] as const)(
    'invalid when %s contains private package',
    depType => {
      const packageInfos = makePackageInfos({
        foo: { private: true },
        bar: { [depType]: { foo: '1.0.0' } },
      });
      expect(validatePackageDependencies(['foo', 'bar'], packageInfos)).toBeFalsy();

      expect(logs.getMockLines('error')).toEqual(
        'ERROR: Found private packages among published package dependencies:\n  • foo: used by bar'
      );
    }
  );

  it('valid when non-listed package depends on private package', () => {
    const packageInfos = makePackageInfos({
      foo: { private: true },
      bar: {},
      baz: { dependencies: { foo: '1.0.0' } },
    });
    expect(validatePackageDependencies(['bar'], packageInfos)).toBeTruthy();
  });

  it('valid when devDependencies contains private package', () => {
    const packageInfos = makePackageInfos({
      foo: { private: true },
      bar: { devDependencies: { foo: '1.0.0' } },
    });
    expect(validatePackageDependencies(['foo', 'bar'], packageInfos)).toBeTruthy();
  });

  it('valid when no private package is listed as dependency', () => {
    const packageInfos = makePackageInfos({
      foo: {},
      bar: { dependencies: { foo: '1.0.0' } },
    });
    expect(validatePackageDependencies(['foo', 'bar'], packageInfos)).toBeTruthy();
  });

  it('valid when no package has dependency', () => {
    const packageInfos = makePackageInfos({
      foo: {},
      bar: {},
    });
    expect(validatePackageDependencies(['foo', 'bar'], packageInfos)).toBeTruthy();
  });
});
