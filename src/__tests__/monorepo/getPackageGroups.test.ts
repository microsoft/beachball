import { mockLogs } from '../../fixtures/mockLogs';

describe('getPackageGroups', () => {
  let logs: ReturnType<typeof mockLogs>;

  beforeEach(() => {
    logs = mockLogs();
  });

  afterEach(() => {
    logs.restore();
  });

  it('returns an empty object if no groups are specified', () => {});
});
