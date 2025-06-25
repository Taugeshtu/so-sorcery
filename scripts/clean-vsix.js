// scripts/clean-vsix.js
const fs = require('fs');
const path = require('path');

for (const file of fs.readdirSync('.')) {
  if (file.endsWith('.vsix')) {
    fs.unlinkSync(path.join('.', file));
  }
}
