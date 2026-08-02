const DEFAULT_RTT_MS = 200;
const MAX_INPUT_DELAY_MS = 250;
const MAX_PENDING_INPUTS = 240;

interface ScheduledInput<T> {
  input: T;
  applyTick: number;
}

export function calculateLatencyDelayTicks(
  rttMs: number | null,
  deltaTime: number,
  rttFraction: number,
): number {
  const effectiveRttMs =
    rttMs !== null && Number.isFinite(rttMs) && rttMs >= 0
      ? rttMs
      : DEFAULT_RTT_MS;
  const tickMs = Math.max(1, deltaTime * 1000);
  const boundedRttFraction = Math.min(1, Math.max(0, rttFraction));
  const delayMs = Math.min(
    effectiveRttMs * boundedRttFraction,
    MAX_INPUT_DELAY_MS,
  );
  return Math.max(0, Math.round(delayMs / tickMs));
}

export class HalfLatencyInputBuffer<T> {
  private readonly pending: ScheduledInput<T>[] = [];

  public schedule(input: T, currentTick: number, delayTicks: number): void {
    this.pending.push({
      input,
      applyTick: currentTick + Math.max(0, Math.floor(delayTicks)),
    });
    if (this.pending.length > MAX_PENDING_INPUTS) {
      this.pending.splice(0, this.pending.length - MAX_PENDING_INPUTS);
    }
  }

  public consume(currentTick: number): T | null {
    let latestDueIndex = -1;
    for (let index = 0; index < this.pending.length; index += 1) {
      if (this.pending[index].applyTick <= currentTick) {
        latestDueIndex = index;
      }
    }
    if (latestDueIndex < 0) {
      return null;
    }

    const input = this.pending[latestDueIndex].input;
    this.pending.splice(0, latestDueIndex + 1);
    return input;
  }

  public clear(): void {
    this.pending.length = 0;
  }
}
