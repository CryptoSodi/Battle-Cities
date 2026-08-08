"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileGamepadHost = void 0;
const PEER_JS_URL = 'https://unpkg.com/peerjs@1.4.7/dist/peerjs.js';
const QR_CODE_URL = 'https://unpkg.com/qrcode@1.5.1/build/qrcode.js';
const MOBILE_GAMEPAD_PATH = '/mobile-gamepad/';
const MOBILE_GAMEPAD_VERSION = '2026-06-27-transport-logs';
const LOCAL_MOBILE_GAMEPAD_ORIGIN = 'https://192.168.1.15:8080';
const MOBILE_GAMEPAD_ORIGIN_PARAM = 'mobileGamepadOrigin';
const MOBILE_GAMEPAD_ORIGIN_STORAGE_KEY = 'battlecity.mobileGamepadOrigin';
const ROOM_CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
function log(message, data) {
    if (data === undefined) {
        console.log(`[mobile-gamepad-host] ${message}`);
        return;
    }
    console.log(`[mobile-gamepad-host] ${message}`, data);
}
function getRoomCodeLetter() {
    const index = Math.floor(Math.random() * ROOM_CODE_LETTERS.length);
    return ROOM_CODE_LETTERS.charAt(index);
}
function loadScript(src, globalName) {
    const existingGlobal = window[globalName];
    if (existingGlobal !== undefined) {
        return Promise.resolve(existingGlobal);
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.onload = () => resolve(window[globalName]);
        script.onerror = reject;
        script.src = src;
        document.body.appendChild(script);
    });
}
async function createPeerId(roomCode) {
    const bytes = new TextEncoder().encode(roomCode);
    const hash = await crypto.subtle.digest('SHA-1', bytes);
    return Array.from(new Uint8Array(hash))
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
}
function getMobileGamepadOrigin() {
    const searchParams = new URLSearchParams(window.location.search);
    const queryOrigin = searchParams.get(MOBILE_GAMEPAD_ORIGIN_PARAM);
    const storedOrigin = window.localStorage?.getItem(MOBILE_GAMEPAD_ORIGIN_STORAGE_KEY);
    const overrideOrigin = getValidOrigin(queryOrigin || storedOrigin);
    if (overrideOrigin !== null) {
        return overrideOrigin;
    }
    if (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1') {
        return LOCAL_MOBILE_GAMEPAD_ORIGIN;
    }
    return window.location.origin;
}
function getValidOrigin(value) {
    if (value === null || value.trim() === '') {
        return null;
    }
    try {
        const url = new URL(value);
        return url.origin;
    }
    catch {
        return null;
    }
}
class MobileGamepadHost {
    constructor() {
        this.started = false;
        this.startPromise = null;
        this.roomCode = '';
        this.playerUrl = '';
        this.gamepads = [];
        this.lastTimestamp = 0;
    }
    start() {
        if (this.startPromise !== null) {
            return this.startPromise;
        }
        this.startPromise = this.startInternal();
        return this.startPromise;
    }
    isStarted() {
        return this.started;
    }
    getRoomCode() {
        return this.roomCode;
    }
    getPlayerUrl() {
        return this.playerUrl;
    }
    getGamepad(index) {
        return this.gamepads[index] || null;
    }
    async createQrElement() {
        await this.start();
        const container = document.createElement('div');
        container.className = 'mobile-gamepad-qr';
        const title = document.createElement('div');
        title.className = 'mobile-gamepad-qr__title';
        title.textContent = 'PHONE CONTROLLER';
        const image = document.createElement('img');
        image.className = 'mobile-gamepad-qr__image';
        image.alt = 'Scan to connect phone controller';
        const code = document.createElement('div');
        code.className = 'mobile-gamepad-qr__code';
        code.textContent = this.roomCode;
        const QRCode = await loadScript(QR_CODE_URL, 'QRCode');
        image.src = await QRCode.toDataURL(this.playerUrl);
        container.appendChild(title);
        container.appendChild(image);
        container.appendChild(code);
        return container;
    }
    async startInternal() {
        if (!window.isSecureContext) {
            throw new Error('Mobile controller requires HTTPS or localhost.');
        }
        this.roomCode = Array.from({ length: 4 }, getRoomCodeLetter).join('');
        const playerUrl = new URL(MOBILE_GAMEPAD_PATH, getMobileGamepadOrigin());
        playerUrl.searchParams.set('v', MOBILE_GAMEPAD_VERSION);
        playerUrl.searchParams.set('rc', this.roomCode);
        playerUrl.hash = `?rc=${this.roomCode}`;
        this.playerUrl = playerUrl.toString();
        const peerId = await createPeerId(this.roomCode);
        const Peer = (await loadScript(PEER_JS_URL, 'Peer'));
        const peer = new Peer(peerId);
        peer.on('error', (event) => {
            // Keep the game usable if the phone-controller service is unavailable.
            log('peer error', event);
            console.error(event);
        });
        peer.on('open', () => {
            log('peer open', { peerId, roomCode: this.roomCode });
        });
        peer.on('connection', (connection) => {
            log('controller connection received');
            this.handleConnection(connection);
        });
        this.started = true;
    }
    handleConnection(connection) {
        let lastConnectionSequence = 0;
        let firstPacketReceived = false;
        let lastPacketLogAt = 0;
        connection.on('error', (event) => {
            log('connection error', event);
            console.error(event);
        });
        connection.on('data', (data) => {
            if (data?.type !== 'gamepads') {
                return;
            }
            if (typeof data.seq === 'number' &&
                data.seq <= lastConnectionSequence) {
                return;
            }
            if (typeof data.seq !== 'number' &&
                data.timestamp <= this.lastTimestamp) {
                return;
            }
            if (typeof data.seq === 'number') {
                lastConnectionSequence = data.seq;
            }
            this.lastTimestamp = data.timestamp;
            this.gamepads = (data.gamepads || []).map((gamepad) => ({
                ...gamepad,
                receivedAt: Date.now(),
            }));
            const now = Date.now();
            if (!firstPacketReceived || now - lastPacketLogAt > 1000) {
                firstPacketReceived = true;
                lastPacketLogAt = now;
                const gamepad = this.gamepads[0];
                log('packet received', {
                    seq: data.seq,
                    axes: gamepad?.axes,
                    buttons: gamepad?.buttons?.map((button) => button.value),
                });
            }
        });
        connection.on('open', () => {
            log('data channel open');
            connection.peerConnection?.addEventListener('connectionstatechange', () => {
                const state = connection.peerConnection.connectionState;
                log('webrtc connection state', state);
                if (state === 'failed' || state === 'closed') {
                    connection.close();
                }
            });
        });
        connection.on('close', () => {
            log('data channel close');
            this.gamepads.forEach((gamepad) => {
                gamepad.connected = false;
            });
        });
    }
}
exports.MobileGamepadHost = MobileGamepadHost;
