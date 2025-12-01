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

/**
 * Recursively find all package.json files for @virtonetwork packages
 */
function findPackageJsonFiles(dir, packageNames, found = []) {
  if (!fs.existsSync(dir)) {
    return found;
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Check if this directory matches one of our package names
        if (packageNames.some(pkg => entry.name.includes(pkg))) {
          const pkgJsonPath = path.join(fullPath, 'package.json');
          if (fs.existsSync(pkgJsonPath)) {
            found.push(pkgJsonPath);
          }
        }
        // Recursively search in subdirectories
        findPackageJsonFiles(fullPath, packageNames, found);
      }
    }
  } catch (error) {
    // Ignore permission errors
  }
  
  return found;
}

// Package names to fix
const packagesToFix = [
  '@virtonetwork/authenticators-webauthn',
  '@virtonetwork/signer'
];

// Search in both regular node_modules and pnpm's .pnpm structure
const nodeModulesPath = path.join(__dirname, 'node_modules');
const rootNodeModulesPath = path.join(__dirname, '../../node_modules');

const allPaths = [
  ...findPackageJsonFiles(nodeModulesPath, packagesToFix),
  ...findPackageJsonFiles(rootNodeModulesPath, packagesToFix)
];

// Also check direct paths (for npm/yarn style installations)
const directPaths = [
  path.join(nodeModulesPath, '@virtonetwork/authenticators-webauthn/package.json'),
  path.join(nodeModulesPath, '@virtonetwork/signer/package.json'),
  path.join(rootNodeModulesPath, '@virtonetwork/authenticators-webauthn/package.json'),
  path.join(rootNodeModulesPath, '@virtonetwork/signer/package.json'),
];

directPaths.forEach(pkgPath => {
  if (fs.existsSync(pkgPath) && !allPaths.includes(pkgPath)) {
    allPaths.push(pkgPath);
  }
});

let fixedCount = 0;

allPaths.forEach(pkgPath => {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    
    if (pkg.type === 'module') {
      const relativePath = path.relative(__dirname, pkgPath);
      console.log(`Fixing ${relativePath}...`);
      delete pkg.type;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`✓ Removed "type": "module" from ${relativePath}`);
      fixedCount++;
    }
  } catch (error) {
    const relativePath = path.relative(__dirname, pkgPath);
    console.error(`Error processing ${relativePath}:`, error.message);
  }
});

if (fixedCount > 0) {
  console.log(`✓ Fixed ${fixedCount} package(s)`);
} else {
  console.log('✓ No packages needed fixing');
}

