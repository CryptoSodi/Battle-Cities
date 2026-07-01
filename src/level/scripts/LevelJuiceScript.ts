import { ParticleSystem, Vector } from '../../core';
import { GameUpdateArgs, Rotation } from '../../game';
import { Tank } from '../../gameObjects';
import * as config from '../../config';

import { LevelScript } from '../LevelScript';

// Ambient combat "juice": tread dust behind moving tanks and spark bursts when
// a tank survives a hit. Purely cosmetic — it only reads gameplay state and
// writes to the particle overlay, uses Math.random (never the sim rng), and is
// gated by PARTICLE_INTENSITY so it stays out of the deterministic simulation.
export class LevelJuiceScript extends LevelScript {
  private particles: ParticleSystem;
  // Tanks we've already wired a hit-spark listener onto (enemies spawn over
  // time). WeakSet so removed tanks are collected without bookkeeping.
  private sparkedTanks = new WeakSet<Tank>();
  // Last position at which each tank emitted tread dust, so puffs are spaced by
  // distance travelled rather than by time (speed-independent trail).
  private lastDustAt = new WeakMap<Tank, Vector>();

  protected setup(updateArgs: GameUpdateArgs): void {
    this.particles = updateArgs.particles;
  }

  protected update(updateArgs: GameUpdateArgs): void {
    if (config.PARTICLE_INTENSITY <= 0) {
      return;
    }

    // Tanks are direct children of the field; iterate those rather than
    // deep-traversing the whole tile tree every tick.
    for (const child of this.world.field.children) {
      if (!(child instanceof Tank)) {
        continue;
      }
      const tank = child as Tank;

      // Lazily attach the survive-a-hit spark burst the first time we see a
      // tank (covers enemies that spawn mid-level).
      if (!this.sparkedTanks.has(tank)) {
        this.sparkedTanks.add(tank);
        tank.hit.addListener(() => this.handleTankHit(tank));
      }

      if (tank.isAlive()) {
        this.emitTreadDust(tank);
      }
    }
  }

  // Sparks only when the tank SURVIVES — a fatal hit is covered by the death
  // explosion, so this stays a "ping off the armor" cue.
  private handleTankHit = (tank: Tank): void => {
    if (!tank.isAlive()) {
      return;
    }

    const center = tank.getCenter();
    const count = Math.round(config.HIT_SPARK_COUNT * config.PARTICLE_INTENSITY);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 130;
      this.particles.spawn({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.12 + Math.random() * 0.14,
        size: 2 + Math.random() * 2,
        color: Math.random() < 0.5 ? 'rgb(255,244,196)' : 'rgb(255,206,110)',
        gravity: 220,
        drag: 2,
        shrink: true,
      });
    }
  };

  private emitTreadDust(tank: Tank): void {
    const center = tank.getCenter();

    const last = this.lastDustAt.get(tank);
    if (last === undefined) {
      this.lastDustAt.set(tank, new Vector(center.x, center.y));
      return;
    }

    const dx = center.x - last.x;
    const dy = center.y - last.y;
    if (dx * dx + dy * dy < config.TREAD_DUST_DISTANCE * config.TREAD_DUST_DISTANCE) {
      return;
    }
    this.lastDustAt.set(tank, new Vector(center.x, center.y));

    // Facing direction from the tank rotation; dust kicks up at the rear.
    let dirX = 0;
    let dirY = 0;
    const rotation = tank.getWorldRotation();
    if (rotation === Rotation.Up) {
      dirY = -1;
    } else if (rotation === Rotation.Down) {
      dirY = 1;
    } else if (rotation === Rotation.Left) {
      dirX = -1;
    } else if (rotation === Rotation.Right) {
      dirX = 1;
    }

    const half = tank.size.height / 2;
    const rearX = center.x - dirX * half * 0.7;
    const rearY = center.y - dirY * half * 0.7;
    // Lateral axis (perpendicular to facing) to spread across the two treads.
    const latX = dirY;
    const latY = dirX;
    const spread = tank.size.width * 0.35;

    const puffs = Math.max(1, Math.round(2 * config.PARTICLE_INTENSITY));
    for (let i = 0; i < puffs; i += 1) {
      const offset = (Math.random() - 0.5) * 2 * spread;
      const grey = 168 + Math.floor(Math.random() * 34);
      this.particles.spawn({
        x: rearX + latX * offset,
        y: rearY + latY * offset,
        vx: (Math.random() - 0.5) * 24,
        vy: (Math.random() - 0.5) * 24 - 12,
        life: 0.3 + Math.random() * 0.3,
        size: 3 + Math.random() * 3,
        color: `rgb(${grey},${grey - 12},${grey - 30})`,
        drag: 2.2,
        shrink: true,
      });
    }
  }
}
