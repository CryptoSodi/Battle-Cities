// A single tick's worth of raw device output -- exactly what InputDevice
// exposes (down/hold/up key codes, in order). Order matters: InputMethod's
// isHoldFirst/isHoldLast/getHoldLastIndex resolve ties (e.g. which direction
// key wins when two are held) by position in the hold array, so a recording
// must capture these arrays verbatim, not a simplified "is this code down"
// set, or a replay could resolve a tie differently than the original run.
export interface DeviceInputFrame {
  down: number[];
  hold: number[];
  up: number[];
}
