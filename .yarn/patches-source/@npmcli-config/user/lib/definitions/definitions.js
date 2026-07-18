/** @import Config from '../index.js' */

/**
 * Simplified version of definition.js
 * @implements {Config.Definition}
 */
class Definition {
  constructor (key, def) {
    this.key = key
    this.type = def.type
    this.default = def.default
  }
}

const {
  url: { type: url },
  path: { type: path },
} = require('../type-defs.js')

const definitions = {
  _auth: new Definition('_auth', {
    default: null,
    type: [null, String],
  }),
  global: new Definition('global', {
    default: false,
    type: Boolean,
  }),
  // the globalconfig has its default defined outside of this module
  globalconfig: new Definition('globalconfig', {
    type: path,
    default: '',
  }),
  location: new Definition('location', {
    default: 'user',
    type: [
      'global',
      'user',
      'project',
    ],
  }),
  // `prefix` has its default defined outside of this module
  prefix: new Definition('prefix', {
    type: path,
    default: '',
  }),
  registry: new Definition('registry', {
    default: 'https://registry.npmjs.org/',
    type: url,
  }),
  userconfig: new Definition('userconfig', {
    default: '~/.npmrc',
    type: path,
  }),
}

module.exports = definitions
