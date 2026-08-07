import type { WebRtcDataPacket } from '../webrtc/WebRtcGhostSync';
import type { MatchTransportLink } from './WebSocketMatchLink';

const DEFAULT_BATCH_LIMIT = 200;

/**
 * Replays the archived frames of a finished match straight from the API
 * instead of opening a live websocket. Emits the same replay packet sequence
 * (`webrtc-replay-start` -> frames -> `webrtc-replay-complete`) that the
 * websocket observer transport uses, so the existing replay path on the
 * client consumes it unchanged. Frames are paced in real time by wall-clock
 * elapsed seconds to avoid fast-forwarding.
 */
export class ArchiveMatchLink implements MatchTransportLink {
  private stopped = false;
  private readonly timers: number[] = [];
  private readonly packetListeners = new Set<(packet: WebRtcDataPacket) => void>();
  private readonly connectionListeners = new Set<(connected: boolean) => void>();

  public constructor(
    private readonly apiBaseUrl: string,
    private readonly matchId: string,
    private readonly ticket: string,
  ) {}

  public start(): void {
    if (this.stopped) return;
    this.notifyConnection(true);
    void this.loadAndPlay();
  }

  public stop(): void {
    this.stopped = true;
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.length = 0;
    this.notifyConnection(false);
  }

  public sendWebRtcPacket(_packet: WebRtcDataPacket): boolean {
    // Archive replay is one-way; there is nothing to send upstream.
    return false;
  }

  public subscribePackets(
    callback: (packet: WebRtcDataPacket) => void,
  ): () => void {
    this.packetListeners.add(callback);
    return () => this.packetListeners.delete(callback);
  }

  public subscribeConnection(
    callback: (connected: boolean) => void,
  ): () => void {
    this.connectionListeners.add(callback);
    return () => this.connectionListeners.delete(callback);
  }

  private async loadAndPlay(): Promise<void> {
    try {
      const totalFrames = await this.loadFrameCount();
      const frames = await this.loadAllFrames();
      if (this.stopped || frames.length === 0) return;

      const targetSeq = totalFrames > 0 ? totalFrames : frames[frames.length - 1].seq;
      this.emit({ type: 'webrtc-ready', ready: true });
      this.emit({
        type: 'webrtc-replay-start',
        fromSeq: frames[0].seq,
        targetSeq,
      });

      this.scheduleReplayFrames(frames);
    } catch (error) {
      console.warn('[archive-match] replay load failed', this.matchId, error);
      this.notifyConnection(false);
    }
  }

  private async loadFrameCount(): Promise<number> {
    const response = await fetch(this.archiveUrl());
    if (!response.ok) return 0;
    const data = await response.json();
    return Number(data?.item?.frameCount ?? 0);
  }

  private async loadAllFrames(): Promise<any[]> {
    const frames: any[] = [];
    let afterSeq = 0;
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      if (this.stopped) break;
      const page = await this.fetchFrames(afterSeq);
      const batch = page?.frames ?? [];
      if (batch.length === 0) break;
      frames.push(...batch);
      if (!page.hasMore) break;
      const lastSeq = Number(batch[batch.length - 1]?.seq);
      const next = Number(page.nextAfterSeq);
      if (!Number.isFinite(next) || next <= afterSeq) {
        afterSeq = Number.isFinite(lastSeq) ? lastSeq : afterSeq;
      } else {
        afterSeq = next;
      }
    }
    return frames;
  }

  private async fetchFrames(afterSeq: number): Promise<any> {
    const url = new URL(this.archiveUrl(`/frames`));
    url.searchParams.set('afterSeq', String(afterSeq));
    url.searchParams.set('batchLimit', String(DEFAULT_BATCH_LIMIT));
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`frames request failed (${response.status})`);
    }
    const data = await response.json();
    return data.ok ? data : data;
  }

  private archiveUrl(action = ''): string {
    const url = new URL(
      `${this.apiBaseUrl}/api/multiplayer/archives/${encodeURIComponent(this.matchId)}${action}`,
    );
    url.searchParams.set('ticket', this.ticket);
    return url.toString();
  }

  private scheduleReplayFrames(frames: any[]): void {
    const startWall = performance.now();
    const firstElapsed = Number(frames[0]?.sharedElapsedSeconds ?? 0);
    const lastElapsed = Number(frames[frames.length - 1]?.sharedElapsedSeconds ?? 0);

    frames.forEach((frame) => {
      const elapsed = Number(frame.sharedElapsedSeconds ?? 0);
      const delay = (elapsed - firstElapsed) * 1000;
      const timer = window.setTimeout(() => {
        if (this.stopped) return;
        this.emit(frame);
      }, Math.max(0, delay - (performance.now() - startWall)));
      this.timers.push(timer);
    });

    const completeIn = Math.max(0, (lastElapsed - firstElapsed) * 1000 + 40);
    const completeTimer = window.setTimeout(() => {
      if (this.stopped) return;
      this.emit({
        type: 'webrtc-replay-complete',
        targetSeq: Number(frames[frames.length - 1].seq),
      });
    }, completeIn - (performance.now() - startWall));
    this.timers.push(completeTimer);
  }

  private emit(packet: WebRtcDataPacket): void {
    this.packetListeners.forEach((listener) => listener(packet));
  }

  private notifyConnection(connected: boolean): void {
    this.connectionListeners.forEach((listener) => listener(connected));
  }
}