const path = require('path');
const process = require('process');
const { getDevRuntimeFailure } = require('./ensure-dev-runtime-utils.js');

function fail(message) {
  console.error(`[predev] ${message}`);
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const failure = getDevRuntimeFailure({
  rootDir,
  nodeVersion: process.version,
});

if (failure) {
  fail(failure);
}
