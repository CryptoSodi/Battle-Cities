import {
  AudioLoader,
  CollisionSystem,
  ColorSpriteFontGenerator,
  ImageLoader,
  ParticleSystem,
  Prng,
  RectFontLoader,
  SpriteFontLoader,
  SpriteLoader,
  State,
  Vector,
} from '../core';
import { InputHintSettings, InputManager } from '../input';
import { MapLoader } from '../map';
import { PointsHighscoreManager } from '../points';
import { PlayerIdentity } from '../auth';
import { MagicBlockMovementSync } from '../network/magicblock';
import type { WebRtcHostMatchSync } from '../network/webrtc';

import { AudioManager } from './AudioManager';
import { GameState } from './GameState';
import { GameStorage } from './GameStorage';
import { Session } from './Session';

export interface GameUpdateArgs {
  audioManager: AudioManager;
  audioLoader: AudioLoader;
  collisionSystem: CollisionSystem;
  colorSpriteFontGenerator: ColorSpriteFontGenerator;
  deltaTime: number;
  // Freeze the simulation for a few real-time seconds (hit-stop / impact punch).
  hitStop: (seconds: number) => void;
  imageLoader: ImageLoader;
  inputHintSettings: InputHintSettings;
  inputManager: InputManager;
  gameState: State<GameState>;
  gameStorage: GameStorage;
  mapLoader: MapLoader;
  magicBlockMovement: MagicBlockMovementSync;
  webRtcMatch: WebRtcHostMatchSync;
  particles: ParticleSystem;
  playerIdentity: PlayerIdentity;
  pointsHighscoreManager: PointsHighscoreManager;
  pointerClick?: Vector;
  pointerSwipe?: number;
  rng: Prng;
  rectFontLoader: RectFontLoader;
  session: Session;
  spriteFontLoader: SpriteFontLoader;
  spriteLoader: SpriteLoader;
}
