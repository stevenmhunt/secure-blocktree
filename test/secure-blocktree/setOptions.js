const assert = require('assert');
const constants = require('../../src/constants');
const { InvalidSignatureError, InvalidBlockError } = require('../../src/errors');

module.exports = (context) => ({
    'should succeed for a zone using the parent key': async () => {
        const { secureRoot, secureBlocktree, rootZoneKeys } = context;
        const { rootZone } = secureRoot;
        const newZone = await secureBlocktree.createZone({
            block: rootZone,
            sig: context.signAs(
                rootZoneKeys[constants.action.write][0],
            ),
        });
        const result = await secureBlocktree.setOptions({
            block: newZone,
            sig: context.signAs(
                rootZoneKeys[constants.action.write][0],
            ),
            options: { name: 'NEW NAME' },
        });

        assert.ok(result !== null, 'Expected a valid block to be returned.');
    },
    'should succeed for a zone using the root key': async () => {
        const {
            secureRoot, secureBlocktree, rootKeys, rootZoneKeys,
        } = context;
        const { rootZone } = secureRoot;
        const newZone = await secureBlocktree.createZone({
            block: rootZone,
            sig: context.signAs(
                rootZoneKeys[constants.action.write][0],
            ),
        });
        const result = await secureBlocktree.setOptions({
            block: newZone,
            sig: context.signAs(
                rootKeys[constants.action.write][0],
            ),
            options: { name: 'NEW NAME' },
        });

        assert.ok(result !== null, 'Expected a valid block to be returned.');
    },
    'should fail with an inconsistent signature': async () => {
        const {
            secureRoot, secureBlocktree, rootKeys, rootZoneKeys,
        } = context;
        const { rootZone } = secureRoot;
        const newZoneKeys = await context.generateTestKeys();
        const newZone = await secureBlocktree.createZone({
            block: rootZone,
            sig: context.signAs(
                rootZoneKeys[constants.action.write][0],
            ),
        });
        await secureBlocktree.setKeys({
            block: newZone,
            sig: context.signAs(
                rootZoneKeys[constants.action.write][0],
            ),
            keys: newZoneKeys,
        });
        let isExecuted = false;
        try {
            await secureBlocktree.setOptions({
                block: newZone,
                sig: context.signAs(rootZoneKeys[constants.action.write][0],
                    rootKeys[constants.action.write][0]),
                options: { name: 'NEW NAME' },
            });
            isExecuted = true;
        } catch (err) {
            assert.ok(err instanceof InvalidSignatureError);
            assert.strictEqual(err.reason, InvalidSignatureError.reasons.doesNotMatch);
        }

        assert.strictEqual(isExecuted, false, 'Expected an exception to be thrown.');
    },
    'should fail without a known signature': async () => {
        const { secureRoot, secureBlocktree, rootZoneKeys } = context;
        const invalidKey = await context.generateTestKeys();
        const { rootZone } = secureRoot;
        const newZone = await secureBlocktree.createZone({
            block: rootZone,
            sig: context.signAs(
                rootZoneKeys[constants.action.write][0],
            ),
        });
        let isExecuted = false;
        try {
            await secureBlocktree.setOptions({
                block: newZone,
                sig: context.signAs(invalidKey[constants.action.write][0]),
                options: { name: 'NEW NAME' },
            });
            isExecuted = true;
        } catch (err) {
            assert.ok(err instanceof InvalidSignatureError);
        }

        assert.strictEqual(isExecuted, false, 'Expected an exception to be thrown.');
    },
    'should fail with the blockchain\'s own key': async () => {
        const { secureRoot, secureBlocktree, rootZoneKeys } = context;
        const { rootZone } = secureRoot;
        const newZoneKeys = await context.generateTestKeys();
        const newZone = await secureBlocktree.createZone({
            block: rootZone,
            sig: context.signAs(
                rootZoneKeys[constants.action.write][0],
            ),
        });
        await secureBlocktree.setKeys({
            block: newZone,
            sig: context.signAs(
                rootZoneKeys[constants.action.write][0],
            ),
            keys: newZoneKeys,
        });
        let isExecuted = false;
        try {
            await secureBlocktree.setOptions({
                block: newZone,
                sig: context.signAs(
                    newZoneKeys[constants.action.write][0],
                ),
                options: { name: 'NEW NAME' },
            });
            isExecuted = true;
        } catch (err) {
            assert.ok(err instanceof InvalidSignatureError);
        }

        assert.strictEqual(isExecuted, false, 'Expected an exception to be thrown.');
    },
    'should fail without a parent': async () => {
        const { secureBlocktree, rootKeys } = context;
        let isExecuted = false;
        try {
            await secureBlocktree.setOptions({
                block: null,
                sig: context.signAs(
                    rootKeys[constants.action.write][0],
                ),
                options: { name: 'NEW NAME' },
            });
            isExecuted = true;
        } catch (err) {
            assert.ok(err instanceof InvalidBlockError);
            assert.strictEqual(err.layer, constants.layer.secureBlocktree);
            assert.strictEqual(err.reason, InvalidBlockError.reasons.isNull);
        }

        assert.strictEqual(isExecuted, false, 'Expected an exception to be thrown.');
    },
    'should fail onto the root block': async () => {
        const { secureRoot, secureBlocktree, rootKeys } = context;
        const { rootBlock } = secureRoot;
        let isExecuted = false;
        try {
            await secureBlocktree.setOptions({
                block: rootBlock,
                sig: context.signAs(
                    rootKeys[constants.action.write][0],
                ),
                options: { name: 'NEW NAME' },
            });
            isExecuted = true;
        } catch (err) {
            assert.ok(err instanceof InvalidBlockError);
            assert.strictEqual(err.layer, constants.layer.secureBlocktree);
            assert.strictEqual(err.reason, InvalidBlockError.reasons.isNull);
        }

        assert.strictEqual(isExecuted, false, 'Expected an exception to be thrown.');
    },
});
