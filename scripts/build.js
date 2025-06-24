// scripts/build.js
const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  target: 'node16', // or node18, depending on your engines
  outfile: 'dist/extension.js',
  external: ['vscode'],
  sourcemap: true,
  minify: false
}).catch(() => process.exit(1));
