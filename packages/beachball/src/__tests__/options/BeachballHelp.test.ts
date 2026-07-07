import { describe, expect, it } from '@jest/globals';
import { _formatItem, _defaultHelpWidth, _maxTermWidth, BeachballHelp } from '../../options/BeachballHelp';
import { Command } from 'commander';
import { BeachballOption } from '../../options/BeachballOption';

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
  /** get a command with BeachballHelp */
  function getCommand(helpOption = false) {
    const command = new Command('test').helpOption(helpOption).description('some description');
    command.createHelp = () => new BeachballHelp();
    return command;
  }

  function getOptionsHelp(command: Command) {
    return command.helpInformation().split('Options:\n')[1].trimEnd();
  }

  it('adds --[no-] prefix for boolean BeachballOptions', () => {
    const opt = new BeachballOption({ name: 'fetch', type: 'boolean', desc: 'some bool', defaultValue: undefined });
    const command = getCommand().addOption(opt);
    expect(getOptionsHelp(command)).toMatchInlineSnapshot(`"  --[no-]fetch  some bool"`);
  });

  it('caps term width for long options', () => {
    const command = getCommand()
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
    const command = getCommand().option('--foo', 'some option');
    command.command('bar').description('some subcommand');
    const help = command.helpInformation();
    // BeachballHelp flips the order of commands and options
    expect(help.indexOf('Commands:')).toBeLessThan(help.indexOf('Options:'));
  });

  it('shows parent options in a subcommand help', () => {
    const command = getCommand(true).option('--parent-opt', 'a parent option');
    const sub = command.command('sub').description('a subcommand').option('--sub-opt', 'a sub option');
    sub.createHelp = () => new BeachballHelp();
    // The subcommand's own option, the parent option, and help (last) are all shown
    expect(getOptionsHelp(sub)).toMatchInlineSnapshot(`
      "  --sub-opt     a sub option
        --parent-opt  a parent option
        -h, --help    display help for command"
    `);
    // The parent option is not actually added to the subcommand
    expect(sub.options.map(opt => opt.long)).toEqual(['--sub-opt']);
  });

  it('formats help', () => {
    // The realistic case for this as of writing is "--prerelease-prefix <value>"
    const trickyOption = '--' + 'a'.repeat(_maxTermWidth - 1);
    expect(trickyOption).toHaveLength(_maxTermWidth + 1);
    const command = getCommand(true)
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
        -V, --version               output the version number
        --aaaaaaaaaaaaaaaaaaaaaaaaa exact term length before adding "-" separator
        --bar                       some option
                                      with a line break
        --some-very-long-long-long-option - with a description with a description with a description with
                                      a description
        -h, --help                  display help for command
      "
    `);
    expectMaxWidth(help);
  });
});
