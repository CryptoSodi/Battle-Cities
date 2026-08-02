const assert = require('assert');

const {
  calculateHalfLatencyDelayTicks,
  HalfLatencyInputBuffer,
} = require(
  '../dist-broadcaster/src/network/webrtc/HalfLatencyInputBuffer.js'
);

assert.strictEqual(
  calculateHalfLatencyDelayTicks(200, 1 / 60),
  6,
  'a 200 ms RTT must delay local input by six 60 Hz ticks',
);
assert.strictEqual(
  calculateHalfLatencyDelayTicks(null, 1 / 60),
  6,
  'input delay must use the 200 ms fallback before the first RTT probe',
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

console.log('half-latency input scheduler: ok');
