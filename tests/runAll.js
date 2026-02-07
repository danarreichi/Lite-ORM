const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testsDir = __dirname;
const testFiles = fs
  .readdirSync(testsDir)
  .filter(file => file.endsWith('.test.js'))
  .sort();

if (testFiles.length === 0) {
  console.log('No test files found.');
  process.exit(0);
}

let failed = false;

testFiles.forEach(file => {
  const fullPath = path.join(testsDir, file);
  console.log(`\n=== Running ${file} ===\n`);

  const result = spawnSync(process.execPath, [fullPath], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    failed = true;
  }
});

process.exit(failed ? 1 : 0);
