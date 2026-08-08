"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpGhostSignalTransport = void 0;
const api_1 = require("../api");
const POLL_INTERVAL_MS = 750;
class HttpGhostSignalTransport {
    constructor(room, localPlayerIndex, signalingBaseUrl = (0, api_1.getApiBaseUrl)(), authorizationToken = '') {
        this.lastSeenSignalIds = new Map();
        this.room = room;
        this.localPlayerIndex = localPlayerIndex;
        this.remotePlayerIndex = 1 - localPlayerIndex;
        this.signalingBaseUrl = signalingBaseUrl;
        this.authorizationToken = authorizationToken;
    }
    async publishSignal(code, kind) {
        const response = await fetch(this.signalUrl(this.localPlayerIndex, kind).toString(), {
            method: 'POST',
            headers: {
                ...this.authorizationHeaders(),
                'content-type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ code }),
        });
        if (!response.ok) {
            throw new Error(`HTTP WebRTC signal publish failed: ${response.status}`);
        }
    }
    subscribe(callback) {
        let disposed = false;
        let timer = null;
        const poll = async () => {
            try {
                await Promise.all([
                    this.pollKind('offer', callback),
                    this.pollKind('answer', callback),
                ]);
            }
            catch (error) {
                console.warn('[webrtc-ghost] HTTP signal poll failed', error);
            }
            finally {
                if (!disposed) {
                    timer = window.setTimeout(poll, POLL_INTERVAL_MS);
                }
            }
        };
        void poll();
        return () => {
            disposed = true;
            if (timer !== null) {
                window.clearTimeout(timer);
            }
        };
    }
    async pollKind(kind, callback) {
        const lastSeenId = this.lastSeenSignalIds.get(kind) ?? 0;
        const url = this.signalUrl(this.remotePlayerIndex, kind);
        url.searchParams.set('after', lastSeenId.toString());
        const response = await fetch(url.toString(), {
            headers: {
                ...this.authorizationHeaders(),
                accept: 'application/json',
            },
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error(`HTTP WebRTC signal poll failed: ${response.status}`);
        }
        const body = (await response.json());
        if (body.signal === null || body.signal.id <= lastSeenId) {
            return;
        }
        this.lastSeenSignalIds.set(kind, body.signal.id);
        callback(body.signal.code, body.signal.kind);
    }
    signalUrl(playerIndex, kind) {
        return new URL(`/api/webrtc/matches/${encodeURIComponent(this.room)}/players/${playerIndex}/signals/${kind}`, this.signalingBaseUrl);
    }
    authorizationHeaders() {
        return this.authorizationToken === ''
            ? {}
            : { authorization: `Bearer ${this.authorizationToken}` };
    }
}
exports.HttpGhostSignalTransport = HttpGhostSignalTransport;
