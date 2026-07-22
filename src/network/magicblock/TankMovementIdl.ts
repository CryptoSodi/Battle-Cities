import { Idl } from '@coral-xyz/anchor';

export const TANK_MOVEMENT_IDL: Idl = {
  address: '6h22S7XADcvgqt8aXEteSu8HzbUmzsAdGucH3zpszC23',
  metadata: {
    name: 'tank_movement',
    version: '0.1.0',
    spec: '0.1.0',
  },
  instructions: [
    {
      name: 'initializeTank',
      discriminator: [202, 65, 158, 247, 228, 246, 171, 136],
      accounts: [
        { name: 'authority', signer: true, writable: true },
        { name: 'tank', writable: true },
        { name: 'systemProgram' },
      ],
      args: [
        { name: 'x', type: 'i32' },
        { name: 'y', type: 'i32' },
      ],
    },
    {
      name: 'delegateTank',
      discriminator: [45, 85, 92, 206, 155, 230, 86, 242],
      accounts: [],
      args: [],
    },
    {
      name: 'moveTank',
      discriminator: [55, 81, 250, 190, 75, 154, 10, 125],
      accounts: [
        { name: 'authority', signer: true },
        { name: 'tank', writable: true },
      ],
      args: [
        { name: 'direction', type: { defined: { name: 'direction' } } },
        { name: 'distance', type: 'u16' },
        { name: 'sequence', type: 'u64' },
      ],
    },
    {
      name: 'createMatch',
      discriminator: [107, 2, 184, 145, 70, 142, 17, 165],
      accounts: [
        { name: 'authority', signer: true, writable: true },
        { name: 'matchState', writable: true },
        { name: 'terrainState', writable: true },
        { name: 'systemProgram' },
      ],
      args: [
        { name: 'matchId', type: 'u64' },
        { name: 'mapId', type: 'u16' },
        { name: 'fieldWidth', type: 'u16' },
        { name: 'fieldHeight', type: 'u16' },
        {
          name: 'spawns',
          type: { array: [{ defined: { name: 'position' } }, 2] },
        },
        {
          name: 'enemySpawns',
          type: { array: [{ defined: { name: 'position' } }, 3] },
        },
        { name: 'enemyTotal', type: 'u8' },
        { name: 'enemySpeedClasses', type: { array: ['u8', 20] } },
        { name: 'terrainWidth', type: 'u8' },
        { name: 'terrainHeight', type: 'u8' },
        {
          name: 'basePosition',
          type: { defined: { name: 'position' } },
        },
        { name: 'debugDisableEnemyShooting', type: 'bool' },
      ],
    },
    {
      name: 'initializeTerrainChunk',
      discriminator: [246, 38, 118, 100, 88, 232, 14, 179],
      accounts: [
        { name: 'authority', signer: true },
        { name: 'matchState', writable: true },
        { name: 'terrainState', writable: true },
      ],
      args: [
        { name: 'matchId', type: 'u64' },
        { name: 'offset', type: 'u16' },
        { name: 'bytes', type: { vec: 'u8' } },
        { name: 'steelBytes', type: { vec: 'u8' } },
      ],
    },
    {
      name: 'finalizeTerrain',
      discriminator: [9, 175, 202, 38, 229, 155, 154, 246],
      accounts: [
        { name: 'authority', signer: true },
        { name: 'matchState', writable: true },
        { name: 'terrainState', writable: true },
      ],
      args: [{ name: 'matchId', type: 'u64' }],
    },
    {
      name: 'joinMatch',
      discriminator: [244, 8, 47, 130, 192, 59, 179, 44],
      accounts: [
        { name: 'authority', signer: true, writable: true },
        { name: 'matchState', writable: true },
      ],
      args: [{ name: 'matchId', type: 'u64' }],
    },
    {
      name: 'delegateMatch',
      discriminator: [30, 116, 9, 69, 147, 61, 133, 238],
      accounts: [],
      args: [{ name: 'matchId', type: 'u64' }],
    },
    {
      name: 'delegateTerrain',
      discriminator: [176, 150, 146, 191, 249, 190, 114, 14],
      accounts: [],
      args: [{ name: 'matchId', type: 'u64' }],
    },
    {
      name: 'startMatch',
      discriminator: [100, 246, 223, 181, 176, 101, 255, 19],
      accounts: [
        { name: 'authority', signer: true },
        { name: 'matchState', writable: true },
        { name: 'terrainState', writable: true },
      ],
      args: [{ name: 'matchId', type: 'u64' }],
    },
    {
      name: 'scheduleMatchCrank',
      discriminator: [5, 93, 36, 117, 183, 255, 117, 187],
      accounts: [
        { name: 'payer', signer: true, writable: true },
        { name: 'matchState', writable: true },
        { name: 'terrainState' },
        { name: 'magicContext', writable: true },
        { name: 'magicProgram' },
      ],
      args: [
        { name: 'matchId', type: 'u64' },
        { name: 'epoch', type: 'u64' },
      ],
    },
    {
      name: 'tickSimulation',
      discriminator: [131, 24, 16, 152, 73, 152, 89, 63],
      accounts: [
        { name: 'matchState', writable: true },
        { name: 'terrainState' },
      ],
      args: [
        { name: 'matchId', type: 'u64' },
        { name: 'epoch', type: 'u64' },
      ],
    },
    {
      name: 'submitInput',
      discriminator: [56, 184, 154, 91, 173, 63, 21, 138],
      accounts: [
        { name: 'authority', signer: true },
        { name: 'matchState', writable: true },
      ],
      args: [
        { name: 'matchId', type: 'u64' },
        { name: 'epoch', type: 'u64' },
        { name: 'direction', type: { defined: { name: 'direction' } } },
        { name: 'distance', type: 'u16' },
        { name: 'sequence', type: 'u64' },
      ],
    },
    {
      name: 'respawnPlayer',
      discriminator: [93, 210, 196, 21, 134, 131, 118, 120],
      accounts: [
        { name: 'authority', signer: true },
        { name: 'matchState', writable: true },
      ],
      args: [
        { name: 'matchId', type: 'u64' },
        { name: 'epoch', type: 'u64' },
      ],
    },
    {
      name: 'submitInputBatch',
      discriminator: [38, 211, 117, 206, 68, 254, 39, 158],
      accounts: [
        { name: 'authority', signer: true },
        { name: 'matchState', writable: true },
      ],
      args: [
        { name: 'matchId', type: 'u64' },
        { name: 'epoch', type: 'u64' },
        {
          name: 'frames',
          type: { vec: { defined: { name: 'inputFrame' } } },
        },
        {
          name: 'projectiles',
          type: { vec: { defined: { name: 'projectileSnapshot' } } },
        },
        {
          name: 'boardMutations',
          type: { vec: { defined: { name: 'boardMutation' } } },
        },
        { name: 'bulletWallDamage', type: 'u8' },
        { name: 'sequence', type: 'u64' },
      ],
    },
  ],
  types: [
    {
      name: 'position',
      type: {
        kind: 'struct',
        fields: [
          { name: 'x', type: 'i32' },
          { name: 'y', type: 'i32' },
        ],
      },
    },
    {
      name: 'direction',
      type: {
        kind: 'enum',
        variants: [
          { name: 'up' },
          { name: 'right' },
          { name: 'down' },
          { name: 'left' },
        ],
      },
    },
    {
      name: 'inputFrame',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'direction',
            type: { defined: { name: 'direction' } },
          },
          { name: 'distance', type: 'u16' },
          { name: 'fire', type: 'bool' },
          { name: 'fireAgeMs', type: 'u16' },
        ],
      },
    },
    {
      name: 'projectileSnapshot',
      type: {
        kind: 'struct',
        fields: [
          { name: 'id', type: 'u16' },
          { name: 'x', type: 'i32' },
          { name: 'y', type: 'i32' },
          {
            name: 'direction',
            type: { defined: { name: 'direction' } },
          },
          { name: 'wallDamage', type: 'u8' },
        ],
      },
    },
    {
      name: 'boardMutation',
      type: {
        kind: 'struct',
        fields: [
          { name: 'x', type: 'u8' },
          { name: 'y', type: 'u8' },
        ],
      },
    },
    {
      name: 'enemyFireEvent',
      type: {
        kind: 'struct',
        fields: [
          { name: 'sequence', type: 'u64' },
          { name: 'enemyId', type: 'u16' },
          { name: 'x', type: 'i32' },
          { name: 'y', type: 'i32' },
          {
            name: 'direction',
            type: { defined: { name: 'direction' } },
          },
          { name: 'simulationTick', type: 'u64' },
        ],
      },
    },
  ],
};
