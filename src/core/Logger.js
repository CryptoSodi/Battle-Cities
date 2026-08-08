"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["Debug"] = 1] = "Debug";
    LogLevel[LogLevel["Info"] = 2] = "Info";
    LogLevel[LogLevel["Warn"] = 3] = "Warn";
    LogLevel[LogLevel["Error"] = 4] = "Error";
    LogLevel[LogLevel["None"] = 5] = "None";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
class Logger {
    constructor(tag = '', level = LogLevel.Error) {
        this.warn = (...args) => {
            if (this.level > LogLevel.Warn) {
                return;
            }
            console.warn(...this.composeArgs(...args));
        };
        this.error = (...args) => {
            if (this.level > LogLevel.Error) {
                return;
            }
            console.error(...this.composeArgs(...args));
        };
        this.time = (mark) => {
            console.time(`${this.tag} ${mark}`);
        };
        this.timeEnd = (mark) => {
            console.timeEnd(`${this.tag} ${mark}`);
        };
        this.tag = tag ? `[${tag}]` : '';
        this.level = level;
    }
    setLevel(level) {
        this.level = level;
        return this;
    }
    debug(...args) {
        // TODO: check for prod build
        if (this.level > LogLevel.Debug) {
            return;
        }
        console.log(...this.composeArgs(...args));
    }
    info(...args) {
        if (this.level > LogLevel.Info) {
            return;
        }
        console.log(...this.composeArgs(...args));
    }
    /**
     * First argument to console.log-like methods supports formatting like %s.
     * Check if it is a string and append custom tag to it.
     */
    composeArgs(message, ...optionalParams) {
        const args = [];
        if (typeof message === 'string') {
            const taggedMessage = `${this.tag} ${message}`;
            args.push(taggedMessage);
        }
        else {
            args.push(this.tag, message);
        }
        args.push(...optionalParams);
        return args;
    }
}
exports.Logger = Logger;
Logger.Level = LogLevel;
