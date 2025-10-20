#!/usr/bin/env node

/**
 * Workaround for @virtonetwork packages CommonJS compatibility issue
 * 
 * Problem: @virtonetwork/authenticators-webauthn and @virtonetwork/signer have
 * "type": "module" in their package.json, but their dist/cjs/*.js files use
 * CommonJS syntax (exports, require). This causes Node.js to treat them as ES
 * modules, leading to "ReferenceError: exports is not defined" errors.
 * 
 * This script removes "type": "module" from the installed packages to allow
 * CommonJS projects to use them.
 * 
 * Note: This is a temporary fix. The correct fix should be done in the source packages
 */

const fs = require('fs');
const path = require('path');

// Paths to check for packages with type: module issue
const paths = [
  'node_modules/@virtonetwork/authenticators-webauthn/package.json',
  'node_modules/@virtonetwork/sdk/node_modules/@virtonetwork/authenticators-webauthn/package.json',
  'node_modules/@virtonetwork/signer/package.json',
  'node_modules/@virtonetwork/sdk/node_modules/@virtonetwork/signer/package.json'
];

paths.forEach(pkgPath => {
  const fullPath = path.join(__dirname, pkgPath);
  
  if (fs.existsSync(fullPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      
      if (pkg.type === 'module') {
        console.log(`Fixing ${pkgPath}...`);
        delete pkg.type;
        fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n');
        console.log(`✓ Removed "type": "module" from ${pkgPath}`);
      }
    } catch (error) {
      console.error(`Error processing ${pkgPath}:`, error.message);
    }
  }
});

console.log('✓ Packages fixed');

