const assert = require('assert');

const {
  calculateLatencyDelayTicks,
  HalfLatencyInputBuffer,
} = require(
  '../dist-broadcaster/src/network/webrtc/HalfLatencyInputBuffer.js'
);

assert.strictEqual(
  calculateLatencyDelayTicks(200, 1 / 60, 1 / 2),
  6,
  'a 200 ms RTT must delay local input by six 60 Hz ticks',
);
assert.strictEqual(
  calculateLatencyDelayTicks(200, 1 / 60, 2 / 3),
  8,
  'two-thirds of a 200 ms RTT must delay input by eight 60 Hz ticks',
);
assert.strictEqual(
  calculateLatencyDelayTicks(null, 1 / 60, 2 / 3),
  8,
  'two-thirds input delay must use the 200 ms fallback before the first RTT probe',
);

{
  const buffer = new HalfLatencyInputBuffer();
  buffer.schedule('right', 10, 6);
  assert.strictEqual(buffer.consume(15), null);
  assert.strictEqual(buffer.consume(16), 'right');
  assert.strictEqual(buffer.consume(17), null);
}

{
  const buffer = new HalfLatencyInputBuffer();
  buffer.schedule('up', 0, 10);
  buffer.schedule('right', 1, 5);
  assert.strictEqual(
    buffer.consume(6),
    'right',
    'the latest due control state must supersede stale samples',
  );
  assert.strictEqual(buffer.consume(10), null);
}

{
  const buffer = new HalfLatencyInputBuffer();
  buffer.schedule('left', 0, 2);
  buffer.clear();
  assert.strictEqual(buffer.consume(2), null);
}

console.log('latency input scheduler: ok');
