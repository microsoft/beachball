import { Help, type Command, type Option } from 'commander';
import { env } from '../env';
import { BeachballOption } from './BeachballOption';

/**
 * Maximum term width used for description alignment. Terms longer than this don't push the
 * description column further right; instead their description starts after a ` - ` separator.
 */
const maxTermWidth = 26;
const defaultHelpWidth = 100;

export class BeachballHelp extends Help {
  constructor() {
    super();
    if (env.isJest) {
      this.helpWidth = defaultHelpWidth;
    }
  }

  /** Get the option term (flags) to show in the option list, with added `--[no-]` prefix for booleans. */
  override optionTerm(option: Option): string {
    const term = super.optionTerm(option);
    return option instanceof BeachballOption && option.isBoolean() ? term.replace('--', '--[no-]') : term;
  }

  /** Cap the term width so a few very long terms don't push all descriptions far to the right. */
  override padWidth(cmd: Command, helper: Help): number {
    return Math.min(super.padWidth(cmd, helper), maxTermWidth);
  }
  /**
   * Format a single term/description item, adding a hanging indent so that wrapped description
   * lines are indented slightly past the start of the description's first line.
   */
  override formatItem(term: string, termWidth: number, description: string, helper: Help): string {
    // Temporarily reduce the help width so wrapping accounts for the extra hanging indent added
    // to continuation lines below (otherwise those lines could exceed the help width).
    const hangingIndent = 2;
    const originalHelpWidth = this.helpWidth;
    this.helpWidth = (this.helpWidth ?? 80) - hangingIndent;
    const formatted = super.formatItem(term, termWidth, description, helper);
    this.helpWidth = originalHelpWidth;

    // Commander indents wrapped description lines to align with the description's first line
    // (itemIndent + termWidth + spacerWidth). Add extra spaces to those continuation lines.
    const itemIndent = 2;
    const spacerWidth = 2;
    const continuationIndent = ' '.repeat(itemIndent + termWidth + spacerWidth);
    return formatted.replaceAll(`\n${continuationIndent}`, `\n${continuationIndent}${' '.repeat(hangingIndent)}`);
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
    const trailingNewline = help.endsWith('\n');
    const sections = help.replace(/\n+$/, '').split('\n\n');
    const optionsIndex = sections.findIndex(section => section.startsWith('Options:'));
    const commandsIndex = sections.findIndex(section => section.startsWith('Commands:'));
    if (optionsIndex !== -1 && commandsIndex > optionsIndex) {
      const [commandsSection] = sections.splice(commandsIndex, 1);
      sections.splice(optionsIndex, 0, commandsSection);
    }
    return sections.join('\n\n') + (trailingNewline ? '\n' : '');
  }
}
