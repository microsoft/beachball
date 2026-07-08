import { describe, expect, it } from '@jest/globals';
import { _formatItem, _defaultHelpWidth, _maxTermWidth, BeachballHelp } from '../../options/BeachballHelp';
import { Command } from 'commander';
import { BeachballOption, type BeachballOptionParams } from '../../options/BeachballOption';

/** Verify no lines exceed the maximum help width */
function expectMaxWidth(str: string) {
  const tooLongLines = str.split('\n').filter(line => line.length > _defaultHelpWidth);
  expect(tooLongLines).toEqual([]);
}

describe('_formatItem', () => {
  function callFormatItem(term: string, description: string) {
    return _formatItem({
      term,
      termWidth: _maxTermWidth,
      helpWidth: _defaultHelpWidth,
      description,
    });
  }

  it('handles description not needing wrapping', () => {
    const str = callFormatItem('--foo <value>', 'some description');
    expect(str).toMatchInlineSnapshot(`"  --foo <value>               some description"`);
    // These tests have explicit assertions in addition to snapshots to prevent accidents
    expectMaxWidth(str);
    expect(str.indexOf('some')).toBe(_maxTermWidth + 4); // indent + spacer
  });

  it('handles description needing wrapping', () => {
    const str = callFormatItem('--foo <value>', 'long '.repeat(20));
    // add a newline so the wrapping is visually correct in the snapshot
    expect('\n' + str).toMatchInlineSnapshot(`
      "
        --foo <value>               long long long long long long long long long long long long long long
                                      long long long long long long"
    `);
    expectMaxWidth(str);
  });

  it('handles term longer than maxTermWidth', () => {
    const str = callFormatItem('--some-long-option-name <value>', 'some description');
    expect(str).toMatchInlineSnapshot(`"  --some-long-option-name <value> - some description"`);
    expectMaxWidth(str);
  });

  it('handles term longer than maxTermWidth with wrapping', () => {
    const str = callFormatItem('--some-long-option-name <value>', 'long '.repeat(20));
    expect(str).toMatchInlineSnapshot(`
      "  --some-long-option-name <value> - long long long long long long long long long long long long long
                                      long long long long long long long"
    `);
    expectMaxWidth(str);
  });

  // The realistic case for this as of writing is "--prerelease-prefix <value>"
  it('handles term with length maxTermWidth+1', () => {
    const term = '--' + 'a'.repeat(_maxTermWidth - 1);
    expect(term).toHaveLength(_maxTermWidth + 1);
    const str = callFormatItem(term, 'some description');
    expect(str).toMatchInlineSnapshot(`"  --aaaaaaaaaaaaaaaaaaaaaaaaa some description"`);
    expect(str).not.toContain(' - '); // no separator added
  });

  it('handles term with extra formatting', () => {
    const str = callFormatItem(
      '--foo <value>',
      'some item and its description is very long and wraps to another line with formatting\n- extra\n\n  - formatting'
    );
    expect('\n' + str).toMatchInlineSnapshot(`
      "
        --foo <value>               some item and its description is very long and wraps to another line
                                      with formatting
                                      - extra

                                        - formatting"
    `);
    expectMaxWidth(str);
  });
});

// These tests are fairly basic since they avoid logic from BeachballOption/BeachballCommand
describe('BeachballHelp', () => {
  /** make a BeachballOption applied to all commands */
  function makeBeachballOption(
    params: Omit<BeachballOptionParams, 'commands' | 'group'> & Partial<BeachballOptionParams>
  ) {
    return new BeachballOption({ commands: () => true, group: 'primary', ...params });
  }

  /** Command that uses BeachballHelp and disables the `--help` option by default */
  class TestCommand extends Command {
    constructor(name = 'test') {
      super(name);
      this.helpOption(false);
    }
    createCommand(name?: string) {
      return new TestCommand(name);
    }
    createHelp() {
      return new BeachballHelp();
    }
    beachballOption(params: Omit<BeachballOptionParams, 'commands' | 'group'> & Partial<BeachballOptionParams>) {
      return this.addOption(new BeachballOption({ commands: () => true, group: 'primary', ...params }));
    }
  }

  function getOptionsHelp(command: Command) {
    return command.helpInformation().split('Options:\n')[1].trimEnd();
  }

  it('adds --[no-] prefix for boolean BeachballOptions', () => {
    const command = new TestCommand().beachballOption({ name: 'fetch', type: 'boolean', desc: 'some bool' });
    expect(getOptionsHelp(command).trim()).toBe('--[no-]fetch  some bool');
  });

  // this logic is in BeachballOption + BeachballHelp
  it('appends BeachballOption default to option description', () => {
    const command = new TestCommand()
      .beachballOption({ name: 'tag', desc: 'npm dist-tag', defaultValue: 'latest' })
      .beachballOption({ name: 'fetch', type: 'boolean', desc: 'fetch first', defaultValue: true })
      .beachballOption({ name: 'bump', type: 'boolean', desc: 'bump first', defaultValue: false })
      .beachballOption({ name: 'depth', type: 'number', desc: 'fetch depth', defaultValue: 0 });
    const help = getOptionsHelp(command);
    expect(help).toMatchInlineSnapshot(`
      "  --tag <value>  npm dist-tag (default: "latest")
        --[no-]fetch   fetch first (default: true)
        --[no-]bump    bump first (default: false)
        --depth <num>  fetch depth (default: 0)"
    `);
    expect(help.match(/default:/g)).toHaveLength(4);
  });

  it('does not use BeachballOption default if the description already has a default', () => {
    const opt = makeBeachballOption({ name: 'tag', desc: 'npm dist-tag (default: "latest")', defaultValue: 'other' });
    expect(opt.defaultValueDescription).toBe('"other"');
    const help = getOptionsHelp(new TestCommand().addOption(opt));
    expect(help).toContain('npm dist-tag (default: "latest")');
    expect(help).not.toContain('other');
  });

  // this logic is in BeachballOption + BeachballHelp
  it('does not include default for null/undefined/empty', () => {
    const command = new TestCommand()
      .beachballOption({ name: 'branch', desc: 'target branch' })
      .beachballOption({ name: 'scope', desc: 'scope pattern', defaultValue: null })
      .beachballOption({ name: 'configPath', desc: 'config path', defaultValue: '' });
    const help = getOptionsHelp(command);
    expect(help).not.toContain('default:');
  });

  /** uses a special description for "change" */
  const messageOption: BeachballOptionParams = {
    name: 'message',
    desc: cmd => (cmd === 'change' ? 'change description' : 'commit message'),
    commands: () => true,
    group: 'primary',
  };

  it('uses command-specific description for matching command', () => {
    const change = new TestCommand().beachballOption(messageOption).command('change');
    expect(getOptionsHelp(change)).toContain('change description');
  });

  it('uses command-specific description fallback for other command', () => {
    const publish = new TestCommand().beachballOption(messageOption).command('publish');
    expect(getOptionsHelp(publish)).toContain('commit message');
  });

  it('appends the default value to the command-specific description', () => {
    const change = new TestCommand().beachballOption({ ...messageOption, defaultValue: 'hello' }).command('change');
    expect(getOptionsHelp(change)).toContain('change description (default: "hello")');
  });

  it('caps term width for long options', () => {
    const command = new TestCommand()
      .option('--foo <value>', 'some value')
      .option('--some-very-long-long-long-option <value>', 'some long option');
    const help = getOptionsHelp(command);
    // the indent of tag's description is capped at _maxTermWidth
    expect(help).toMatchInlineSnapshot(`
      "  --foo <value>               some value
        --some-very-long-long-long-option <value> - some long option"
    `);
    expect(help.indexOf('some value')).toBe(_maxTermWidth + 4); // indent + spacer
  });

  it('puts commands before options', () => {
    const subcommand = new TestCommand().command('bar').description('some subcommand').option('--foo', 'some option');
    const help = subcommand.helpInformation();
    // BeachballHelp flips the order of commands and options
    expect(help.indexOf('Commands:')).toBeLessThan(help.match(/options:/i)?.index || -1);
  });

  it('shows appropriate options from parent on subcommand', () => {
    const publish = new TestCommand()
      .helpOption(true)
      .beachballOption({ name: 'tag', desc: 'npm dist-tag', group: 'common' })
      .beachballOption({ name: 'message', desc: 'commit message', commands: ['publish'] })
      .beachballOption({ name: 'scope', desc: 'scope pattern', commands: ['check'] })
      .option('--non-beachball-opt', 'a parent option')
      .command('publish')
      .helpOption(true);

    const help = getOptionsHelp(publish);
    expect(help).toContain('--tag'); // common => shown on any command
    expect(help).toContain('--message'); // only publish => shown on publish
    expect(help).not.toContain('--scope'); // only check => omitted on publish
    expect(help).toContain('--non-beachball-opt'); // not essential, but currently non-BeachballOptions always inherit
    expect(help).toMatchInlineSnapshot(`
      "  --message <value>    commit message
        --non-beachball-opt  a parent option

      Common options:
        --tag <value>        npm dist-tag
        -h, --help           display help for command"
    `);
  });

  it('formats help', () => {
    // The realistic case for this as of writing is "--prerelease-prefix <value>"
    const trickyOption = '--' + 'a'.repeat(_maxTermWidth - 1);
    expect(trickyOption).toHaveLength(_maxTermWidth + 1);
    const command = new TestCommand()
      .helpOption(true)
      .description('some description')
      .version('1.2.3')
      .option(trickyOption, 'exact term length before adding "-" separator')
      .option('--bar', 'some option\nwith a line break')
      .option('--some-very-long-long-long-option', 'with a description '.repeat(4));
    command.command('foo <arg>').description('long '.repeat(20));
    const help = command.helpInformation();
    expect(help).toMatchInlineSnapshot(`
      "Usage: test [options] [command]

      some description

      Commands:
        foo <arg>                   long long long long long long long long long long long long long long
                                      long long long long long long
        help [command]              display help for command

      Options:
        --aaaaaaaaaaaaaaaaaaaaaaaaa exact term length before adding "-" separator
        --bar                       some option
                                      with a line break
        --some-very-long-long-long-option - with a description with a description with a description with
                                      a description

      Common options:
        -V, --version               output the version number
        -h, --help                  display help for command
      "
    `);
    expectMaxWidth(help);
  });
});
