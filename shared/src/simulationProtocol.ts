export type SimulationRotation = 0 | 90 | 180 | 270;
export type SimulationPlayerIndex = 0 | 1;
export type SimulationTankTier = 'a' | 'b' | 'c' | 'd';

export type SimulationPowerupType =
  | 'defence'
  | 'freeze'
  | 'life'
  | 'shield'
  | 'speed'
  | 'upgrade'
  | 'zoomout'
  | 'wipeout';

export interface SimulationInputPacket {
  type: 'webrtc-input';
  player: SimulationPlayerIndex;
  seq: number;
  tick: number;
  direction: SimulationRotation | null;
  moving: boolean;
  fire: boolean;
  elapsedSeconds: number;
}

export interface SimulationPlayerFrame {
  partyIndex: SimulationPlayerIndex;
  tier?: SimulationTankTier;
  x: number;
  y: number;
  rotation: SimulationRotation;
  moving: boolean;
  deltaX: number;
  deltaY: number;
  alive: boolean;
  fireSeq: number;
  fireX: number;
  fireY: number;
  fireRotation: SimulationRotation;
  initialSync?: boolean;
}

export interface SimulationEnemyFrame {
  partyIndex: number;
  x: number;
  y: number;
  rotation: SimulationRotation;
  moving: boolean;
  deltaX: number;
  deltaY: number;
  alive: boolean;
  fireSeq: number;
  fireX: number;
  fireY: number;
  fireRotation: SimulationRotation;
  initialSync?: boolean;
}

export interface SimulationPowerupFrame {
  id: number;
  kind: SimulationPowerupType;
  x: number;
  y: number;
}

export interface SimulationPowerupPickupFrame {
  seq: number;
  type: SimulationPowerupType;
  partyIndex: SimulationPlayerIndex;
  x: number;
  y: number;
}

export interface SimulationHostFramePacket {
  type: 'webrtc-host-frame';
  seq: number;
  tick: number;
  deltaTime: number;
  playerScores: [number, number];
  sharedElapsedSeconds: number;
  playerOneElapsedSeconds: number;
  playerTwoElapsedSeconds: number;
  players: SimulationPlayerFrame[];
  powerup: SimulationPowerupFrame | null;
  powerupPickup: SimulationPowerupPickupFrame | null;
  activeEnemyIds: number[];
  enemies: SimulationEnemyFrame[];
}

export interface SimulationReadyPacket {
  type: 'webrtc-ready';
  ready: boolean;
  syncPlayer: SimulationPlayerIndex | null;
  serverFrameSeq: number;
}

export interface SimulationResumePacket {
  type: 'webrtc-resume';
  player: SimulationPlayerIndex;
  lastAppliedFrameSeq: number;
}

export interface SimulationClientReadyPacket {
  type: 'webrtc-client-ready';
  player: SimulationPlayerIndex;
  appliedSeq: number;
}

export interface SimulationPingPacket {
  type: 'webrtc-ping';
  id: number;
  sentAt: number;
  senderPlayerIndex: number;
}

export interface SimulationPongPacket {
  type: 'webrtc-pong';
  id: number;
  sentAt: number;
  senderPlayerIndex: number;
}

export type SimulationClientPacket =
  | SimulationInputPacket
  | SimulationResumePacket
  | SimulationClientReadyPacket
  | SimulationPingPacket
  | SimulationPongPacket;

export interface SimulationMapDto {
  version?: number;
  field?: { widthTiles?: number; heightTiles?: number };
  base?: { x: number; y: number };
  spawn?: {
    player?: { locations?: Array<{ x: number; y: number }> };
    enemy?: {
      locations?: Array<{ x: number; y: number }>;
      list?: Array<{ tier: string; drop?: boolean }>;
    };
  };
  terrain?: {
    regions?: Array<{
      type: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  };
}

export interface SimulationOptions {
  seed: number;
  tickRate?: number;
  level?: number;
  disableEnemyShooting?: boolean;
  initialPlayerTiers?: [SimulationTankTier, SimulationTankTier];
  runBoosts?: {
    hull?: number;
    armor?: number;
    engine?: number;
    salvage?: number;
  };
  extraLives?: number;
}
