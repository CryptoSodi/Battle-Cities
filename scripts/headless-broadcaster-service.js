const { spawnSync } = require('child_process');
const { resolve } = require('path');

const root = resolve(__dirname, '..');
const tsc = resolve(root, 'node_modules', 'typescript', 'bin', 'tsc');
const build = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.broadcaster.json'], {
  cwd: root,
  stdio: 'inherit',
});

if (build.status !== 0) process.exit(build.status || 1);

require(resolve(root, 'dist-broadcaster', 'scripts', 'headless-broadcaster-runtime.js'));
