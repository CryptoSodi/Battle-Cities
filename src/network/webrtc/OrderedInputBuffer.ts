const DEFAULT_MAX_PENDING_INPUTS = 240;

export class OrderedInputBuffer<T extends { seq: number }> {
  private readonly pending: T[] = [];
  private current: T | null = null;
  private lastReceivedSeq = 0;
  private lastReceivedAt = 0;

  public constructor(
    private readonly maxPendingInputs = DEFAULT_MAX_PENDING_INPUTS,
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
