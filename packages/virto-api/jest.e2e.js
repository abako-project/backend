const sharedConfig = require('./jest.config.js');

module.exports = {
 ...sharedConfig,
 testRegex: '.e2e-spec.(ts|js)$',
 transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      allowJs: true
    }
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ]
};