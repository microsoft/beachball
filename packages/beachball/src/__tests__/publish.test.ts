import fs from 'fs';
import path from 'path';
import { RepositoryFactory, Repository } from '../fixtures/repository';
import { Registry } from '../fixtures/registry';
import { publish } from '../publish';
import { CliOptions } from '../CliOptions';
import { writeChangeFiles } from '../changefile';
import { ChangeInfo } from '../ChangeInfo';
import { testPackageInfo, testPackageJson } from '../fixtures/package';

describe('publish', () => {
  let repository: Repository;
  let repositoryFactory: RepositoryFactory;
  let registry: Registry;
  let cliOptions: CliOptions;
  let packageFile: string;

  beforeAll(async () => {
    // Have to increase timeout due to other registry tests occurring in parallel for socket hunting.
    jest.setTimeout(30000);

    registry = new Registry();
    repositoryFactory = new RepositoryFactory();

    await repositoryFactory.create();
    await registry.start();
  });

  afterAll(() => {
    // TODO: if you comment this out, you can see the state of the verdaccio registry after the test completes.
    // TODO: for some reason, though, you have to disable all the other test modules using registry or jest will just exit.
    registry.stop();
  });

  beforeEach(async () => {
    repository = await repositoryFactory.cloneRepository();
    await registry.reset();

    // TODO: get rid of cast
    cliOptions = {
      path: repository.rootPath,
      publish: true,
      registry: registry.getUrl(),
      yes: true,
    } as CliOptions;

    packageFile = path.join(repository.rootPath, 'package.json');
  });

  // TODO: possible bug with "package version already exists" in registry check
  // TODO: add tests for cli validation?
  // TODO: should cli validation be moved to validation.ts?
  // TODO: should publish return a result? may make some tests less brittle
  // TODO: scenarios:
  // * package doesn't exist in registry
  // * package version already exists in registry

  it('returns early when no change files are present', () => {
    const logSpy = jest.spyOn(console, 'log');

    publish(cliOptions);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenLastCalledWith('Nothing to bump, skipping publish!');

    logSpy.mockRestore();
  });

  it('returns early when changetype none files are present', () => {
    console.log(`Writing change files to ${repository.rootPath}`);

    const changeInfo: ChangeInfo = {
      type: 'none',
      comment: '',
      packageName: testPackageInfo.name,
      email: '',
      commit: '',
      date: new Date(),
    };

    writeChangeFiles({ [testPackageInfo.name]: changeInfo }, repository.rootPath);

    const logSpy = jest.spyOn(console, 'log');

    publish(cliOptions);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenLastCalledWith('Nothing to bump, skipping publish!');

    logSpy.mockRestore();
  });

  it('returns early when changetype none files are present', () => {
    console.log(`Writing change files to ${repository.rootPath}`);

    const changeInfo: ChangeInfo = {
      type: 'major',
      comment: '',
      packageName: testPackageInfo.name,
      email: '',
      commit: '',
      date: new Date(),
    };

    writeChangeFiles({ [testPackageInfo.name]: changeInfo }, repository.rootPath);

    fs.writeFileSync(packageFile, testPackageJson, 'utf8');

    const logSpy = jest.spyOn(console, 'log');

    // bump uses CliOptions.path as cwd but it seems publish does not?
    // packageJsonPath has no path, just 'package.json'
    // is publish incorrectly assuming that its cwd is "path"?
    // it seems inconsistent that publish would use path as cwd for bump but not for publish
    publish(cliOptions);

    // TODO: this is publishing beachball! and creating local branches!
    expect(false).toBeTruthy();

    logSpy.mockRestore();
  });
});
