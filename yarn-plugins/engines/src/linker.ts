import type { Linker, Project, Installer } from '@yarnpkg/core';
import type { PortablePath } from '@yarnpkg/fslib';

/**
 * No-op linker, only used to observe whether the link step ran. If not (e.g. `--mode=update-lockfile`),
 * the plugin should no-op, since packages aren't installed on disk and can't be validated.
 *
 * This workaround is needed because the install mode is only exposed directly to the
 * `afterAllInstalled` hook (via its `options.mode`), not `validateProjectAfterInstall`.
 */
export class EnginesProbeLinker implements Linker {
  /** The cwds of projects whose link step ran during this process */
  private static linkedProjectCwds = new Set<PortablePath>();
  /**
   * Returns whether the link step ran for the given project.
   * If not, its files aren't available on disk.
   */
  public static wasProjectLinked(project: Project): boolean {
    return EnginesProbeLinker.linkedProjectCwds.has(project.cwd);
  }

  /** Called at the start of every link step, and used to determine whether linking occurred */
  public makeInstaller(opts: { project: Project }): Installer {
    EnginesProbeLinker.linkedProjectCwds.add(opts.project.cwd);
    return new EnginesProbeInstaller();
  }
  public supportsPackage = (): boolean => false;
  public findPackageLocation = (): Promise<never> => {
    throw new Error('Assertion failed: this code should never be called');
  };
  public findPackageLocator = (): Promise<null> => Promise.resolve(null);
  public getCustomDataKey = (): string => 'yarn-plugin-engines-probe';
}

/** Never used since the corresponding linker never installs anything */
class EnginesProbeInstaller implements Installer {
  public attachCustomData = () => {};
  public installPackage = () => Promise.resolve({ packageLocation: null, buildRequest: null });
  public attachInternalDependencies = async () => {};
  public attachExternalDependents = async () => {};
  public finalizeInstall = async () => {};
}
