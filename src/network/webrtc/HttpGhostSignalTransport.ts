import {
  WebRtcGhostSignalKind,
  WebRtcGhostSignalTransport,
} from './WebRtcGhostSync';

interface HttpSignalResponse {
  ok: boolean;
  signal: {
    id: number;
    code: string;
    kind: WebRtcGhostSignalKind;
  } | null;
}

const POLL_INTERVAL_MS = 750;

export class HttpGhostSignalTransport implements WebRtcGhostSignalTransport {
  private readonly room: string;
  private readonly localPlayerIndex: number;
  private readonly remotePlayerIndex: number;
  private readonly lastSeenSignalIds = new Map<WebRtcGhostSignalKind, number>();

  constructor(room: string, localPlayerIndex: number) {
    this.room = room;
    this.localPlayerIndex = localPlayerIndex;
    this.remotePlayerIndex = 1 - localPlayerIndex;
  }

  public async publishSignal(
    code: string,
    kind: WebRtcGhostSignalKind,
  ): Promise<void> {
    const response = await fetch(
      this.signalUrl(this.localPlayerIndex, kind).toString(),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ code }),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP WebRTC signal publish failed: ${response.status}`);
    }
  }

  public subscribe(
    callback: (code: string, kind: WebRtcGhostSignalKind) => void,
  ): () => void {
    let disposed = false;
    let timer: number = null;

    const poll = async (): Promise<void> => {
      try {
        await Promise.all([
          this.pollKind('offer', callback),
          this.pollKind('answer', callback),
        ]);
      } catch (error) {
        console.warn('[webrtc-ghost] HTTP signal poll failed', error);
      } finally {
        if (!disposed) {
          timer = window.setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    };

    void poll();

    return (): void => {
      disposed = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }

  private async pollKind(
    kind: WebRtcGhostSignalKind,
    callback: (code: string, kind: WebRtcGhostSignalKind) => void,
  ): Promise<void> {
    const lastSeenId = this.lastSeenSignalIds.get(kind) ?? 0;
    const url = this.signalUrl(this.remotePlayerIndex, kind);
    url.searchParams.set('after', lastSeenId.toString());

    const response = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP WebRTC signal poll failed: ${response.status}`);
    }

    const body = (await response.json()) as HttpSignalResponse;
    if (body.signal === null || body.signal.id <= lastSeenId) {
      return;
    }

    this.lastSeenSignalIds.set(kind, body.signal.id);
    callback(body.signal.code, body.signal.kind);
  }

  private signalUrl(
    playerIndex: number,
    kind: WebRtcGhostSignalKind,
  ): URL {
    return new URL(
      `/api/webrtc/matches/${encodeURIComponent(
        this.room,
      )}/players/${playerIndex}/signals/${kind}`,
      window.location.origin,
    );
  }
}
