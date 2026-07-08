import { Command, Help, type Option } from 'commander';
import { env } from '../env';
import { BeachballOption } from './BeachballOption';
import { optionGroups } from './optionDefinitions';
import type { BeachballCommand } from './BeachballCommand';

/**
 * Indent width before each term, or spacer between terms and descriptions (matches commander).
 * Also used as continuation line indent.
 */
const indentWidth = 2;
/**
 * Maximum term width used for description alignment. Terms longer than this don't push the
 * description column further right; instead their description starts after a ` - ` separator.
 */
export const _maxTermWidth = 26;
/** Help width used in jest snapshots or if no width can be determined */
export const _defaultHelpWidth = 100;

/** help and version */
const isBuiltInOption = (option: Option) => ['help', 'version'].includes(option.name());

// don't use instanceof to avoid a circular file reference
const isBeachballCommand = (cmd: Command): cmd is BeachballCommand => cmd.constructor.name === 'BeachballCommand';

/**
 * Get the complete name for this subcommand, e.g. `config get` or `bump`.
 * Returns an empty string for the top-level command.
 */
export function getSubcommandName(cmd: Command): string {
  return cmd.parent ? (cmd.parent.parent ? `${cmd.parent.name()} ${cmd.name()}` : cmd.name()) : '';
}

export class BeachballHelp extends Help {
  /** full subcommand currently being described (e.g. `bump` or `config get`) */
  private _subcommandForOptionDescription: string | undefined;

  constructor() {
    super();
    if (env.isJest) {
      this.helpWidth = _defaultHelpWidth;
    }
  }

  override commandDescription(cmd: Command): string {
    // hack to save current command to use in determining option descriptions
    this._subcommandForOptionDescription = getSubcommandName(cmd);
    const description = super.commandDescription(cmd);

    if (!cmd.parent && cmd.name() === 'beachball') {
      return 'See https://microsoft.github.io/beachball/ for more documentation.';
    }

    return (
      (!description || description.endsWith('.') ? description : `${description}.`) +
      '\n\nMost options can also be specified in the beachball config ' +
      '(command line options override the config). ' +
      'See https://microsoft.github.io/beachball/overview/configuration for more info.'
    ).trim();
  }

  override optionDescription(option: Option): string {
    if (!(option instanceof BeachballOption)) {
      return super.optionDescription(option);
    }
    // For options with command-specific descriptions, update as a side effect
    // (super.optionDescription() reads option.description)
    option.description = option.getDescriptionForCommand(this._subcommandForOptionDescription);

    // For BeachballOption, default values are only included in the description, not set as
    // actual defaults, so we have to manually add the default description.
    const description = super.optionDescription(option);
    if (option.defaultValueDescription && !option.description.includes('(default:')) {
      const defaultText = `default: ${option.defaultValueDescription}`;
      return description.endsWith(')')
        ? `${description.slice(0, -1)}, ${defaultText})`
        : `${description} (${defaultText})`;
    }
    return description;
  }

  /**
   * Get the option term (flags) to show in the option list, with added `--[no-]` prefix for booleans.
   * (NOTE: This assumes the logic in `BeachballCommand`/`BeachballOption` which adds both positive
   * and negated variants and hides the negated one from help.)
   */
  override optionTerm(option: Option): string {
    const term = super.optionTerm(option);
    return option instanceof BeachballOption && option.isBoolean() ? term.replace('--', '--[no-]') : term;
  }

  /** Use the custom usage string for commands with subcommands */
  override subcommandTerm(cmd: Command): string {
    return cmd.commands.length ? `${cmd.name()} ${cmd.usage()}` : super.subcommandTerm(cmd);
  }

  /**
   * Include the top-level command's options in each subcommand's help, excluding options that
   * are only shown for certain subcommands not including the current one.
   *
   * For the top-level command, if it has subcommands, only show "common" options and built-ins.
   *
   * (To match old behavior, all options are allowed on all commands, but we only add them to the
   * parent command to avoid extra overhead of parsing them on every subcommand.)
   */
  override visibleOptions(cmd: Command): Option[] {
    const options = super.visibleOptions(cmd);
    if (!cmd.parent) {
      // For the actual top-level beachball command, omit extra options, but allow them for tests
      // (cmd will be a BeachballCommand in real cases, but maybe not for tests)
      return cmd.commands.length && isBeachballCommand(cmd)
        ? options.filter(
            opt => isBuiltInOption(opt) || (opt instanceof BeachballOption && opt.appliesToCommand(undefined))
          )
        : options;
    }

    // Collect visible options declared on the top-level command
    const subcommandName = getSubcommandName(cmd);
    const globalOptions = super.visibleOptions(cmd.parent?.parent || cmd.parent).filter(opt => {
      // Don't duplicate built-in options with inherited ones
      if (isBuiltInOption(opt)) return false;
      // Only show inherited options that are always applicable or specified for this command
      return !(opt instanceof BeachballOption) || opt.appliesToCommand(subcommandName);
    });

    // As of writing, subcommands only have the built-in help option, which goes last
    return [...globalOptions, ...options];
  }

  /** Group options/commands for help, with option group ordering respecting `optionGroups`. */
  override groupItems<T extends Command | Option>(
    unsortedItems: T[],
    visibleItems: T[],
    getGroup: (item: T) => string
  ): Map<string, T[]> {
    if ((unsortedItems[0] || visibleItems[0]) instanceof Command) {
      return super.groupItems(unsortedItems, visibleItems, getGroup);
    }

    const groups = super.groupItems(unsortedItems, visibleItems, item =>
      isBuiltInOption(item as Option)
        ? optionGroups.common
        : item instanceof BeachballOption
          ? item.getHelpGroupHeading(this._subcommandForOptionDescription)
          : getGroup(item)
    );

    // Sort the groups: anything not listed goes first, followed by groups in the listed order.
    const expectedGroups = Object.values(optionGroups);
    const unlistedGroups = [...groups.keys()].filter(g => !expectedGroups.includes(g));
    const groupOrder = [...unlistedGroups, ...expectedGroups];

    const sortedGroups = new Map<string, T[]>();
    for (const groupName of groupOrder) {
      const group = groups.get(groupName);
      group && sortedGroups.set(groupName, group);
    }
    return sortedGroups;
  }

  /** Cap the term width so a few very long terms don't push all descriptions far to the right. */
  override padWidth(cmd: Command, helper: Help): number {
    return Math.min(super.padWidth(cmd, helper), _maxTermWidth);
  }

  /** Format a single term/description item. See {@link _formatItem} for details. */
  override formatItem(term: string, termWidth: number, description: string): string {
    const helpWidth = this.helpWidth ?? _defaultHelpWidth;
    return _formatItem({ term, termWidth, helpWidth, description });
  }

  /**
   * Render the help text, moving the "Commands:" section before the "Options:" section for commands
   * that have sub-commands (so the more relevant commands list is shown first).
   */
  override formatHelp(cmd: Command, helper: Help): string {
    const help = super.formatHelp(cmd, helper);
    if (!helper.visibleCommands(cmd).length) {
      return help;
    }

    // Sections are separated by a blank line and each starts with a title line ("Options:",
    // "Commands:", etc). Move the "Commands:" section to just before the "Options:" section.
    const trailingNewlines = help.match(/\n+$/);
    const sections = help.replace(/\n+$/, '').split('\n\n');
    const firstOptionsIndex = sections.findIndex(section => /^.*?options.*?:\n/i.test(section));
    const commandsIndex = sections.findIndex(section => section.startsWith('Commands:'));
    if (firstOptionsIndex !== -1 && commandsIndex > firstOptionsIndex) {
      const [commandsSection] = sections.splice(commandsIndex, 1);
      sections.splice(firstOptionsIndex, 0, commandsSection);
    }
    return sections.join('\n\n') + (trailingNewlines?.[0] || '');
  }
}

/**
 * Format a single term/description item. Differences from commander's default:
 * - Ignores the possibility of color codes in the term, not enough room to wrap (we cap `termWidth`),
 *   or a preformatted/indented description (we indent anyway).
 * - Wrapped description continuation lines get an extra hanging indent.
 * - Terms wider than the (capped) `termWidth` keep their description on the same line but
 *   separated by ` - ` (instead of pushing the aligned description column further right).
 */
export function _formatItem(params: {
  /** Command name or option flags and value placeholders, e.g. `--foo <value>` */
  term: string;
  /** Max width for any term, without indent or spacer (`BeachballHelp` caps at `_maxTermWidth`) */
  termWidth: number;
  helpWidth: number;
  description: string;
}): string {
  const { term, termWidth, helpWidth, description } = params;
  const indentStr = ' '.repeat(indentWidth);
  if (!description) {
    return indentStr + term;
  }

  // Build the indent+term+spacer. Allow 1char overflow into the spacer, or if longer, add a separator.
  let paddedTerm = indentStr + term.padEnd(termWidth + indentWidth);
  if (term.length > termWidth + 1) {
    paddedTerm += ' - ';
  }

  // Column where continuation lines start (indent + termWidth + spacer + hanging)
  const continuationCol = indentWidth * 3 + termWidth;

  // Wrap and format the description (skipping commander's preformatted check, and its too-narrow
  // check, since we cap termWidth).
  // For the first line, prefix with the term. After that, prefix with continuation indent.
  let prefix = paddedTerm;
  const lines: string[] = [];
  const addLine = (line: string) => {
    lines.push((prefix + line).trimEnd());
    prefix = ' '.repeat(continuationCol);
  };

  for (const rawLine of description.split(/\r?\n/)) {
    // a chunk is 0+ whitespace followed by non-whitespace (or the original line)
    const chunks = rawLine.match(/\s*\S+/g) || [rawLine];
    let current = chunks.shift() || '';
    for (const chunk of chunks) {
      const limit = helpWidth - prefix.length;
      if (current.length + chunk.length <= limit) {
        current += chunk;
      } else {
        addLine(current);
        current = chunk.trimStart();
      }
    }
    addLine(current);
  }
  return lines.join('\n');
}
