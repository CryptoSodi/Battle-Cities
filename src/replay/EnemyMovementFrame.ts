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
  // A non-terminal bullet hit during this tick. Enemy tank damage is always
  // one point; death is stored separately below with its original cause.
  hit?: boolean;
  // Terminal event captured from the original simulation. Replays apply this
  // explicitly because a bullet-vs-teleported-enemy collision can differ by
  // one tick even when both visible paths are otherwise identical.
  died?: boolean;
  deathReason?: 'bullet' | 'wipeout';
  hitterPartyIndex?: number | null;
}
