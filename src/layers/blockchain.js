const constants = require('../constants');
const convert = require('../convert');
const { generateHash } = require('./system');
const system = require('./system');

/**
 * Given a blockchain data object, converts it into a Buffer.
 * @param {Object} bcBlockData The blockchain data object.
 * @returns {Buffer} The binary representation of the block.
 */
function serializeBlockData(bcBlockData) {
    let prev = bcBlockData.prev || Buffer.alloc(1);
    if (!Buffer.isBuffer(prev)) {
        prev = Buffer.from(prev, 'hex');
    }
    const nonce = system.generateNonce();
    const timestamp = system.generateTimestamp();
    const buf = Buffer.concat([
        // hash size (1 - 256 bytes)
        Buffer.from([Buffer.byteLength(prev) - 1]),
        // previous hash
        prev,
        // uniqueness
        convert.fromInt32(nonce),
        // timestamp
        convert.fromInt64(timestamp),
        // data
        bcBlockData.data
    ]);
    return buf;
}

/**
 * Given a buffer, deserializes it into a blockchain data object.
 * @param {Buffer} buf The buffer to deserialize.
 * @returns {Object} A blockchain data object.
 */
function deserializeBlockData(buf) {
    if (!buf) {
        return null;
    }
    let index = 0;
    const result = {};
    const hashSize = buf[index++] + 1;
    result.prev = buf.slice(index, index + hashSize);
    index += hashSize;
    // handle the case where prev is null.
    if (hashSize === 1 && Buffer.compare(result.prev, Buffer.alloc(1)) === 0) {
        result.prev = null;
    }
    else {
        result.prev = result.prev.toString('hex');
    }
    result.nonce = convert.toInt32(buf, index);
    index += constants.size.int32;
    result.timestamp = convert.toInt64(buf, index);
    index += constants.size.int64;
    result.data = buf.slice(index);
    result.hash = generateHash(buf);
    return result;
}

/**
 * Reads a block from storage.
 * @param {string} block The block hash to read.
 * @returns {Promise<Object>} The requested blockchain data.
 */
async function readBlock(block) {
    return deserializeBlockData(await system.readStorage(block));
}

/**
 * @private
 * Handles caching of the root block.
 * @param {string} block The block to update caches for.
 * @param {Object} bcBlockData The blockchain data object.
 * @returns {Promis<string>} The root block of the blockchain.
 */
async function cacheRootBlock(block, bcBlockData) {
    if (!bcBlockData.prev) {
        // if this block IS the root node, then cache itself.
        await system.writeCache(block, constants.cache.rootBlock, block);
        return block;
    }
    else {
        // check if the previous node in the blockchain knows who the root is.
        const cached = await system.readCache(bcBlockData.prev, constants.cache.rootBlock);
        if (cached) {
            await system.writeCache(block, constants.cache.rootBlock, cached);
            return cached;
        }
        else {
            // otherwise, walk across the blocks to the beginning of the blockchain.
            const root = await getRootBlock(block);
            await system.writeCache(block, constants.cache.rootBlock, root);
            return root;
        }
    }
}

/**
 * Writes a block to storage.
 * @param {Object} bcBlockData The blockchain data object.
 * @returns {Promise<string>} The hash of the newly written block.
 */
async function writeBlock(bcBlockData, options = {}) {
    if (options.validate !== false && bcBlockData.prev !== null) {
        const prev = await readBlock(bcBlockData.prev);
        if (!prev) {
            throw new Error(`Invalid block ${bcBlockData.prev}`);
        }
    }
    const block = await system.writeStorage(serializeBlockData(bcBlockData));
    if (options.cacheRoot !== false) {
        const root = await cacheRootBlock(block, bcBlockData);
        await system.writeCache(root, constants.cache.headBlock, block);
    }
    return block;
}

/**
 * Scans through all blocks in the system until a block matching the predicate is found.
 * @param {*} fn The predicate function.
 * @returns {Promise<Object>} The matching block, or null.
 */
async function findInBlocks(fn) {
    const result = await system.findInStorage(data => fn(deserializeBlockData(data)));
    if (result) {
        return deserializeBlockData(result);
    }
    return null;
}

/**
 * Scans through all blocks in the system and runs the map() function.
 * @param {*} fn The selector function.
 * @returns {Promise<Array>} The result of the map() call.
 */
async function mapInBlocks(fn) {
    return await system.mapInStorage(data => fn(deserializeBlockData(data)));
}

/**
 * Given a block, scans the blocks in the system to find the next one.
 * @param {string} block The block to start from.
 * @returns {Promise<string>} The hash of the next block, or null.
 */
async function getNextBlock(block) {
    const cached = await system.readCache(block, constants.cache.next);
    if (cached) {
        return cached;
    }
    const value = await system.findInStorage(buf => deserializeBlockData(buf).prev === block);
    if (value) {
        const result = system.generateHash(value);
        await system.writeCache(block, constants.cache.next, result);
        return result;
    }
    return null;
}

/**
 * Given a block, locates the root block of the blockchain.
 * @param {string} block The block to start from.
 * @returns {Promise<string>} The root block of the blockchain.
 */
async function getRootBlock(block) {
    let result = block;
    let next = block;
    do {
        const nextBlock = await readBlock(next);
        next = (nextBlock || {}).prev
        result = next || result
        if (!nextBlock) {
            result = null;
        }
    }
    while (next != null);
    return result;
}

/**
 * Given a block, finds the head block in the blockchain.
 * @param {string} block The block to start with.
 * @returns {Promise<string>} The head block of the blockchain.
 */
async function getHeadBlock(block) {
    const bc = await getRootBlock(block);
    if (!bc) {
        return null;
    }
    const cached = await system.readCache(bc, constants.cache.headBlock);
    if (cached) {
        return cached;
    }
    let result = bc;
    let next = null
    let count = 0;
    do {
        next = await getNextBlock(result);
        result = next || result
        count += 1;
    }
    while (next != null);
    if (count > 1) {
        await system.writeCache(bc, constants.cache.headBlock, result);
        return result;
    }
    return null;
}

async function copyBlock() {
    return null;
}

/**
 * Given a block, validates all previous blocks in the blockchain.
 * @param {*} block 
 */
async function validateBlockchain(block) {
    let next = block;
    let blockCount = 0;
    do {
        const nextBlock = await readBlock(next);
        if (!nextBlock) {
            return {
                isValid: false,
                reason: constants.validation.missingBlock,
                block: next,
                blockCount
            };
        }
        blockCount += 1;
        next = (nextBlock || {}).prev
    }
    while (next != null);
    return { isValid: true, blockCount };
}

module.exports = {
    readBlock,
    writeBlock,
    findInBlocks,
    mapInBlocks,
    getHeadBlock,
    getRootBlock,
    getNextBlock,
    copyBlock,
    validateBlockchain,
    serializeBlockData,
    deserializeBlockData
};
