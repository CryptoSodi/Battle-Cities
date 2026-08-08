"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchiveMatchLink = void 0;
const DEFAULT_BATCH_LIMIT = 200;
/**
 * Replays the archived frames of a finished match straight from the API
 * instead of opening a live websocket. Emits the same replay packet sequence
 * (`webrtc-replay-start` -> frames -> `webrtc-replay-complete`) that the
 * websocket observer transport uses, so the existing replay path on the
 * client consumes it unchanged. Frames are paced in real time by wall-clock
 * elapsed seconds to avoid fast-forwarding.
 */
class ArchiveMatchLink {
    constructor(apiBaseUrl, matchId, ticket) {
        this.apiBaseUrl = apiBaseUrl;
        this.matchId = matchId;
        this.ticket = ticket;
        this.stopped = false;
        this.timers = [];
        this.packetListeners = new Set();
        this.connectionListeners = new Set();
    }
    start() {
        if (this.stopped)
            return;
        this.notifyConnection(true);
        void this.loadAndPlay();
    }
    stop() {
        this.stopped = true;
        this.timers.forEach((timer) => window.clearTimeout(timer));
        this.timers.length = 0;
        this.notifyConnection(false);
    }
    sendWebRtcPacket(_packet) {
        // Archive replay is one-way; there is nothing to send upstream.
        return false;
    }
    subscribePackets(callback) {
        this.packetListeners.add(callback);
        return () => this.packetListeners.delete(callback);
    }
    subscribeConnection(callback) {
        this.connectionListeners.add(callback);
        return () => this.connectionListeners.delete(callback);
    }
    async loadAndPlay() {
        try {
            const totalFrames = await this.loadFrameCount();
            const frames = await this.loadAllFrames();
            if (this.stopped || frames.length === 0)
                return;
            const targetSeq = totalFrames > 0 ? totalFrames : frames[frames.length - 1].seq;
            this.emit({ type: 'webrtc-ready', ready: true });
            this.emit({
                type: 'webrtc-replay-start',
                fromSeq: frames[0].seq,
                targetSeq,
            });
            this.scheduleReplayFrames(frames);
        }
        catch (error) {
            console.warn('[archive-match] replay load failed', this.matchId, error);
            this.notifyConnection(false);
        }
    }
    async loadFrameCount() {
        const response = await fetch(this.archiveUrl());
        if (!response.ok)
            return 0;
        const data = await response.json();
        return Number(data?.item?.frameCount ?? 0);
    }
    async loadAllFrames() {
        const frames = [];
        let afterSeq = 0;
        for (let attempt = 0; attempt < 1000; attempt += 1) {
            if (this.stopped)
                break;
            const page = await this.fetchFrames(afterSeq);
            const batch = page?.frames ?? [];
            if (batch.length === 0)
                break;
            frames.push(...batch);
            if (!page.hasMore)
                break;
            const lastSeq = Number(batch[batch.length - 1]?.seq);
            const next = Number(page.nextAfterSeq);
            if (!Number.isFinite(next) || next <= afterSeq) {
                afterSeq = Number.isFinite(lastSeq) ? lastSeq : afterSeq;
            }
            else {
                afterSeq = next;
            }
        }
        return frames;
    }
    async fetchFrames(afterSeq) {
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
    archiveUrl(action = '') {
        const url = new URL(`${this.apiBaseUrl}/api/multiplayer/archives/${encodeURIComponent(this.matchId)}${action}`);
        url.searchParams.set('ticket', this.ticket);
        return url.toString();
    }
    scheduleReplayFrames(frames) {
        const startWall = performance.now();
        let elapsedMs = 0;
        frames.forEach((frame) => {
            const delay = elapsedMs;
            const timer = window.setTimeout(() => {
                if (this.stopped)
                    return;
                this.emit(frame);
            }, Math.max(0, delay - (performance.now() - startWall)));
            this.timers.push(timer);
            const deltaTime = Number(frame.deltaTime);
            elapsedMs += Number.isFinite(deltaTime) && deltaTime > 0
                ? deltaTime * 1000
                : 1000 / 60;
        });
        const completeIn = elapsedMs + 40;
        const completeTimer = window.setTimeout(() => {
            if (this.stopped)
                return;
            this.emit({
                type: 'webrtc-replay-complete',
                targetSeq: Number(frames[frames.length - 1].seq),
            });
        }, completeIn - (performance.now() - startWall));
        this.timers.push(completeTimer);
    }
    emit(packet) {
        this.packetListeners.forEach((listener) => listener(packet));
    }
    notifyConnection(connected) {
        this.connectionListeners.forEach((listener) => listener(connected));
    }
}
exports.ArchiveMatchLink = ArchiveMatchLink;
