/* eslint-disable no-await-in-loop */
const assert = require('assert');
const constants = require('../src/constants');
const { InvalidBlockError } = require('../src/errors');
const { initBlocktree, getRandomHash } = require('./utils');

describe('Blocktree Layer 2 - Blocktree', () => {
    describe('read block', () => {
        it('should return null if no value is found', async () => {
            // arrange
            const blocktree = initBlocktree();

            // act
            const result = await blocktree.readBlock(constants.block.zero);

            // assert
            assert.strictEqual(null, result);
        });
        it('should return null if no value is found', async () => {
            // arrange
            const blocktree = initBlocktree();

            // act
            const result = await blocktree.readBlock(null);

            // assert
            assert.strictEqual(null, result);
        });
        it('should return null if no value is found', async () => {
            // arrange
            const blocktree = initBlocktree();

            // act
            const result = await blocktree.readBlock(false);

            // assert
            assert.strictEqual(null, result);
        });
        it('should retrieve block data if found from a root', async () => {
            // arrange
            const blocktree = initBlocktree();
            const data = Buffer.from("I'm a string!", 'utf-8');
            const block1 = await blocktree.writeBlock({ prev: null, data });

            // act
            const result = await blocktree.readBlock(block1);

            // assert
            assert.ok(Buffer.compare(data, result.data) === 0, 'Expected data to match.');
            assert.ok(result.timestamp > 0, 'Expected timestamp to be valid.');
            assert.strictEqual(result.prev, null);
            assert.ok(result.nonce, 'Expected valid nonce value.');
        });
        it('should retrieve block data if found from a block in a chain', async () => {
            // arrange
            const blocktree = initBlocktree();
            const data1 = Buffer.from("I'm a string!", 'utf-8');
            const block1 = await blocktree.writeBlock({ prev: null, data: data1 });
            const data2 = Buffer.from("I'm another string!", 'utf-8');
            const block2 = await blocktree.writeBlock({ prev: block1, data: data2 });

            // act
            const result = await blocktree.readBlock(block2);

            // assert
            assert.ok(Buffer.compare(data2, result.data) === 0, 'Expected data to match.');
            assert.ok(result.timestamp > 0, 'Expected timestamp to be valid.');
            assert.strictEqual(result.prev, block1);
            assert.ok(result.nonce, 'Expected valid nonce value.');
        });
    });
    describe('write block', () => {
        it('should ignore user-provided values other than prev and data', async () => {
            // arrange
            const blocktree = initBlocktree();
            const data = Buffer.from("I'm a string!", 'utf-8');
            const block1 = await blocktree.writeBlock({
                prev: null, data, timestamp: 0, nonce: 0, hash: 'ff',
            });

            // act
            const result = await blocktree.readBlock(block1);

            // assert
            assert.ok(Buffer.compare(data, result.data) === 0, 'Expected data to match.');
            assert.ok(result.timestamp !== 0, 'Expected timestamp to be valid.');
            assert.strictEqual(result.prev, null);
            assert.ok(result.hash !== 'ff', 'Expected prev pointer to be null.');
            assert.ok(result.nonce !== 0, 'Expected valid nonce value.');
        });
        it('should support 100 blocks in a chain', async () => {
            // arrange
            const blocktree = initBlocktree();
            const data = Buffer.from("I'm a string!", 'utf-8');
            let block = null;
            for (let i = 0; i < 100; i += 1) {
                block = await blocktree.writeBlock({ prev: block, data });
            }

            // act
            const result = await blocktree.readBlock(block);
            const prev = await blocktree.readBlock(result.prev);

            // assert
            assert.ok(Buffer.compare(data, result.data) === 0, 'Expected data to match.');
            assert.ok(Buffer.compare(data, prev.data) === 0, 'Expected data to match.');
            assert.ok(result.timestamp > 0, 'Expected timestamp to be valid.');
            assert.ok(prev.timestamp > 0, 'Expected timestamp to be valid.');
            assert.strictEqual(result.prev, prev.hash);
            assert.ok(result.nonce, 'Expected valid nonce value.');
            assert.ok(prev.nonce, 'Expected valid nonce value.');
        });
        it('should throw an exception if writing to an invalid blocktree', async () => {
            // arrange
            const blocktree = initBlocktree();
            const options = { validate: true };
            const block1 = getRandomHash();
            const data2 = Buffer.from("I'm another string!", 'utf-8');

            // act
            let isExecuted = false;
            try {
                await blocktree.writeBlock({ prev: block1, data: data2 }, options);
                isExecuted = true;
            } catch (err) {
                assert.ok(err instanceof InvalidBlockError);
                assert.strictEqual(err.layer, constants.layer.blockchain);
                assert.strictEqual(err.reason, InvalidBlockError.reasons.isNull);
            }

            // assert
            assert.strictEqual(isExecuted, false, 'Expected an exception to be thrown.');
        });
        it('should throw an exception if writing to a blockchain with a newer timestamp', async () => {
            // arrange
            const blocktree = initBlocktree();
            const options = { validate: true };
            const data1 = Buffer.from("I'm a string!", 'utf-8');
            const block1 = await blocktree.writeBlock({ prev: null, data: data1 }, options);
            const data2 = Buffer.from("I'm another string!", 'utf-8');

            // act
            let isExecuted = false;
            try {
                blocktree.mocks.os.setNextTimestamp(0);
                await blocktree.writeBlock({ prev: block1, data: data2 }, options);
                isExecuted = true;
            } catch (err) {
                assert.ok(err instanceof InvalidBlockError);
                assert.strictEqual(err.layer, constants.layer.blockchain);
                assert.strictEqual(err.reason, InvalidBlockError.reasons.invalidTimestamp);
            }

            // assert
            assert.strictEqual(isExecuted, false, 'Expected an exception to be thrown.');
        });
        it('should throw an exception if writing to a blockchain with another block present', async () => {
            // arrange
            const blocktree = initBlocktree();
            const options = { validate: true };
            const data1 = Buffer.from("I'm a string!", 'utf-8');
            const block1 = await blocktree.writeBlock({ prev: null, data: data1 }, options);
            const data2 = Buffer.from("I'm another string!", 'utf-8');
            await blocktree.writeBlock({ prev: block1, data: data1 }, options);

            // act
            let isExecuted = false;
            try {
                await blocktree.writeBlock({ prev: block1, data: data2 }, options);
                isExecuted = true;
            } catch (err) {
                assert.ok(err instanceof InvalidBlockError);
                assert.strictEqual(err.layer, constants.layer.blockchain);
                assert.strictEqual(err.reason, InvalidBlockError.reasons.nextBlockExists);
            }

            // assert
            assert.strictEqual(isExecuted, false, 'Expected an exception to be thrown.');
        });
    });
    describe('parent scan', () => {
        it('should return only the root block if no parent blocks are found', async () => {
            // arrange
            const blocktree = initBlocktree();
            const data = Buffer.from("I'm a string!", 'utf-8');
            const block = await blocktree.writeBlock({ prev: null, parent: null, data });

            // act
            const result = await blocktree.performParentScan(block);

            // assert
            assert.ok(Array.isArray(result));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].hash, block);
        });
        it('should return the block as well as all parent blocks', async () => {
            // arrange
            const blocktree = initBlocktree();
            const data = Buffer.from("I'm a string!", 'utf-8');
            const block1 = await blocktree.writeBlock({ prev: null, parent: null, data });
            const block2 = await blocktree.writeBlock({ prev: null, parent: block1, data });
            const block3 = await blocktree.writeBlock({ prev: null, parent: block2, data });
            const block4 = await blocktree.writeBlock({ prev: null, parent: block3, data });
            const block5 = await blocktree.writeBlock({ prev: null, parent: block4, data });

            // act
            const result = await blocktree.performParentScan(block5);

            // assert
            assert.ok(Array.isArray(result));
            assert.strictEqual(result.length, 5);
            assert.strictEqual(result[0].hash, block5);
            assert.strictEqual(result[1].hash, block4);
            assert.strictEqual(result[2].hash, block3);
            assert.strictEqual(result[3].hash, block2);
            assert.strictEqual(result[4].hash, block1);
        });
    });
    describe('child scan', () => {
        it('should return an empty array if no children are found', async () => {
            // arrange
            const blocktree = initBlocktree();
            const data = Buffer.from("I'm a string!", 'utf-8');
            const block = await blocktree.writeBlock({ prev: null, parent: null, data });

            // act
            const result = await blocktree.performChildScan(block);

            // assert
            assert.ok(Array.isArray(result));
            assert.strictEqual(result.length, 0);
        });
        it('should return an array of all child blocks if present', async () => {
            // arrange
            const blocktree = initBlocktree();
            const data = Buffer.from("I'm a string!", 'utf-8');
            const block1 = await blocktree.writeBlock({ prev: null, parent: null, data });
            const block2 = await blocktree.writeBlock({ prev: null, parent: block1, data });
            const block3 = await blocktree.writeBlock({ prev: null, parent: block1, data });
            const block4 = await blocktree.writeBlock({ prev: null, parent: block1, data });
            await blocktree.writeBlock({ prev: null, parent: block4, data });

            // act
            const result = await blocktree.performChildScan(block1);

            // assert
            assert.ok(Array.isArray(result));
            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].hash, block2);
            assert.strictEqual(result[1].hash, block3);
            assert.strictEqual(result[2].hash, block4);
        });
    });
    describe('get parent block', () => {
        it('should return null if no parent block found', async () => {
            // arrange
            const blocktree = initBlocktree();
            const data = Buffer.from("I'm a string!", 'utf-8');
            const block = await blocktree.writeBlock({ prev: null, parent: null, data });

            // act
            const result = await blocktree.getParentBlock(block);

            // assert
            assert.strictEqual(result, null);
        });
        it('should return the parent block if found', async () => {
            // arrange
            const blocktree = initBlocktree();
            const data = Buffer.from("I'm a string!", 'utf-8');
            const parent = await blocktree.writeBlock({ prev: null, parent: null, data });
            const block = await blocktree.writeBlock({ prev: null, parent, data });

            // act
            const result = await blocktree.getParentBlock(block);

            // assert
            assert.strictEqual(result, parent);
        });
    });
    describe('validate blocktree', () => {
        it('should report that a valid blocktree is valid', async () => {
            // arrange
            const blocktree = initBlocktree();
            const data1 = Buffer.from("I'm a string!", 'utf-8');
            const block1 = await blocktree.writeBlock({ prev: null, data: data1 });
            const data2 = Buffer.from("I'm another string!", 'utf-8');
            const block2 = await blocktree.writeBlock({ prev: block1, data: data2 });
            const data3 = Buffer.from("I'm yet another string!", 'utf-8');
            const block3 = await blocktree.writeBlock({ parent: block2, data: data3 });

            // act
            const result = await blocktree.validateBlocktree(block3);

            // assert
            assert.strictEqual(result.isValid, true);
            assert.strictEqual(result.blockCount, 3);
            assert.strictEqual(result.reason, undefined);
            assert.strictEqual(result.block, undefined);
        });
        it('should report that a blocktree with a missing parent is invalid', async () => {
            // arrange
            const blocktree = initBlocktree();
            const options = { validate: false };
            const block0 = getRandomHash();
            const data1 = Buffer.from("I'm a string!", 'utf-8');
            const block1 = await blocktree.writeBlock({ parent: block0, data: data1 }, options);
            const data2 = Buffer.from("I'm another string!", 'utf-8');
            const block2 = await blocktree.writeBlock({ parent: block1, data: data2 });
            const data3 = Buffer.from("I'm yet another string!", 'utf-8');
            const block3 = await blocktree.writeBlock({ parent: block2, data: data3 });

            // act
            const result = await blocktree.validateBlocktree(block3);

            // assert
            assert.strictEqual(result.isValid, false);
            assert.strictEqual(result.blockCount, 4);
            assert.strictEqual(result.reason, constants.validation.missingBlock);
            assert.strictEqual(result.block, block0);
        });
    });
});
