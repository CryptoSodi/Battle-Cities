import { ParticleSystem } from '../core';
import * as config from '../config';

// Short forward cone of bright sparks at a gun muzzle when a shot is fired.
// (dirX, dirY) is the unit facing direction. Cosmetic; Math.random only.
export function emitMuzzleFlash(
  particles: ParticleSystem,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
): void {
  const intensity = config.PARTICLE_INTENSITY;
  if (intensity <= 0) {
    return;
  }

  const baseAngle = Math.atan2(dirY, dirX);
  const count = Math.round(6 * intensity);
  for (let i = 0; i < count; i += 1) {
    const angle = baseAngle + (Math.random() - 0.5) * 0.7;
    const speed = 70 + Math.random() * 110;
    particles.spawn({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.06 + Math.random() * 0.1,
      size: 2 + Math.random() * 2,
      color: Math.random() < 0.5 ? 'rgb(255,250,232)' : 'rgb(255,214,92)',
      drag: 3,
      shrink: true,
    });
  }
}

export interface ExplosionEffectOptions {
  // Overall size multiplier (1 = a tank-sized blast).
  scale?: number;
  // Emit rising smoke puffs (big blasts) — off for tiny bullet impacts.
  smoke?: boolean;
}

// Spawns a layered explosion into the particle overlay: a bright flash core, an
// orange fireball, fast sparks, and (optionally) rising smoke. Cosmetic only —
// uses Math.random (never the sim rng) and is gated by PARTICLE_INTENSITY, so
// it never affects the simulation or replay determinism. Coordinates are
// field-local (same space the overlay's view transform expects).
export function emitExplosion(
  particles: ParticleSystem,
  x: number,
  y: number,
  options: ExplosionEffectOptions = {},
): void {
  const intensity = config.PARTICLE_INTENSITY;
  if (intensity <= 0) {
    return;
  }

  const scale = options.scale ?? 1;
  const withSmoke = options.smoke ?? true;

  // Flash core: a few big, bright, near-stationary flecks that pop and vanish.
  const flashCount = Math.max(1, Math.round(3 * scale * intensity));
  for (let i = 0; i < flashCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 30 * scale;
    particles.spawn({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.1 + Math.random() * 0.08,
      size: (10 + Math.random() * 8) * scale,
      color: Math.random() < 0.5 ? 'rgb(255,250,232)' : 'rgb(255,224,150)',
      drag: 2,
      shrink: true,
    });
  }

  // Fireball: mid-speed orange/red chunks expanding outward.
  const fireCount = Math.round(10 * scale * intensity);
  for (let i = 0; i < fireCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (30 + Math.random() * 90) * scale;
    const roll = Math.random();
    const color =
      roll < 0.5
        ? 'rgb(255,150,48)'
        : roll < 0.85
        ? 'rgb(242,96,32)'
        : 'rgb(198,58,30)';
    particles.spawn({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.28 + Math.random() * 0.32,
      size: (4 + Math.random() * 4) * scale,
      color,
      gravity: 120,
      drag: 1.5,
      shrink: true,
    });
  }

  // Sparks: fast, small, bright, arcing under gravity.
  const sparkCount = Math.round(14 * scale * intensity);
  for (let i = 0; i < sparkCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (70 + Math.random() * 170) * scale;
    particles.spawn({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.3 + Math.random() * 0.4,
      size: 2 + Math.random() * 2,
      color: Math.random() < 0.5 ? 'rgb(255,214,92)' : 'rgb(255,168,64)',
      gravity: 260,
      drag: 1.4,
      shrink: true,
    });
  }

  // Smoke: slow, dark, rising and lingering.
  if (withSmoke) {
    const smokeCount = Math.round(6 * scale * intensity);
    for (let i = 0; i < smokeCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (10 + Math.random() * 30) * scale;
      const grey = 60 + Math.floor(Math.random() * 40);
      particles.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30 * scale,
        life: 0.6 + Math.random() * 0.5,
        size: (6 + Math.random() * 6) * scale,
        color: `rgb(${grey},${grey},${grey})`,
        drag: 1.2,
      });
    }
  }
}
