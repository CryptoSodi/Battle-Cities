"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketMatchLink = void 0;
const RECONNECT_DELAY_MS = 1500;
const MAX_BUFFERED_AMOUNT_BYTES = 256 * 1024;
class WebSocketMatchLink {
    constructor(url) {
        this.url = url;
        this.socket = null;
        this.reconnectTimer = null;
        this.stopped = false;
        this.packetListeners = new Set();
        this.connectionListeners = new Set();
    }
    start() {
        if (this.stopped || this.socket !== null)
            return;
        const socket = new WebSocket(this.url);
        this.socket = socket;
        socket.onopen = () => this.notifyConnection(true);
        socket.onmessage = (event) => {
            try {
                const packet = JSON.parse(String(event.data));
                this.packetListeners.forEach((listener) => listener(packet));
            }
            catch (error) {
                console.warn('[websocket-match] ignored invalid packet', error);
            }
        };
        socket.onclose = () => {
            if (this.socket === socket)
                this.socket = null;
            this.notifyConnection(false);
            this.scheduleReconnect();
        };
        socket.onerror = () => socket.close();
    }
    stop() {
        this.stopped = true;
        if (this.reconnectTimer !== null)
            window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        const socket = this.socket;
        this.socket = null;
        socket?.close(1000, 'client stopped');
        this.notifyConnection(false);
    }
    sendWebRtcPacket(packet) {
        if (this.socket?.readyState !== WebSocket.OPEN ||
            this.socket.bufferedAmount > MAX_BUFFERED_AMOUNT_BYTES) {
            return false;
        }
        this.socket.send(JSON.stringify(packet));
        return true;
    }
    subscribePackets(callback) {
        this.packetListeners.add(callback);
        return () => this.packetListeners.delete(callback);
    }
    subscribeConnection(callback) {
        this.connectionListeners.add(callback);
        callback(this.socket?.readyState === WebSocket.OPEN);
        return () => this.connectionListeners.delete(callback);
    }
    scheduleReconnect() {
        if (this.stopped || this.reconnectTimer !== null)
            return;
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.start();
        }, RECONNECT_DELAY_MS);
    }
    notifyConnection(connected) {
        this.connectionListeners.forEach((listener) => listener(connected));
    }
}
exports.WebSocketMatchLink = WebSocketMatchLink;
