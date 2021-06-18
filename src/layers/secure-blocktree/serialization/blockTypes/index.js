/* eslint-disable global-require */
const constants = require('../../../../constants');

/**
 * A mapping between block types and their respective serialize/deserialize functions.
 */
module.exports = {
    [constants.blockType.root]: require('./keys'),
    [constants.blockType.keys]: require('./keys'),
    [constants.blockType.zone]: require('./options'),
    [constants.blockType.identity]: require('./options'),
    [constants.blockType.collection]: require('./options'),
    [constants.blockType.options]: require('./options'),
};
