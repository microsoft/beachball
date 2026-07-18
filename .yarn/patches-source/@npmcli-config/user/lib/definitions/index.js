const definitions = require('./definitions.js')

/**
 * use the defined flattening function, and copy over any scoped
 * registries and registry-specific "nerfdart" configs verbatim
 * @param {import('../index.js').DefinitionsObject} obj
 */
const flatten = (obj, flat = {}) => {
  for (const [key, val] of Object.entries(obj)) {
    const def = definitions[key]
    if (def && def.flatten) {
      def.flatten(key, obj, flat)
    } else if (/@.*:registry$/i.test(key) || /^\/\//.test(key)) {
      flat[key] = val
    }
  }
  return flat
}

module.exports = {
  definitions,
  flatten,
}
