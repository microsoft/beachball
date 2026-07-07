import { Help, type Command, type Option } from 'commander';
import { env } from '../env';
import { BeachballOption } from './BeachballOption';

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

export class BeachballHelp extends Help {
  constructor() {
    super();
    if (env.isJest) {
      this.helpWidth = _defaultHelpWidth;
    }
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
    if (cmd.commands.length) {
      return `${cmd.name()} ${cmd.usage()}`;
    }
    return super.subcommandTerm(cmd);
  }

  /**
   * Include the parent command's options in each subcommand's help. (To match old behavior, all
   * options are allowed on all commands, but we only add them to the parent command to avoid
   * extra overhead of parsing them on every subcommand.)
   */
  override visibleOptions(cmd: Command): Option[] {
    const options = super.visibleOptions(cmd);
    if (!cmd.parent) {
      return options;
    }

    // Collect visible options declared on ancestor commands
    const globalOptions: Option[] = [];
    for (let ancestor: Command | null = cmd.parent; ancestor; ancestor = ancestor.parent) {
      globalOptions.push(
        ...super.visibleOptions(ancestor).filter(opt => !['help', 'version'].includes(opt.attributeName()))
      );
    }

    // Insert before the trailing built-in help option so it stays last.
    options.splice(Math.max(options.length - 1, 0), 0, ...globalOptions);
    return options;
  }

  /** Cap the term width so a few very long terms don't push all descriptions far to the right. */
  override padWidth(cmd: Command, helper: Help): number {
    return Math.min(super.padWidth(cmd, helper), _maxTermWidth);
  }

  /** Format a single term/description item. See {@link _formatItem} for details. */
  override formatItem(term: string, termWidth: number, description: string): string {
    return _formatItem({
      term,
      termWidth,
      helpWidth: this.helpWidth ?? _defaultHelpWidth,
      description,
    });
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
    const optionsIndex = sections.findIndex(section => section.startsWith('Options:'));
    const commandsIndex = sections.findIndex(section => section.startsWith('Commands:'));
    if (optionsIndex !== -1 && commandsIndex > optionsIndex) {
      const [commandsSection] = sections.splice(commandsIndex, 1);
      sections.splice(optionsIndex, 0, commandsSection);
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
