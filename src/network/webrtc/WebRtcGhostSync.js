"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebRtcGhostSync = void 0;
const shared_1 = require("@battlecities/shared");
const GHOST_PARAM = 'ghostMirror';
const GHOST_PARAM_LOWERCASE = 'ghostmirror';
const GHOST_PARAM_LEGACY_TYPO = 'ghosmirror';
const MATCH_PARAM = 'match';
const BROADCAST_PREFIX = 'battlecity-ghost-channel';
const DATA_CHANNEL_LABEL = 'battlecity-ghost';
const RECONNECT_DELAY_MS = 1500;
const MAX_BUFFERED_AMOUNT_BYTES = 256 * 1024;
function log(message, data) {
    if (data === undefined) {
        console.log(`[webrtc-ghost] ${message}`);
        return;
    }
    console.log(`[webrtc-ghost] ${message}`, data);
}
function normalizeRoom(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}
function isEnabledValue(value) {
    return value === '' || value === '1' || value === 'true';
}
function encodeSignalCode(signal) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(signal))));
}
function decodeSignalCode(code) {
    const signal = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (signal?.type !== 'battlecity-ghost-signal' ||
        signal.version !== 1 ||
        signal.description === undefined) {
        throw new Error('Invalid ghost mirror signal code.');
    }
    return signal;
}
function createPeerConnection() {
    return new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
}
function createSignalSessionId(room, playerIndex) {
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    return `${room}-${playerIndex}-${Date.now()}-${Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')}`;
}
function waitForIceGatheringComplete(peerConnection) {
    if (peerConnection.iceGatheringState === 'complete') {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        const listener = () => {
            if (peerConnection.iceGatheringState !== 'complete') {
                return;
            }
            peerConnection.removeEventListener('icegatheringstatechange', listener);
            resolve();
        };
        peerConnection.addEventListener('icegatheringstatechange', listener);
    });
}
class WebRtcGhostSync {
    constructor() {
        this.enabled = false;
        this.room = '';
        this.localPlayerIndex = 0;
        this.connected = false;
        this.startPromise = null;
        this.peerConnection = null;
        this.dataChannel = null;
        this.broadcastChannel = null;
        this.latestSnapshot = null;
        this.seq = 0;
        this.lastReceivedSeq = 0;
        this.lastSendLogAt = 0;
        this.lastReceiveLogAt = 0;
        this.signalTransport = null;
        this.unsubscribeSignalTransport = null;
        this.activeOfferSessionId = '';
        this.acceptedAnswerSessionId = '';
        this.answeredOfferSessionIds = new Set();
        this.reconnectTimer = null;
        this.publishingOffer = false;
        this.packetListeners = new Set();
        this.connectionListeners = new Set();
    }
    static getInstance() {
        if (WebRtcGhostSync.instance === null) {
            WebRtcGhostSync.instance = new WebRtcGhostSync();
        }
        return WebRtcGhostSync.instance;
    }
    configureFromLocation(localPlayerIndex, location = window.location) {
        const params = new URLSearchParams(location.search);
        const flagValue = params.get(GHOST_PARAM) ??
            params.get(GHOST_PARAM_LOWERCASE) ??
            params.get(GHOST_PARAM_LEGACY_TYPO);
        const matchRoom = normalizeRoom(params.get(MATCH_PARAM) || '');
        this.enabled =
            flagValue !== null &&
                isEnabledValue(normalizeRoom(flagValue)) &&
                (0, shared_1.isMatchId)(matchRoom);
        this.room = this.enabled ? matchRoom : '';
        this.localPlayerIndex = localPlayerIndex;
        this.configureBroadcastChannel();
        this.configureConsoleApi();
    }
    configureDirect(enabled, room, localPlayerIndex) {
        const normalizedRoom = normalizeRoom(room);
        this.enabled = enabled && (0, shared_1.isMatchId)(normalizedRoom);
        this.room = this.enabled ? normalizedRoom : '';
        this.localPlayerIndex = localPlayerIndex;
        this.configureBroadcastChannel();
        this.configureConsoleApi();
    }
    isEnabled() {
        return this.enabled && this.room !== '';
    }
    isConnected() {
        return (this.isEnabled() &&
            this.connected &&
            this.dataChannel?.readyState === 'open');
    }
    start() {
        if (!this.isEnabled()) {
            return;
        }
        if (this.startPromise !== null) {
            return;
        }
        this.startPromise = this.startInternal().catch((error) => {
            log('start failed', error);
            console.error(error);
        });
    }
    sendSnapshot(tank) {
        if (!this.isEnabled()) {
            return;
        }
        this.start();
        const packet = {
            type: 'battlecity-ghost',
            seq: ++this.seq,
            sentAt: Date.now(),
            senderPlayerIndex: this.localPlayerIndex,
            tank,
        };
        this.sendPacket(packet);
    }
    sendPacket(packet) {
        if (!this.isEnabled()) {
            return;
        }
        this.start();
        this.broadcastChannel?.postMessage(packet);
        this.sendDataChannelPacket(packet);
    }
    sendWebRtcPacket(packet) {
        if (!this.isEnabled()) {
            return false;
        }
        this.start();
        return this.sendDataChannelPacket(packet);
    }
    sendDataChannelPacket(packet) {
        if (this.dataChannel === null ||
            this.dataChannel.readyState !== 'open') {
            return false;
        }
        if (this.dataChannel.bufferedAmount > MAX_BUFFERED_AMOUNT_BYTES) {
            const now = Date.now();
            if (now - this.lastSendLogAt > 1000) {
                this.lastSendLogAt = now;
                log('data channel congested; dropping realtime packet', {
                    bufferedAmount: this.dataChannel.bufferedAmount,
                });
            }
            return false;
        }
        this.dataChannel.send(JSON.stringify(packet));
        return true;
    }
    getLatestSnapshot() {
        if (!this.isEnabled()) {
            return null;
        }
        return this.latestSnapshot;
    }
    setSignalTransport(transport) {
        this.unsubscribeSignalTransport?.();
        this.signalTransport = transport;
        this.unsubscribeSignalTransport = transport.subscribe((code, kind) => {
            this.handleTransportSignal(code, kind);
        });
        this.startTransportSignaling();
    }
    subscribePackets(callback) {
        this.packetListeners.add(callback);
        return () => {
            this.packetListeners.delete(callback);
        };
    }
    subscribeConnection(callback) {
        this.connectionListeners.add(callback);
        callback(this.isConnected());
        return () => {
            this.connectionListeners.delete(callback);
        };
    }
    async createOfferCode() {
        this.assertEnabled();
        this.activeOfferSessionId = createSignalSessionId(this.room, this.localPlayerIndex);
        this.acceptedAnswerSessionId = '';
        this.resetPeerConnection();
        const peerConnection = this.ensurePeerConnection();
        const dataChannel = peerConnection.createDataChannel(DATA_CHANNEL_LABEL, {
            ordered: true,
        });
        this.attachDataChannel(dataChannel);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        await waitForIceGatheringComplete(peerConnection);
        const code = this.createSignalCode(peerConnection.localDescription, this.activeOfferSessionId);
        log('offer code created', {
            room: this.room,
            localPlayerIndex: this.localPlayerIndex,
            signalSessionId: this.activeOfferSessionId,
        });
        return code;
    }
    async pasteOfferCode(code) {
        this.assertEnabled();
        const signal = decodeSignalCode(code);
        this.validateSignal(signal, 'offer');
        this.resetPeerConnection();
        const peerConnection = this.ensurePeerConnection();
        await peerConnection.setRemoteDescription(signal.description);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await waitForIceGatheringComplete(peerConnection);
        const answerCode = this.createSignalCode(peerConnection.localDescription, signal.signalSessionId);
        log('answer code created', {
            room: this.room,
            localPlayerIndex: this.localPlayerIndex,
            remotePlayerIndex: signal.fromPlayerIndex,
            signalSessionId: signal.signalSessionId,
        });
        return answerCode;
    }
    async pasteAnswerCode(code) {
        this.assertEnabled();
        const signal = decodeSignalCode(code);
        this.validateSignal(signal, 'answer');
        if (this.peerConnection === null) {
            throw new Error('Create an offer code before pasting an answer code.');
        }
        if (signal.signalSessionId !== this.activeOfferSessionId) {
            throw new Error('Answer code does not match the active offer.');
        }
        await this.peerConnection.setRemoteDescription(signal.description);
        log('answer code accepted', {
            room: this.room,
            localPlayerIndex: this.localPlayerIndex,
            remotePlayerIndex: signal.fromPlayerIndex,
            signalSessionId: signal.signalSessionId,
        });
    }
    async startInternal() {
        this.configureConsoleApi();
        log('manual signaling ready', {
            room: this.room,
            localPlayerIndex: this.localPlayerIndex,
            api: 'window.battleCityGhostMirror',
        });
        this.startTransportSignaling();
    }
    startTransportSignaling() {
        if (!this.isEnabled() ||
            this.signalTransport === null) {
            return;
        }
        if (this.localPlayerIndex !== 0) {
            log('waiting for signaling offer');
            return;
        }
        this.startOfferCycle('initial');
    }
    async handleTransportSignal(code, kind) {
        try {
            const signal = decodeSignalCode(code);
            if (kind === 'offer') {
                if (this.localPlayerIndex !== 1 ||
                    signal.description.type !== 'offer' ||
                    this.answeredOfferSessionIds.has(signal.signalSessionId)) {
                    return;
                }
                const answer = await this.pasteOfferCode(code);
                await this.publishTransportSignal(answer, 'answer');
                this.answeredOfferSessionIds.add(signal.signalSessionId);
                return;
            }
            if (this.localPlayerIndex !== 0 ||
                signal.description.type !== 'answer' ||
                signal.signalSessionId !== this.activeOfferSessionId ||
                signal.signalSessionId === this.acceptedAnswerSessionId ||
                this.peerConnection === null) {
                return;
            }
            await this.pasteAnswerCode(code);
            this.acceptedAnswerSessionId = signal.signalSessionId;
        }
        catch (error) {
            log('signaling message handling failed', error);
        }
    }
    async publishTransportSignal(code, kind) {
        if (this.signalTransport === null) {
            return;
        }
        await this.signalTransport.publishSignal(code, kind);
        log(`signaling ${kind} published`);
    }
    startOfferCycle(reason) {
        if (this.localPlayerIndex !== 0 ||
            this.signalTransport === null ||
            this.publishingOffer) {
            return;
        }
        this.publishingOffer = true;
        this.clearReconnectTimer();
        this.createOfferCode()
            .then((code) => this.publishTransportSignal(code, 'offer'))
            .then(() => {
            log('signaling offer cycle started', {
                reason,
                signalSessionId: this.activeOfferSessionId,
            });
        })
            .catch((error) => {
            log('signaling offer cycle failed', error);
            this.scheduleReconnect();
        })
            .finally(() => {
            this.publishingOffer = false;
        });
    }
    scheduleReconnect() {
        if (this.localPlayerIndex !== 0 ||
            this.signalTransport === null ||
            this.reconnectTimer !== null) {
            return;
        }
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.connected) {
                this.startOfferCycle('reconnect');
            }
        }, RECONNECT_DELAY_MS);
    }
    clearReconnectTimer() {
        if (this.reconnectTimer === null) {
            return;
        }
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
    }
    ensurePeerConnection() {
        if (this.peerConnection !== null) {
            return this.peerConnection;
        }
        const peerConnection = createPeerConnection();
        this.peerConnection = peerConnection;
        peerConnection.ondatachannel = (event) => {
            this.attachDataChannel(event.channel);
        };
        peerConnection.onconnectionstatechange = () => {
            this.connected = peerConnection.connectionState === 'connected';
            log('peer connection state', {
                state: peerConnection.connectionState,
                iceState: peerConnection.iceConnectionState,
            });
            if (peerConnection.connectionState === 'failed' ||
                peerConnection.connectionState === 'disconnected') {
                this.connected = false;
                this.scheduleReconnect();
            }
        };
        peerConnection.oniceconnectionstatechange = () => {
            this.connected = peerConnection.iceConnectionState === 'connected';
            log('ice connection state', {
                state: peerConnection.iceConnectionState,
            });
            if (peerConnection.iceConnectionState === 'failed' ||
                peerConnection.iceConnectionState === 'disconnected') {
                this.connected = false;
                this.scheduleReconnect();
            }
        };
        return peerConnection;
    }
    attachDataChannel(dataChannel) {
        this.dataChannel = dataChannel;
        dataChannel.onopen = () => {
            this.connected = true;
            this.clearReconnectTimer();
            log('data channel open', {
                room: this.room,
                localPlayerIndex: this.localPlayerIndex,
            });
            this.notifyConnectionChanged();
        };
        dataChannel.onmessage = (event) => {
            try {
                this.acceptPacket(JSON.parse(event.data));
            }
            catch (error) {
                log('data channel packet parse failed', error);
            }
        };
        dataChannel.onclose = () => {
            this.connected = false;
            log('data channel closed');
            this.scheduleReconnect();
            this.notifyConnectionChanged();
        };
        dataChannel.onerror = (event) => {
            log('data channel error', event);
            this.scheduleReconnect();
            this.notifyConnectionChanged();
        };
    }
    notifyConnectionChanged() {
        const connected = this.isConnected();
        this.connectionListeners.forEach((listener) => {
            listener(connected);
        });
    }
    stop() {
        this.enabled = false;
        this.unsubscribeSignalTransport?.();
        this.unsubscribeSignalTransport = null;
        this.signalTransport = null;
        this.resetPeerConnection();
        this.broadcastChannel?.close();
        this.broadcastChannel = null;
    }
    createSignalCode(description, signalSessionId) {
        if (description === null || description === undefined) {
            throw new Error('Missing local WebRTC description.');
        }
        return encodeSignalCode({
            type: 'battlecity-ghost-signal',
            version: 1,
            room: this.room,
            signalSessionId,
            createdAt: Date.now(),
            fromPlayerIndex: this.localPlayerIndex,
            description: {
                type: description.type,
                sdp: description.sdp,
            },
        });
    }
    validateSignal(signal, expectedType) {
        if (signal.room !== this.room) {
            throw new Error(`Signal code is for room ${signal.room}, current room is ${this.room}.`);
        }
        if (signal.fromPlayerIndex === this.localPlayerIndex) {
            throw new Error('Signal code was created by this same player.');
        }
        if (signal.description.type !== expectedType) {
            throw new Error(`Expected ${expectedType} code, got ${signal.description.type}.`);
        }
        if (typeof signal.signalSessionId !== 'string' ||
            signal.signalSessionId === '') {
            throw new Error('Signal code is missing signalSessionId.');
        }
    }
    resetPeerConnection() {
        this.clearReconnectTimer();
        if (this.dataChannel !== null) {
            this.dataChannel.onopen = null;
            this.dataChannel.onmessage = null;
            this.dataChannel.onclose = null;
            this.dataChannel.onerror = null;
            this.dataChannel.close();
        }
        if (this.peerConnection !== null) {
            this.peerConnection.ondatachannel = null;
            this.peerConnection.onconnectionstatechange = null;
            this.peerConnection.oniceconnectionstatechange = null;
            this.peerConnection.close();
        }
        this.dataChannel = null;
        this.peerConnection = null;
        this.connected = false;
        this.notifyConnectionChanged();
    }
    assertEnabled() {
        if (!this.isEnabled()) {
            throw new Error('Ghost mirror is not enabled. Add ghostMirror=1.');
        }
    }
    configureBroadcastChannel() {
        this.broadcastChannel?.close();
        this.broadcastChannel = null;
        if (!this.isEnabled() || window.BroadcastChannel === undefined) {
            return;
        }
        this.broadcastChannel = new BroadcastChannel(`${BROADCAST_PREFIX}-${this.room}`);
        this.broadcastChannel.onmessage = (event) => {
            this.acceptPacket(event.data);
        };
        log('local tab fallback active', {
            room: this.room,
            localPlayerIndex: this.localPlayerIndex,
        });
    }
    configureConsoleApi() {
        if (!this.isEnabled()) {
            if (window.battleCityGhostMirror !== undefined) {
                delete window.battleCityGhostMirror;
            }
            return;
        }
        window.battleCityGhostMirror = {
            createOfferCode: () => this.createOfferCode(),
            pasteOfferCode: (code) => this.pasteOfferCode(code),
            pasteAnswerCode: (code) => this.pasteAnswerCode(code),
            close: () => this.resetPeerConnection(),
            status: () => ({
                enabled: this.isEnabled(),
                room: this.room,
                localPlayerIndex: this.localPlayerIndex,
                connected: this.connected,
                channelState: this.dataChannel?.readyState ?? 'none',
            }),
        };
    }
    acceptPacket(data) {
        if (data === null || typeof data !== 'object') {
            return;
        }
        this.packetListeners.forEach((listener) => {
            listener(data);
        });
        if (data?.type !== 'battlecity-ghost') {
            return;
        }
        if (data.senderPlayerIndex === this.localPlayerIndex) {
            return;
        }
        if (data.tank?.partyIndex === this.localPlayerIndex) {
            return;
        }
        if (typeof data.seq !== 'number' || data.seq <= this.lastReceivedSeq) {
            return;
        }
        this.lastReceivedSeq = data.seq;
        this.latestSnapshot = data.tank;
        const now = Date.now();
        if (now - this.lastReceiveLogAt > 1000) {
            this.lastReceiveLogAt = now;
            log('snapshot received', {
                player: data.tank.partyIndex,
                seq: data.seq,
            });
        }
    }
}
exports.WebRtcGhostSync = WebRtcGhostSync;
WebRtcGhostSync.instance = null;
