"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputHintSettings = void 0;
const config = __importStar(require("../config"));
class InputHintSettings {
    constructor(storage) {
        this.storage = storage;
    }
    shouldShowLevelHint() {
        // Set by user in settings
        let shouldShow = this.getShowLevelHint();
        if (shouldShow !== null) {
            return shouldShow;
        }
        // Gameplay controls remain available in Settings, but no longer interrupt
        // a new run unless the player explicitly enables the hint.
        return false;
    }
    shouldShowEditorHint() {
        // Set by user in settings
        let shouldShow = this.getShowEditorHint();
        if (shouldShow !== null) {
            return shouldShow;
        }
        // If not set by user we decide based on if user have seen it yet
        const seenHint = this.getSeenEditorHint();
        shouldShow = !seenHint;
        return shouldShow;
    }
    setShowLevelHint(show) {
        this.storage.setBoolean(config.STORAGE_KEY_SETTINGS_SHOW_LEVEL_HINT, show);
        this.storage.save();
    }
    getShowLevelHint() {
        // If not set - null is returned. Three values (true, false, null) needed
        // to create default behavior when user has not made changes to these
        // settings yet.
        return this.storage.getBoolean(config.STORAGE_KEY_SETTINGS_SHOW_LEVEL_HINT, null);
    }
    setShowEditorHint(show) {
        this.storage.setBoolean(config.STORAGE_KEY_SETTINGS_SHOW_EDITOR_HINT, show);
        this.storage.save();
    }
    getShowEditorHint() {
        // If not set - null is returned. Three values (true, false, null) needed
        // to create default behavior when user has not made changes to these
        // settings yet.
        return this.storage.getBoolean(config.STORAGE_KEY_SETTINGS_SHOW_EDITOR_HINT, null);
    }
    setSeenLevelHint() {
        this.storage.setBoolean(config.STORAGE_KEY_SETTINGS_SEEN_LEVEL_HINT, true);
        this.storage.save();
    }
    getSeenLevelHint() {
        return this.storage.getBoolean(config.STORAGE_KEY_SETTINGS_SEEN_LEVEL_HINT, false);
    }
    setSeenEditorHint() {
        this.storage.setBoolean(config.STORAGE_KEY_SETTINGS_SEEN_EDITOR_HINT, true);
        this.storage.save();
    }
    getSeenEditorHint() {
        return this.storage.getBoolean(config.STORAGE_KEY_SETTINGS_SEEN_EDITOR_HINT, false);
    }
}
exports.InputHintSettings = InputHintSettings;
