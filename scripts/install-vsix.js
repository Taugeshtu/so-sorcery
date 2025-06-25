// scripts/install-vsix.js
const { execSync } = require('child_process');
const fs = require('fs');

const vsix = fs.readdirSync('.').find(f => f.endsWith('.vsix'));
if (!vsix) {
  console.error('❌ No .vsix file found!');
  process.exit(1);
}

console.log(`Installing: ${vsix}`);

try {
  execSync(`code --install-extension "${vsix}" --force`, { stdio: 'inherit' });
  console.log(`✅ Successfully installed ${vsix}`);
} catch (e) {
  console.error(`❌ Failed to install ${vsix}:`, e.message);
  process.exit(1);
}
