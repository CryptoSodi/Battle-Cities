// One enemy tank's recorded state for a single tick: its settled position
// (after that tick's movement AND collision resolution), its rotation, and
// whether it fired a bullet that tick. Recorded verbatim and replayed back
// by directly driving the tank's transform each tick (see
// RecordedTankBehavior) -- this sidesteps needing AiTankBehavior + the seeded
// Prng to independently reproduce the exact same decisions; the enemy just
// re-enacts what actually happened.
export interface EnemyMovementFrame {
  x: number;
  y: number;
  rotation: number;
  fired: boolean;
}
