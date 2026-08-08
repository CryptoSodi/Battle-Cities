"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameState = void 0;
var GameState;
(function (GameState) {
    GameState[GameState["Playing"] = 0] = "Playing";
    GameState[GameState["Paused"] = 1] = "Paused";
    GameState[GameState["Over"] = 2] = "Over";
})(GameState = exports.GameState || (exports.GameState = {}));
