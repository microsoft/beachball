/// <reference types="node" />

export = Config;

declare class Config<Definitions extends Config.DefinitionsObject = Config.DefinitionsObject> {
    /**
     * The prefix for `global` operations.  Set by the `prefix` config value,
     * or defaults based on the location of the `execPath` option.
     */
    globalPrefix: string;
    /**
     * The prefix for `local` operations.  Set by the `prefix` config value on
     * the CLI only, or defaults to either the `cwd` or its nearest ancestor
     * containing a `node_modules` folder or `package.json` file.
     */
    localPrefix: string;
    /**
     * A read-only `Map` of the file (or a comment, if no file found, or
     * relevant) to the config level loaded from that source.
     */
    sources: Map<string, Config.ConfType>;
    /**
     * A `Map` of config level to `ConfigData` objects.  These objects should
     * not be modified directly under any circumstances.
     */
    data: Map<Config.ConfType, Config.ConfigData>;

    /**
     * A list sorted in priority of all the config data objects in the
     * prototype chain.  `config.list[0]` is the `cli` level, `config.list[1]`
     * is the `env` level, and so on.
     */
    get list(): Config.ConfigData[];
    /** The `cwd` param */
    cwd: string;
    /** The `env` param */
    env: NodeJS.ProcessEnv;
    /** The `execPath` param */
    execPath: string;
    /** The `platform` param */
    platform: NodeJS.Platform;

    /** Default values of each definition */
    defaults: { [K in keyof Definitions]: Definitions[K]["type"] };
    /** The `types` param */
    types: { [K in keyof Definitions]: Definitions[K]["type"] };
    /** The `npmPath` param */
    npmPath: string;
    /** If `config.get('global')` is true, then `globalPrefix`, otherwise `localPrefix` */
    readonly prefix: string;
    /** The user's home directory, found by looking at `env.HOME` or calling `os.homedir()`. */
    home: string | null;
    /** A boolean indicating whether or not configs are loaded */
    readonly loaded: boolean;
    /**
     * A getter that returns `true` if all the config objects are valid. Any
     * data objects that have been modified with `config.set(...)` will be
     * re-evaluated when `config.valid` is read.
     */
    readonly valid: boolean;

    /**
     * Returns a `config` object, which is not yet loaded.
     */
    constructor(options: Config.Options<Definitions>);

    /**
     * Load configuration from the various sources of information.
     *
     * Returns a `Promise` that resolves when configuration is loaded, and fails
     * if a fatal error is encountered.
     */
    load(): Promise<void>;

    /**
     * Load the given key from the config stack.
     */
    get<K extends keyof Definitions>(key: K, where: Config.ConfType): Config.ConfigValueType<Definitions[K]["type"]>;
    /**
     * Verify that all known configuration options are set to valid values, and
     * log a warning if they are invalid.
     *
     * Invalid auth options will cause this method to throw an error with a `code`
     * property of `ERR_INVALID_AUTH`, and a `problems` property listing the specific
     * concerns with the current configuration.
     *
     * If `where` is not set, then all config objects are validated.
     *
     * Returns `true` if all configs are valid.
     *
     * Note that it's usually enough (and more efficient) to just check
     * `config.valid`, since each data object is marked for re-evaluation on every
     * `config.set()` operation.
     */
    validate(where?: Config.ConfType): boolean;
    /**
     * Returns `true` if the value is coming directly from the
     * default definitions, if the current value for the key config is
     * coming from any other source, returns `false`.
     */
    isDefault(key: keyof Definitions): boolean;

    getCredentialsByURI (uri: string): Config.Credentials;
}

declare namespace Config {
    interface DefinitionsObject {
        [key: string]: Definition;
    }

    interface TypeInfo<Type> {
        type: Type;
        description: string;
    }
    interface TypeDefs {
        String: TypeInfo<StringConstructor>;
        Boolean: TypeInfo<BooleanConstructor>;
        url: TypeInfo<typeof import("url")>;
        Number: TypeInfo<NumberConstructor>;
        path: TypeInfo<typeof import("path")>;
    }
    interface Definition {
        type: object | Array<object | string | null>;
        default?: any;
    }
    type ConfigValueType<Def extends Definition["type"]> = Def extends string ? Def
        : Def extends ReadonlyArray<infer T>
            ? ArrayConstructor extends T ? _ConfigValueType<Exclude<T, ArrayConstructor>>
            : _ConfigValueType<T>
        : _ConfigValueType<Def>;
    type _ConfigValueType<Def> = Def extends string | number | null ? Def
        : Def extends StringConstructor | typeof import("url") | typeof import("path")
            ? string
        : Def extends BooleanConstructor ? boolean
        : Def extends NumberConstructor ? number
        : Def extends ArrayConstructor ? unknown[]
        : unknown;

    interface Options {
        npmPath: string;

        /** PATCH: Root of the whole project (location of lock file and root `package.json`) */
        projectRoot: string;
        /** PATCH: Root of the current workspace/package (may be same as `projectRoot`) */
        workspaceRoot: string;

        cwd?: string;
        env?: NodeJS.ProcessEnv;
        execPath?: string;
        platform?: NodeJS.Platform;
    }

    type ConfFileType = "project" | "user" | "global";
    type ConfType = "default" | "env" | "builtin" | ConfFileType;
    interface ConfigData {
        /** The source where this data was loaded from. */
        source: string | null;
        /** The raw data used to generate this config data, as it was parsed initially from the environment, config file, or CLI options. */
        raw: Record<string, any>;
        /** The data object reflecting the inheritance of configs up to this point in the chain. */
        readonly data: Record<string, any>;
        readonly valid: boolean;
        /** Any errors encountered that prevented the loading of this config data. */
        loadError: Error | null;
    }

    type Problem =
        | { action: "delete"; key: string; where: ConfType }
        | { action: "rename"; from: string; to: string; where: ConfType };

    type BaseCredentials = { certfile?: string; keyfile?: string; };
    type TokenCredentials = BaseCredentials & { token: string; };
    type AuthCredentials = BaseCredentials & { username: string; password: string; auth: string };
    type Credentials = TokenCredentials | AuthCredentials | BaseCredentials;
}
