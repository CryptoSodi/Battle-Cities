"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitExplosion = exports.emitMuzzleFlash = void 0;
const config = __importStar(require("../config"));
// Short forward cone of bright sparks at a gun muzzle when a shot is fired.
// (dirX, dirY) is the unit facing direction. Cosmetic; Math.random only.
function emitMuzzleFlash(particles, x, y, dirX, dirY) {
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
exports.emitMuzzleFlash = emitMuzzleFlash;
// Spawns a layered explosion into the particle overlay: a bright flash core, an
// orange fireball, fast sparks, and (optionally) rising smoke. Cosmetic only —
// uses Math.random (never the sim rng) and is gated by PARTICLE_INTENSITY, so
// it never affects the simulation or replay determinism. Coordinates are
// field-local (same space the overlay's view transform expects).
function emitExplosion(particles, x, y, options = {}) {
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
        const color = roll < 0.5
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
exports.emitExplosion = emitExplosion;
