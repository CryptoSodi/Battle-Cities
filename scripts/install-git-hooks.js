const { execFileSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
    cwd: projectRoot,
    stdio: 'ignore',
  });
} catch (_error) {
  // Production installs may not include Git metadata.
}
