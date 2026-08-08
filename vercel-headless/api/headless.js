"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
require("@hapi/joi");
const standaloneNodeModules = (0, path_1.resolve)(__dirname, '..', 'node_modules');
process.env.NODE_PATH = [standaloneNodeModules, process.env.NODE_PATH]
    .filter((value) => Boolean(value))
    .join(path_1.delimiter);
// Shared engine files live above this package, so initialize Node's lookup
// paths before loading them. The headless package remains the dependency owner.
require('module').Module._initPaths();
const server = require('../src/headless').default;
exports.default = server;
