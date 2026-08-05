import { delimiter, resolve } from 'path';

const standaloneNodeModules = resolve(__dirname, '..', 'node_modules');
process.env.NODE_PATH = [standaloneNodeModules, process.env.NODE_PATH]
  .filter((value): value is string => Boolean(value))
  .join(delimiter);

// Shared engine files live above this package, so initialize Node's lookup
// paths before loading them. The headless package remains the dependency owner.
(require('module').Module as { _initPaths(): void })._initPaths();

const server = require('../src/headless').default;

export default server;
