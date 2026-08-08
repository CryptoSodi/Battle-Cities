"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Prng = void 0;
// Seeded, deterministic pseudo-random number generator (mulberry32).
//
// The same seed always produces the same sequence of draws, which is the
// foundation for reproducible runs: replays, daily seeds, and replay-based
// tournament anti-cheat. Use this for ALL simulation randomness (enemy AI,
// powerup drops, spawn placement). Cosmetic randomness (particles, victory
// screens) must NOT draw from a sim Prng or it will desync the simulation —
// use Math.random / RandomUtils for those.
//
// Mirrors the RandomUtils API (number/arrayElement/probability) so existing
// call sites convert one-to-one.
class Prng {
    constructor(seed = 1) {
        this.seedValue = seed >>> 0 || 1;
        this.state = this.seedValue;
    }
    // Restart the sequence from a (new) seed.
    reseed(seed) {
        this.seedValue = seed >>> 0 || 1;
        this.state = this.seedValue;
    }
    // The seed this generator was (re)started with. Record it to reproduce a run.
    getSeed() {
        return this.seedValue;
    }
    // Raw float in [0, 1).
    next() {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    // Integer in [min, max) - min inclusive, max exclusive.
    number(min = 0, max = 100) {
        return min + Math.floor(this.next() * (max - min));
    }
    arrayElement(values) {
        const index = this.number(0, values.length);
        return values[index];
    }
    probability(chancePercent) {
        const num = this.number(1, 100);
        return num <= chancePercent;
    }
}
exports.Prng = Prng;
