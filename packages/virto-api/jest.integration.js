const sharedConfig = require('./jest.config.js');

module.exports = {
 ...sharedConfig,
 testRegex: '\\.(integration-spec)\\.ts$',
 testPathIgnorePatterns: ['/node_modules/', '/dist/'],
 detectOpenHandles: false,
 forceExit: true,
 testTimeout: 15000
};