/// <reference path="../../../types/Window.d.ts" />
import test from 'ava';

import { Prng } from '../../utils/Prng';
import { InputBinding } from '../InputBinding';
import { InputControl } from '../../../input/InputControl';
import { InputMethod } from '../InputMethod';

import { InputRecorderDevice } from './InputRecorderDevice';
import { RecordedInputDevice } from './RecordedInputDevice';

// Exercises the real, unmodified PlayerTankBehavior -- the exact code that
// decides tank rotation/movement/firing every tick -- to prove that recording
// a run's input and replaying it through a fresh simulation reproduces the
// original tick-by-tick, not just the end result. This is the actual
// determinism guarantee tasks #1 (fixed timestep) and #2 (seeded Prng) exist
// to provide; this test is what proves the guarantee holds.
//
// A lightweight stand-in for PlayerTank is used instead of the real,
// rendering-heavy GameObject class -- PlayerTankBehavior only calls a handful
// of methods on it, so a duck-typed fake exercises the real decision logic
// without dragging in sprite/animation/collision machinery unrelated to what
// this test is proving.

import { PlayerTankBehavior } from '../../../tank/behaviors/PlayerTankBehavior';
import { TankState } from '../../../gameObjects/Tank';

// Arbitrary raw codes; a real binding maps InputControl to actual key codes,
// but any distinct numbers prove the same thing.
const CODE = {
  Up: 1,
  Down: 2,
  Left: 3,
  Right: 4,
  Fire: 5,
};

function makeBinding(): InputBinding {
  const binding = new InputBinding();
  binding.setDefault(InputControl.Up, CODE.Up);
  binding.setDefault(InputControl.Down, CODE.Down);
  binding.setDefault(InputControl.Left, CODE.Left);
  binding.setDefault(InputControl.Right, CODE.Right);
  binding.setDefault(InputControl.PrimaryAction, CODE.Fire);
  return binding;
}

// Hand-authored held-key script standing in for a live device's per-tick
// output. Deliberately holds two directions at once at ticks 8-9 (Up still
// held while Right is freshly pressed) to exercise the order-sensitive
// "most-recently-held direction wins" logic in PlayerTankBehavior -- the
// exact case a naive "which keys are down" recording (rather than the real
// ordered hold-code arrays) could replay incorrectly.
function buildScript(): { down: number[]; hold: number[]; up: number[] }[] {
  const frames: { down: number[]; hold: number[]; up: number[] }[] = [];
  const push = (down: number[], hold: number[], up: number[]): void => {
    frames.push({ down, hold, up });
  };

  push([CODE.Up], [], []); // tick 0: press Up
  for (let i = 0; i < 7; i += 1) {
    push([], [CODE.Up], []); // ticks 1-7: hold Up
  }
  push([CODE.Right], [CODE.Up, CODE.Right], []); // tick 8: also press Right (Right now most-recent)
  push([], [CODE.Up, CODE.Right], []); // tick 9: both still held
  push([CODE.Fire], [CODE.Up, CODE.Right], []); // tick 10: fire while moving
  push([], [], [CODE.Up, CODE.Right]); // tick 11: release both
  for (let i = 0; i < 4; i += 1) {
    push([], [], []); // ticks 12-15: idle
  }

  return frames;
}

interface FireEvent {
  tick: number;
  roll: number;
}

class FakeTank {
  public partyIndex = 0;
  public state: TankState = TankState.Idle;
  public rotation: number = null;
  public moveTicks = 0;
  public fireEvents: FireEvent[] = [];
  public idleTicks = 0;

  private rng: Prng;
  private tick = 0;

  constructor(rng: Prng) {
    this.rng = rng;
  }

  public setTick(tick: number): void {
    this.tick = tick;
  }

  public isSliding(): boolean {
    return false;
  }

  public isStunned(): boolean {
    return false;
  }

  public rotate(rotation: number): void {
    this.rotation = rotation;
  }

  public move(): void {
    this.state = TankState.Moving;
    this.moveTicks += 1;
  }

  public idle(): void {
    this.state = TankState.Idle;
    this.idleTicks += 1;
  }

  // Simulates a gameplay effect that consumes sim randomness on fire (e.g. a
  // damage roll) -- proves rng draws stay in lockstep with input-driven
  // events across a replay, not just that movement counters match.
  public fire(): boolean {
    this.fireEvents.push({ tick: this.tick, roll: this.rng.number(0, 1000) });
    return true;
  }
}

interface TickSnapshot {
  rotation: number;
  state: TankState;
  moveTicks: number;
  fireEvents: FireEvent[];
  idleTicks: number;
}

function runScenario(
  seed: number,
  script: { down: number[]; hold: number[]; up: number[] }[],
): { trace: TickSnapshot[]; recordedLog: ReturnType<InputRecorderDevice['getLog']> } {
  const rng = new Prng(seed);
  const sourceDevice = new RecordedInputDevice(script);
  const recorder = new InputRecorderDevice(sourceDevice);
  const binding = makeBinding();
  const inputMethod = new InputMethod(recorder, binding);

  // Minimal stand-ins for the two things PlayerTankBehavior reads besides the
  // tank: a single-player session (skips the multiplayer variant lookup) and
  // an InputManager exposing only getActiveMethod().
  const inputManager = { getActiveMethod: () => inputMethod } as any;
  const session = { isMultiplayer: () => false } as any;

  const tank = new FakeTank(rng);
  const behavior = new PlayerTankBehavior();

  const trace: TickSnapshot[] = [];

  for (let i = 0; i < script.length; i += 1) {
    recorder.update();
    tank.setTick(i);
    behavior.update(tank as any, {
      deltaTime: 1 / 60,
      inputManager,
      session,
    } as any);

    trace.push({
      rotation: tank.rotation,
      state: tank.state,
      moveTicks: tank.moveTicks,
      fireEvents: tank.fireEvents.slice(),
      idleTicks: tank.idleTicks,
    });
  }

  return { trace, recordedLog: recorder.getLog() };
}

test('replaying a recorded input log reproduces the original run tick-by-tick', (t) => {
  const seed = 12345;
  const script = buildScript();

  const original = runScenario(seed, script);

  // The replay never sees the hand-authored script directly -- only the log
  // InputRecorderDevice captured from it, exactly as a real replay would only
  // have what was recorded from a live device during actual play.
  const replay = runScenario(seed, original.recordedLog);

  t.deepEqual(replay.trace, original.trace);

  // Sanity: the scenario actually exercised the order-sensitive direction
  // switch (Up -> Right) and fired at least once, so the deepEqual above is
  // proving something non-trivial.
  const finalRotationSet = new Set(original.trace.map((s) => s.rotation));
  t.true(finalRotationSet.size > 1, 'scenario never actually changed direction');
  t.true(original.trace[original.trace.length - 1].fireEvents.length > 0, 'scenario never fired');
});

test('a different seed with the same recorded input produces different rng draws', (t) => {
  const script = buildScript();
  const recordedLog = runScenario(1, script).recordedLog;

  const runA = runScenario(2, recordedLog);
  const runB = runScenario(3, recordedLog);

  // Same input, same movement/fire counts either way...
  t.is(runA.trace.length, runB.trace.length);
  t.is(
    runA.trace[runA.trace.length - 1].fireEvents.length,
    runB.trace[runB.trace.length - 1].fireEvents.length,
  );

  // ...but the actual rng-drawn values differ, proving this test would catch
  // a bug where replay accidentally re-seeded or reused rng state incorrectly
  // (a false-pass risk if fire() always drew the same constant).
  t.notDeepEqual(
    runA.trace[runA.trace.length - 1].fireEvents,
    runB.trace[runB.trace.length - 1].fireEvents,
  );
});
