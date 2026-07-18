const nopt = require('nopt')

const noptValidatePath = nopt.typeDefs.path.validate
const validatePath = (data, k, val) => {
  if (typeof val !== 'string') {
    return false
  }
  return noptValidatePath(data, k, val)
}

// add descriptions so we can validate more usefully
module.exports = {
  ...nopt.typeDefs,
  path: {
    ...nopt.typeDefs.path,
    validate: validatePath,
  },
}

// TODO: make nopt less of a global beast so this kludge isn't necessary
nopt.typeDefs = module.exports
