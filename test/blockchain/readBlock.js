const assert = require('assert');
const constants = require('../../src/constants');
const { SerializationError } = require('../../src/errors');

/**
 * Tests for blockchain.readBlock()
 */
module.exports = (context) => ({
    'should return null if block is empty': async () => {
        const { blockchain } = context;
        const result = await blockchain.readBlock(constants.block.zero);
        assert.strictEqual(null, result);
    },
    'should return null if no value is null': async () => {
        const { blockchain } = context;
        const result = await blockchain.readBlock(null);
        assert.strictEqual(null, result);
    },
    'should return null if no value is false': async () => {
        const { blockchain } = context;
        const result = await blockchain.readBlock(false);
        assert.strictEqual(null, result);
    },
    'should retrieve block data if found from a root': async () => {
        const { blockchain } = context;
        const data = Buffer.from("I'm a string!", 'utf-8');
        const block1 = await blockchain.writeBlock({ prev: null, data });
        const result = await blockchain.readBlock(block1);

        assert.ok(Buffer.compare(data, result.data) === 0, 'Expected data to match.');
        assert.ok(result.timestamp > 0, 'Expected timestamp to be valid.');
        assert.strictEqual(result.prev, null);
        assert.ok(result.nonce, 'Expected valid nonce value.');
    },
    'should retrieve block data if found from a block in a chain': async () => {
        const { blockchain } = context;
        const data1 = Buffer.from("I'm a string!", 'utf-8');
        const block1 = await blockchain.writeBlock({ prev: null, data: data1 });
        const data2 = Buffer.from("I'm another string!", 'utf-8');
        const block2 = await blockchain.writeBlock({ prev: block1, data: data2 });
        const result = await blockchain.readBlock(block2);

        assert.ok(Buffer.compare(data2, result.data) === 0, 'Expected data to match.');
        assert.ok(result.timestamp > 0, 'Expected timestamp to be valid.');
        assert.ok(Buffer.compare(result.prev, block1) === 0);
        assert.ok(result.nonce, 'Expected valid nonce value.');
    },
    'should fail if the requested block hash is an incorrect size': async () => {
        const { blockchain } = context;
        const invalidBlock = Buffer.from('aabbccdd', 'utf-8');
        let isExecuted = false;
        try {
            await blockchain.readBlock(invalidBlock);
            isExecuted = true;
        } catch (err) {
            assert.ok(err instanceof SerializationError);
            assert.strictEqual(err.layer, constants.layer.blockchain);
            assert.strictEqual(err.reason, SerializationError.reasons.invalidBlockHash);
        }
        assert.strictEqual(isExecuted, false, 'Expected an exception to be thrown.');
    },
});
