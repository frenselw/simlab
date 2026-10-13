'use strict';
const assert = require('node:assert/strict');
const {validateVersions} = require('./ci-environment');
validateVersions({node: '22.23.3', chrome: '154.0.8037.92'}, {node: '22.23.3', chrome: '154.0.8037.92'});
assert.throws(() => validateVersions({node: '26', chrome: '154.0.8037.92'}, {node: '22.23.3'}), /node version mismatch/);
assert.throws(() => validateVersions({node: '22.23.3'}, {chrome: '154.0.8037.92'}), /chrome version mismatch/);
validateVersions({node: 'local'}, {});
console.log('CI environment cannot silently change required Node/Chrome versions.');
