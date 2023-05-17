import { describe, expect, it } from '@jest/globals';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { validatePackageDependencies } from '../../publish/validatePackageDependencies';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

describe('validatePackageDependencies', () => {
  initMockLogs();

  it('invalid when dependencies contains private package', () => {
    const packageInfos = makePackageInfos({
      foo: { private: true },
      bar: { dependencies: { foo: '1.0.0' } },
    });
    expect(validatePackageDependencies(['foo', 'bar'], packageInfos)).toBeFalsy();
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
