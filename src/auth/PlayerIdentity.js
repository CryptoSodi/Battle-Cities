"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerIdentity = void 0;
const api_1 = require("../network/api");
class PlayerIdentity {
    constructor() {
        this.player = null;
    }
    async refresh() {
        const response = await (0, api_1.apiFetch)('/api/player');
        if (!response.ok) {
            this.player = null;
            return false;
        }
        const body = (await response.json());
        if (body.authenticated === true && isCurrentPlayer(body.player)) {
            this.player = body.player;
            return true;
        }
        this.player = null;
        return false;
    }
    clear() {
        this.player = null;
    }
    getPlayer() {
        return this.player;
    }
    isAuthenticated() {
        return this.player !== null;
    }
    getDisplayName() {
        return this.player?.displayName || 'Player';
    }
    getProviderLabel() {
        switch (this.player?.provider) {
            case 'wallet':
                return 'Phantom';
            case 'google':
                return 'Google';
            case 'guest':
                return 'Guest';
            default:
                return 'Offline';
        }
    }
}
exports.PlayerIdentity = PlayerIdentity;
function isCurrentPlayer(value) {
    return (typeof value === 'object' &&
        value !== null &&
        typeof value.id === 'string' &&
        (value.provider === 'guest' ||
            value.provider === 'wallet' ||
            value.provider === 'google') &&
        typeof value.displayName === 'string');
}
