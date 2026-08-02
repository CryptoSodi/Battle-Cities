const DEFAULT_MAX_PENDING_INPUTS = 240;
const DEFAULT_MAX_REALTIME_BACKLOG = 6;

export class OrderedInputBuffer<T extends { seq: number }> {
  private readonly pending: T[] = [];
  private current: T | null = null;
  private lastReceivedSeq = 0;
  private lastReceivedAt = 0;

  public constructor(
    private readonly maxPendingInputs = DEFAULT_MAX_PENDING_INPUTS,
    private readonly maxRealtimeBacklog = DEFAULT_MAX_REALTIME_BACKLOG,
  ) {}

  public accept(input: T, receivedAt = Date.now()): boolean {
    if (
      !Number.isInteger(input.seq) ||
      input.seq <= this.lastReceivedSeq ||
      this.pending.length >= this.maxPendingInputs
    ) {
      return false;
    }

    this.pending.push(input);
    this.lastReceivedSeq = input.seq;
    this.lastReceivedAt = receivedAt;
    return true;
  }

  public consumeNext(): T | null {
    // Input packets are sampled control state, not movement transactions. If
    // jitter or timer drift leaves us more than a few ticks behind, replaying
    // every old sample would make the authoritative tank permanently lag the
    // player. Keep short bursts ordered, but catch up to the newest state once
    // the queue exceeds the realtime latency budget.
    if (this.pending.length > this.maxRealtimeBacklog) {
      this.current = this.pending[this.pending.length - 1];
      this.pending.length = 0;
      return this.current;
    }

    const next = this.pending.shift();
    if (next !== undefined) {
      this.current = next;
    }
    return this.current;
  }

  public isStale(now: number, timeoutMs: number): boolean {
    return this.lastReceivedAt <= 0 || now - this.lastReceivedAt > timeoutMs;
  }

  public clear(): void {
    this.pending.length = 0;
    this.current = null;
    this.lastReceivedSeq = 0;
    this.lastReceivedAt = 0;
  }
}
