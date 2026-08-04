import type { WebRtcDataPacket } from '../webrtc/WebRtcGhostSync';

const RECONNECT_DELAY_MS = 1500;
const MAX_BUFFERED_AMOUNT_BYTES = 256 * 1024;

export interface MatchTransportLink {
  start(): void;
  stop(): void;
  sendWebRtcPacket(packet: WebRtcDataPacket): boolean;
  subscribePackets(callback: (packet: WebRtcDataPacket) => void): () => void;
  subscribeConnection(callback: (connected: boolean) => void): () => void;
}

export class WebSocketMatchLink implements MatchTransportLink {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private stopped = false;
  private readonly packetListeners = new Set<(packet: WebRtcDataPacket) => void>();
  private readonly connectionListeners = new Set<(connected: boolean) => void>();

  public constructor(private readonly url: string) {}

  public start(): void {
    if (this.stopped || this.socket !== null) return;
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onopen = () => this.notifyConnection(true);
    socket.onmessage = (event) => {
      try {
        const packet = JSON.parse(String(event.data));
        this.packetListeners.forEach((listener) => listener(packet));
      } catch (error) {
        console.warn('[websocket-match] ignored invalid packet', error);
      }
    };
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.notifyConnection(false);
      this.scheduleReconnect();
    };
    socket.onerror = () => socket.close();
  }

  public stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, 'client stopped');
    this.notifyConnection(false);
  }

  public sendWebRtcPacket(packet: WebRtcDataPacket): boolean {
    if (
      this.socket?.readyState !== WebSocket.OPEN ||
      this.socket.bufferedAmount > MAX_BUFFERED_AMOUNT_BYTES
    ) {
      return false;
    }
    this.socket.send(JSON.stringify(packet));
    return true;
  }

  public subscribePackets(callback: (packet: WebRtcDataPacket) => void): () => void {
    this.packetListeners.add(callback);
    return () => this.packetListeners.delete(callback);
  }

  public subscribeConnection(callback: (connected: boolean) => void): () => void {
    this.connectionListeners.add(callback);
    callback(this.socket?.readyState === WebSocket.OPEN);
    return () => this.connectionListeners.delete(callback);
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.start();
    }, RECONNECT_DELAY_MS);
  }

  private notifyConnection(connected: boolean): void {
    this.connectionListeners.forEach((listener) => listener(connected));
  }
}
