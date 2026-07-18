// TODO: set the scope config from package.json or explicit cli config
/** @import Config from './index.js' */
// @ts-ignore
const ini = require('ini')
const nopt = require('nopt')
// @ts-ignore
const { log } = require('proc-log')

const { resolve, dirname, join } = require('node:path')
const { homedir } = require('node:os')
const {
  readFile,
  stat,
} = require('node:fs/promises')

const fileExists = (...p) => stat(resolve(...p))
  .then((st) => st.isFile())
  .catch(() => false)

const hasOwnProperty = (obj, key) =>
  Object.prototype.hasOwnProperty.call(obj, key)

const typeDefs = require('./type-defs.js')
const nerfDart = require('./nerf-dart.js')
const envReplace = require('./env-replace.js')
const parseField = require('./parse-field.js')
// Provide these instead of passing through constructor
const { definitions } = require('./definitions/index.js')

/** types that can be saved back to @type {Set<Config.ConfFileType>} */
const confFileTypes = new Set([
  'global',
  'user',
  'project',
])

/** @type {Set<Config.ConfType>} */
const confTypes = new Set([
  'default',
  'builtin',
  ...confFileTypes,
  'env',
  // CLI logic removed
  // 'cli',
])
/** highest precedence config type (since `cli` logic was removed) */
const highestConfType = 'env'

class Config {
  #loaded = false
  #projectRoot = ''
  #workspaceRoot = ''

  constructor ({
    npmPath,
    projectRoot,
    workspaceRoot,

    // options just to override in tests, mostly
    env = process.env,
    platform = process.platform,
    execPath = process.execPath,
    cwd = process.cwd(),
  }) {
    if (!projectRoot || !workspaceRoot) {
      throw new Error('must provide projectRoot and workspaceRoot options')
    }

    this.#projectRoot = projectRoot
    this.#workspaceRoot = workspaceRoot

    // turn the definitions into nopt's weirdo syntax
    /** @type {Record<string, Object>} */
    const types = {}
    /** @type {Record<string, any>} */
    const defaults = {}
    for (const [key, def] of Object.entries(definitions)) {
      defaults[key] = def.default
      types[key] = def.type
    }

    this.types = types
    this.defaults = defaults

    this.npmPath = npmPath
    this.env = env
    this.execPath = execPath
    this.platform = platform
    this.cwd = cwd

    // set when we load configs
    this.globalPrefix = null
    this.localPrefix = null

    // defaults to env.HOME, but will always be *something*
    this.home = null

    // set up the prototype chain of config objects
    const wheres = [...confTypes]
    /** @type {Map<Config.ConfType, Config.ConfigData>} */
    this.data = new Map()
    let parent = null
    for (const where of wheres) {
      this.data.set(where, parent = new ConfigData(parent))
    }

    this.data.set = () => {
      throw new Error('cannot change internal config data structure')
    }
    this.data.delete = () => {
      throw new Error('cannot change internal config data structure')
    }

    this.sources = new Map([])

    for (const { data } of this.data.values()) {
      this.list.unshift(data)
    }

    this.#loaded = false
  }

  /** NOTE: this is a getter which will recompute each time it's accessed */
  get list () {
    const list = []
    for (const { data } of this.data.values()) {
      list.unshift(data)
    }
    return list
  }

  get loaded () {
    return this.#loaded
  }

  get prefix () {
    return this.#get('global') ? this.globalPrefix : this.localPrefix
  }

  /**
   * @param {Config.ConfType|null} [where] Get values from only this location if specified.
   * Otherwise checks up the prototype chain in order of precedence.
   */
  get (key, where) {
    if (!this.loaded) {
      throw new Error('call config.load() before reading values')
    }
    return this.#get(key, where)
  }

  // we need to get values sometimes, so use this internal one to do so
  // while in the process of loading.
  /**
   * @param {Config.ConfType|null} [where] Get values from only this location if specified.
   * Otherwise checks up the prototype chain in order of precedence.
   */
  #get (key, where = null) {
    if (where !== null && !confTypes.has(where)) {
      throw new Error('invalid config location param: ' + where)
    }
    const { data } = this.data.get(where || highestConfType)
    // this will return values up the prototype chain
    return where === null || hasOwnProperty(data, key) ? data[key] : undefined
  }

  async load () {
    if (this.loaded) {
      throw new Error('attempting to load npm config multiple times')
    }

    // first load the defaults, which sets the global prefix
    this.loadDefaults()

    // next load the builtin config, as this sets new effective defaults
    await this.loadBuiltinConfig()

    // cli and env are not async, and can set the prefix, relevant to project
    this.loadEnv()

    // next project config, which can affect userconfig location
    await this.loadProjectConfig()

    // then user config, which can affect globalconfig location
    await this.loadUserConfig()

    // last but not least, global config file
    await this.loadGlobalConfig()

    // set this before calling setEnvs, so that we don't have to share
    // private attributes, as that module also does a bunch of get operations
    this.#loaded = true

    // set proper globalPrefix now that everything is loaded
    this.globalPrefix = this.get('prefix')
  }

  loadDefaults () {
    this.loadGlobalPrefix()
    this.loadHome()

    const defaultsObject = {
      ...this.defaults,
      prefix: this.globalPrefix,
    }

    try {
      // This does not have an actual definition because this is not user definable
      defaultsObject['npm-version'] = require(join(this.npmPath, 'package.json')).version
    } catch {
      // in some weird state where the passed in npmPath does not have a package.json
      // this will never happen in npm, but is guarded here in case this is consumed
      // in other ways + tests
    }

    this.#loadObject(defaultsObject, 'default', 'default values')

    const { data } = this.data.get('default')

    // if the prefix is set on cli, env, or userconfig, then we need to
    // default the globalconfig file to that location, instead of the default
    // global prefix.  It's weird that `npm get globalconfig --prefix=/foo`
    // returns `/foo/etc/npmrc`, but better to not change it at this point.
    // define a custom getter, but turn into a normal prop
    // if we set it.  otherwise it can't be set on child objects
    Object.defineProperty(data, 'globalconfig', {
      get: () => resolve(this.#get('prefix'), 'etc/npmrc'),
      set (value) {
        Object.defineProperty(data, 'globalconfig', {
          value,
          configurable: true,
          writable: true,
          enumerable: true,
        })
      },
      configurable: true,
      enumerable: true,
    })
  }

  loadHome () {
    this.home = this.env.HOME || homedir()
  }

  loadGlobalPrefix () {
    if (this.globalPrefix) {
      throw new Error('cannot load default global prefix more than once')
    }

    if (this.env.PREFIX) {
      this.globalPrefix = this.env.PREFIX
    } else if (this.platform === 'win32') {
      // c:\node\node.exe --> prefix=c:\node\
      this.globalPrefix = dirname(this.execPath)
    } else {
      // /usr/local/bin/node --> prefix=/usr/local
      this.globalPrefix = dirname(dirname(this.execPath))

      // destdir only is respected on Unix
      if (this.env.DESTDIR) {
        this.globalPrefix = join(this.env.DESTDIR, this.globalPrefix)
      }
    }
  }

  loadEnv () {
    const conf = Object.create(null)
    for (const [envKey, envVal] of Object.entries(this.env)) {
      if (!/^npm_config_/i.test(envKey) || envVal === '') {
        continue
      }
      let key = envKey.slice('npm_config_'.length)
      if (!key.startsWith('//')) { // don't normalize nerf-darted keys
        key = key.replace(/(?!^)_/g, '-') // don't replace _ at the start of the key
          .toLowerCase()
      }
      conf[key] = envVal
    }
    this.#loadObject(conf, 'env', 'environment')
  }

  get valid () {
    for (const [where, { valid }] of this.data.entries()) {
      if (valid === false || valid === null && !this.validate(where)) {
        return false
      }
    }
    return true
  }

  /** @param {Config.ConfType} [where] */
  validate (where) {
    if (!where) {
      let valid = true
      const authProblems = []

      for (const entryWhere of this.data.keys()) {
        // no need to validate our defaults, we know they're fine
        // cli was already validated when parsed the first time
        if (entryWhere === 'default' || entryWhere === 'builtin') {
          continue
        }
        const ret = this.validate(entryWhere)
        valid = valid && ret

        if (['global', 'user', 'project'].includes(entryWhere)) {
          // after validating everything else, we look for old auth configs we no longer support
          // if these keys are found, we build up a list of them and the appropriate action and
          // attach it as context on the thrown error

          // first, keys that should be removed
          for (const key of ['_authtoken', '-authtoken']) {
            if (this.get(key, entryWhere)) {
              authProblems.push({ action: 'delete', key, where: entryWhere })
            }
          }

          // NOTE we pull registry without restricting to the current 'where' because we want to
          // suggest scoping things to the registry they would be applied to, which is the default
          // regardless of where it was defined
          const nerfedReg = nerfDart(this.get('registry'))
          // keys that should be nerfed but currently are not
          for (const key of ['_auth', '_authToken', 'username', '_password']) {
            if (this.get(key, entryWhere)) {
              // username and _password must both exist in the same file to be recognized correctly
              if (key === 'username' && !this.get('_password', entryWhere)) {
                authProblems.push({ action: 'delete', key, where: entryWhere })
              } else if (key === '_password' && !this.get('username', entryWhere)) {
                authProblems.push({ action: 'delete', key, where: entryWhere })
              } else {
                authProblems.push({
                  action: 'rename',
                  from: key,
                  to: `${nerfedReg}:${key}`,
                  where: entryWhere,
                })
              }
            }
          }
        }
      }

      if (authProblems.length) {
        const { ErrInvalidAuth } = require('./errors.js')
        throw new ErrInvalidAuth(authProblems)
      }

      return valid
    } else {
      const obj = this.data.get(where)
      obj[_valid] = true

      // @ts-ignore
      nopt.invalidHandler = (k, val, type) =>
        this.invalidHandler(k, val, type, obj.source, where)

      nopt.clean(obj.data, this.types, typeDefs)

      // @ts-ignore
      nopt.invalidHandler = null
      return obj[_valid]
    }
  }

  // Returns true if the value is coming directly from the source defined
  // in default definitions, if the current value for the key config is
  // coming from any other different source, returns false
  isDefault (key) {
    const [defaultType, ...types] = [...confTypes]
    const defaultData = this.data.get(defaultType).data

    return hasOwnProperty(defaultData, key)
      && types.every(type => {
        const typeData = this.data.get(type).data
        return !hasOwnProperty(typeData, key)
      })
  }

  invalidHandler (k, val, type, source, where) {
    log.warn(
      'invalid config',
      k + '=' + JSON.stringify(val),
      `set in ${source}`
    )
    this.data.get(where)[_valid] = false
    // removed logging of expected type
  }

  /**
   * @param {Config.ConfType} where
   * @param {string} source file name or source description
   */
  #loadObject (obj, where, source, er = null) {
    // obj is the raw data read from the file
    const conf = this.data.get(where)
    if (conf.source) {
      const m = `double-loading "${where}" configs from ${source}, ` +
        `previously loaded from ${conf.source}`
      throw new Error(m)
    }

    if (this.sources.has(source)) {
      const m = `double-loading config "${source}" as "${where}", ` +
        `previously loaded as "${this.sources.get(source)}"`
      throw new Error(m)
    }

    conf.source = source
    this.sources.set(source, where)
    if (er) {
      conf.loadError = er
      if (er.code !== 'ENOENT') {
        log.verbose('config', `error loading ${where} config`, er)
      }
    } else {
      conf.raw = obj
      for (const [key, value] of Object.entries(obj)) {
        const k = envReplace(key, this.env)
        const v = this.parseField(value, k)
        // removed deprecated, exclusive, unknown checks
        conf.data[k] = v
      }
    }
  }

  // Parse a field, coercing it to the best type available.
  parseField (f, key, listElement = false) {
    return parseField(f, key, this, listElement)
  }

  /**
   * @param {string} file
   * @param {Config.ConfType} type
   */
  async #loadFile (file, type) {
    // only catch the error from readFile, not from the loadObject call
    log.silly('config', `load:file:${file}`)
    await readFile(file, 'utf8').then(
      data => {
        const parsedConfig = ini.parse(data)
        if (type === 'project' && parsedConfig.prefix) {
          // Log error if prefix is mentioned in project .npmrc
          /* eslint-disable-next-line max-len */
          log.error('config', `prefix cannot be changed from project config: ${file}.`)
        }
        return this.#loadObject(parsedConfig, type, file)
      },
      er => this.#loadObject(null, type, file, er)
    )
  }

  loadBuiltinConfig () {
    return this.#loadFile(resolve(this.npmPath, 'npmrc'), 'builtin')
  }

  async loadProjectConfig () {
    // the localPrefix can be set by the CLI config, but otherwise is
    // found by walking up the folder tree. either way, we load it before
    // we return to make sure localPrefix is set
    await this.loadLocalPrefix()

    if (this.#get('global') === true || this.#get('location') === 'global') {
      this.data.get('project').source = '(global mode enabled, ignored)'
      this.sources.set(this.data.get('project').source, 'project')
      return
    }

    const projectFile = resolve(this.localPrefix, '.npmrc')
    // if we're in the ~ directory, and there happens to be a node_modules
    // folder (which is not TOO uncommon, it turns out), then we can end
    // up loading the "project" config where the "userconfig" will be,
    // which causes some calamities.  So, we only load project config if
    // it doesn't match what the userconfig will be.
    if (projectFile !== this.#get('userconfig')) {
      return this.#loadFile(projectFile, 'project')
    } else {
      this.data.get('project').source = '(same as "user" config, ignored)'
      this.sources.set(this.data.get('project').source, 'project')
    }
  }

  // RE-WRITTEN to use passed in projectRoot and workspaceRoot
  async loadLocalPrefix () {
    const isGlobal = this.#get('global') || this.#get('location') === 'global'

    if (isGlobal) {
      // in global mode, use the nearest package.json
      this.localPrefix = this.#workspaceRoot
    } else {
      // see if there's a .npmrc file in the workspace, if so log a warning
      if (this.#projectRoot !== this.#workspaceRoot && await fileExists(this.#workspaceRoot, '.npmrc')) {
        log.warn('config', `ignoring workspace config at ${this.#workspaceRoot}/.npmrc`)
      }
      // use the project root
      this.localPrefix = this.#projectRoot
    }
  }

  loadUserConfig () {
    return this.#loadFile(this.#get('userconfig'), 'user')
  }

  loadGlobalConfig () {
    return this.#loadFile(this.#get('globalconfig'), 'global')
  }

  // this has to be a bit more complicated to support legacy data of all forms
  getCredentialsByURI (uri) {
    const nerfed = nerfDart(uri)
    const creds = {}

    const certfileReg = this.get(`${nerfed}:certfile`)
    const keyfileReg = this.get(`${nerfed}:keyfile`)
    if (certfileReg && keyfileReg) {
      creds.certfile = certfileReg
      creds.keyfile = keyfileReg
      // cert/key may be used in conjunction with other credentials, thus no `return`
    }

    const tokenReg = this.get(`${nerfed}:_authToken`)
    if (tokenReg) {
      creds.token = tokenReg
      return creds
    }

    const userReg = this.get(`${nerfed}:username`)
    const passReg = this.get(`${nerfed}:_password`)
    if (userReg && passReg) {
      creds.username = userReg
      creds.password = Buffer.from(passReg, 'base64').toString('utf8')
      const auth = `${creds.username}:${creds.password}`
      creds.auth = Buffer.from(auth, 'utf8').toString('base64')
      return creds
    }

    const authReg = this.get(`${nerfed}:_auth`)
    if (authReg) {
      const authDecode = Buffer.from(authReg, 'base64').toString('utf8')
      const authSplit = authDecode.split(':')
      creds.username = authSplit.shift()
      creds.password = authSplit.join(':')
      creds.auth = authReg
      return creds
    }

    // at this point, nothing else is usable so just return what we do have
    return creds
  }
}

const _loadError = Symbol('loadError')
const _valid = Symbol('valid')

/** @implements {Config.ConfigData} */
class ConfigData {
  #data
  /** @type {string|null} */
  #source = null
  #raw = {}
  constructor (parent) {
    // NOTE: prototype inheritance of parent data
    this.#data = Object.create(parent && parent.data)
    this[_valid] = true
  }

  get data () {
    return this.#data
  }

  get valid () {
    return this[_valid]
  }

  set source (s) {
    if (this.#source) {
      throw new Error('cannot set ConfigData source more than once')
    }
    this.#source = s
  }

  get source () {
    return this.#source
  }

  set loadError (e) {
    if (this[_loadError] || (Object.keys(this.#raw).length)) {
      throw new Error('cannot set ConfigData loadError after load')
    }
    this[_loadError] = e
  }

  get loadError () {
    return this[_loadError]
  }

  set raw (r) {
    if (Object.keys(this.#raw).length || this[_loadError]) {
      throw new Error('cannot set ConfigData raw after load')
    }
    this.#raw = r
  }

  get raw () {
    return this.#raw
  }
}

module.exports = Config
