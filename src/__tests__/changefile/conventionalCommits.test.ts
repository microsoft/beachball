import { parseConventionalCommit } from '../../changefile/conventionalCommits';

describe.each<[string, ReturnType<typeof parseConventionalCommit>]>([
  ['fix: change message\nbody', { type: 'patch', message: 'change message' }],
  ['chore: change', { type: 'patch', message: 'change' }],
  ['feat: change', { type: 'minor', message: 'change' }],
  ['feat(scope): change', { type: 'minor', message: 'change' }],
  ['feat!: change', { type: 'major', message: 'change' }],
  ['feat(scope)!: change', { type: 'major', message: 'change' }],
  ['foo', undefined],
])('parse(%s)', (s, expected) => {
  test('should parse correctly', () => expect(parseConventionalCommit(s)).toEqual(expected));
});
