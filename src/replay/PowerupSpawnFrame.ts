import { PowerupType } from '../powerup';

// One powerup spawn's recorded outcome, in the order spawns actually
// happened. `position` is null for the rare "no free cell, give directly to
// the player" case. Recorded because PowerupFactory/PowerupGrid draw from the
// seeded Prng (type + grid cell) -- and once enemies stopped consuming that
// same rng stream (see RecordedTankBehavior), the stream's alignment with the
// original recording broke entirely, so powerups must be replayed the same
// way enemies are: re-enacted verbatim, not re-derived.
export interface PowerupSpawnFrame {
  type: PowerupType;
  position: { x: number; y: number } | null;
}
