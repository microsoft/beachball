import { Command, Option, InvalidArgumentError, Help } from 'commander';
import { resolveRemoteAndBranch } from 'workspace-tools';
import type { CliOptions } from '../types/BeachballOptions';
import { cacheRemoteBranch } from '../git/getRemoteBranch';
import { getDefaultOptions } from './getDefaultOptions';
import type { OptionDefinition, OptionType } from './cliOptionDefinitions';
import { env } from '../env';

declare module 'commander' {
  interface Option {
    /** Check if the argument matches this option. (missing from public types) */
    is(arg: string): boolean;
  }
}

/** Value placeholder shown after each option flag, by option type. */
const valueSyntax: Record<OptionType, string> = {
  string: '<value>',
  number: '<value>',
  boolean: '',
  array: '<value...>',
};

/**
 * Custom Commander `Option` that matches camelCase spellings of its dashed flag and has special
 * handling of other behaviors from `OptionDefinition`.
 */
export class BeachballOption extends Option {
  public readonly type: OptionType;

  constructor(
    params: OptionDefinition & {
      /**
       * Canonical camelCase option name (a key of `CliOptions`).
       * If `OptionDefinition.alias` is set, the main option's help will be hidden.
       */
      name: keyof CliOptions;
      /** If true, build the negated `--no-` form of a boolean option. */
      negated?: boolean;
      /**
       * True if this option represents the alias for `name`.
       * It will still be stored under the canonical `name`, but the alias will be shown in help.
       */
      isAlias?: boolean;
      /**
       * If non-null/undefined/`''`, show this default value in help text, but DON'T set it as the default
       * to avoid messing up order of precedence with the config file (CLI > config file > default).
       */
      defaultValue: unknown;
    }
  ) {
    const { name, alias, isAlias, type = 'string', negated, defaultValue } = params;
    const showOptionName = (isAlias && alias) || name;
    const dashed = _toDashed(showOptionName);
    const suffix = valueSyntax[type] ? ` ${valueSyntax[type]}` : '';
    // For commands with an alias, only add the short option to the alias variant to avoid conflicts
    const shortPrefix = params.short && !negated && (!alias || isAlias) ? `-${params.short}, ` : '';
    const canonicalLong = negated ? `--no-${dashed}` : `--${dashed}${suffix}`;
    // Show the default value (if any) at the end of the help text, but don't set it as commander's
    // actual default to preserve precedence (CLI > config file > default).
    const defaultSuffix =
      !negated && !params.desc.includes('(default:') && !([null, undefined, ''] as unknown[]).includes(defaultValue)
        ? ` (default: ${JSON.stringify(defaultValue)})`
        : '';
    super(`${shortPrefix}${canonicalLong}`, negated ? undefined : `${params.desc}${defaultSuffix}`);
    this.type = type;

    if (alias) {
      if (isAlias) {
        // For the alias variant of an option, use the actual CliOptions key in the result
        this.attributeName = () => name;
      } else {
        // Hide help for the literal variant of an option with an alias
        this.hideHelp();
      }
    }

    if (negated) {
      this.hideHelp();
    } else if (type === 'number') {
      this.argParser(_parseNumber);
    } else {
      params.choices && this.choices(params.choices);
    }
  }

  override is(arg: string): boolean {
    // Exact short/long match
    if (super.is(arg)) {
      return true;
    }
    // Only extend matching for long flags; short flags are matched exactly above.
    if (!arg.startsWith('--')) {
      return false;
    }
    const argName = _normalizeFlagName(arg);
    // Match the option's own long flag in either dashed or camelCase spelling.
    return this.long ? _normalizeFlagName(this.long) === argName : false;
  }
}

class BeachballHelp extends Help {
  constructor() {
    super();
    if (env.isJest) {
      this.helpWidth = 100;
    }
  }

  /** Add `--[no-]` prefix for boolean options in help text. */
  override optionTerm(option: Option): string {
    const term = super.optionTerm(option);
    return option instanceof BeachballOption && option.type === 'boolean' ? term.replace('--', '--[no-]') : term;
  }
}

export class BeachballCommand extends Command {
  override createCommand(name?: string): BeachballCommand {
    return new BeachballCommand(name);
  }
  /** Not supported--use `addAllOptions` instead. */
  override option(): never {
    throw new Error('not supported by BeachballCommand');
  }
  /** Not supported--use `addAllOptions` instead. */
  override createOption(flags: string, description?: string): Option {
    if (/--(help|version)$/.test(flags)) return super.createOption(flags, description);
    throw new Error('not supported by BeachballCommand');
  }
  /** Not supported--use `addAllOptions` instead. */
  override addOption(): never {
    throw new Error('not supported by BeachballCommand');
  }

  override createHelp(): Help {
    return new BeachballHelp();
  }

  /**
   * Add every option in `optionDefinitions` to the given command, automatically handling aliases and
   * negated `--no-` boolean options.
   */
  public addAllOptions(optionDefinitions: Partial<Record<keyof CliOptions, OptionDefinition>>): this {
    const defaultOptions = getDefaultOptions();

    for (const [name, def] of Object.entries(optionDefinitions) as [keyof CliOptions, OptionDefinition][]) {
      const mainParams = { name, ...def, defaultValue: defaultOptions[name] };
      super.addOption(new BeachballOption(mainParams));
      def.alias && super.addOption(new BeachballOption({ ...mainParams, isAlias: true }));
      if (def.type === 'boolean') {
        super.addOption(new BeachballOption({ ...mainParams, negated: true }));
        def.alias && super.addOption(new BeachballOption({ ...mainParams, isAlias: true, negated: true }));
      }
    }

    return this;
  }
}

/** Convert a camelCase option name to its dashed CLI flag form (e.g. `gitTags` => `git-tags`). */
export function _toDashed(name: string): string {
  return name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/** Coerce a value to a number, throwing `InvalidArgumentError` if it's not numeric. */
export function _parseNumber(value: string): number {
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new InvalidArgumentError('Expected numeric value.');
  }
  return num;
}

/**
 * Normalize a flag to a canonical camelCase key for comparison, so dashed and camelCase spellings
 * of the same option match (e.g. `--git-tags` and `--gitTags` => `gitTags`; `--no-git-tags` and
 * `--no-gitTags` => `noGitTags`). Leading dashes are stripped before normalizing.
 */
export function _normalizeFlagName(flag: string): string {
  return flag
    .replace(/^--?/, '')
    .split('-')
    .reduce((acc, word, i) => (i === 0 ? word : acc + (word ? word[0].toUpperCase() + word.slice(1) : '')), '');
}

/**
 * Resolves `rawOptions.branch` if provided to ensure it includes the remote name.
 * If no branch is provided, returns the default branch.
 */
export function resolveBranchOption(rawOptions: Partial<Pick<CliOptions, 'branch' | 'verbose'>>, cwd: string): string {
  const branchResult = resolveRemoteAndBranch({
    branch: rawOptions.branch,
    cwd,
    verbose: rawOptions.verbose,
    strict: true,
  });
  cacheRemoteBranch(branchResult, cwd);

  return `${branchResult.remote}/${branchResult.remoteBranch}`;
}
