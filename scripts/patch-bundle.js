#!/usr/bin/env node

/**
 * Patch the CloudTreeWeb bundle to replace the CloudKit SDK
 * (webpack module 962) with our local shim.
 *
 * Works with both minified (1-line) and deobfuscated (multi-line) bundles.
 * Finds module 962 boundaries using regex, replaces it with the shim,
 * and writes a patched bundle.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const bundlePath = resolve(__dirname, '../public/static/js/main.c775fba0.js');
const shimPath = resolve(__dirname, '../src/lib/CloudKitAdapter.js');
const outputPath = resolve(__dirname, '../public/static/js/main-demo.js');

console.log('Reading bundle...');
const bundle = readFileSync(bundlePath, 'utf8');
console.log(`  ${(bundle.length / 1024).toFixed(1)} KB, ${bundle.split('\n').length} lines`);

console.log('Reading shim...');
const shim = readFileSync(shimPath, 'utf8');

// Find module 962 start — try multiple patterns (minified vs deobfuscated)
const patterns962 = [
  '962:function(e,t,n){',       // minified (no spaces)
  '962: function(e,t,n){',      // semi-minified
  '962: function (e, t, n) {',  // deobfuscated
];

let mod962Start = -1;
let matchedPattern = '';
for (const pat of patterns962) {
  mod962Start = bundle.indexOf(pat);
  if (mod962Start !== -1) {
    matchedPattern = pat;
    break;
  }
}

if (mod962Start === -1) {
  console.error('Could not find module 962 start boundary');
  console.error('Tried patterns:', patterns962.join(' | '));
  process.exit(1);
}
console.log(`Found module 962 at byte ${mod962Start} with pattern: "${matchedPattern}"`);

// Find the NEXT module after 962 (which is 534)
const patterns534 = [
  '534:function(e,t,n){',
  '534: function(e,t,n){',
  '534: function (e, t, n) {',
];

let mod534Start = -1;
for (const pat of patterns534) {
  mod534Start = bundle.indexOf(pat, mod962Start + 100);
  if (mod534Start !== -1) break;
}

if (mod534Start === -1) {
  console.error('Could not find module 534 start boundary');
  process.exit(1);
}

// Walk backwards from mod534Start to find the "," boundary between modules
let mod962End = mod534Start;
while (mod962End > mod962Start && bundle[mod962End - 1] !== ',') {
  mod962End--;
}

const removedSize = mod962End - mod962Start;
console.log(`Module 962: bytes ${mod962Start} to ${mod962End} (${(removedSize / 1024).toFixed(1)} KB)`);

// Build the replacement module
// Strip the module.exports/window.CloudKit lines from the shim since we'll use e.exports
const shimBody = shim
  .replace(/if \(typeof module !== 'undefined'[\s\S]*?window\.CloudKit = CloudKitAdapter;\s*\}/, '')
  .trim();

// Use the same function signature style as the matched pattern
const funcSig = matchedPattern.includes(' ') ? 'function (e, t, n)' : 'function(e,t,n)';
const replacement = `962:${funcSig}{\n${shimBody}\ne.exports=CloudKitAdapter},`;

// Patch the bundle
const patched = bundle.slice(0, mod962Start) + replacement + bundle.slice(mod962End);

console.log(`Writing patched bundle to ${outputPath}...`);
console.log(`  Original: ${(bundle.length / 1024).toFixed(1)} KB`);
console.log(`  Patched:  ${(patched.length / 1024).toFixed(1)} KB`);
console.log(`  Removed:  ${(removedSize / 1024).toFixed(1)} KB of CloudKit SDK`);
console.log(`  Added:    ${(replacement.length / 1024).toFixed(1)} KB of shim`);

writeFileSync(outputPath, patched, 'utf8');
console.log('Done!');
