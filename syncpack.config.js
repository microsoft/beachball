// @ts-check
/** @type {import('syncpack').RcFile} */
const config = {
  versionGroups: [
    {
      // temporarily ignore p-graph
      packages: ['beachball'],
      dependencies: ['p-graph'],
      isIgnored: true,
    },
  ],
};
module.exports = config;
