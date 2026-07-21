const endpoint =
  process.argv[2] ??
  process.env.BATTLECITY_WS_ENDPOINT ??
  'ws://127.0.0.1:8787/ws';
const endpointUrl = new URL(endpoint);
if (
  endpointUrl.protocol === 'wss:' &&
  ['127.0.0.1', 'localhost'].includes(endpointUrl.hostname)
) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
const room = `smoke-${Date.now()}`;
const config = {
  fieldWidth: 3000,
  fieldHeight: 3000,
  spawns: [
    { x: 0, y: 2000 },
    { x: 2000, y: 2000 },
  ],
  enemySpawns: [{ x: 1000, y: 0 }],
  enemyTiers: [0],
  enemyDrops: [false],
  terrainWidth: 16,
  terrainHeight: 16,
  terrain: Array(256).fill(0),
  basePosition: { x: 2000, y: 0 },
};

const sockets = [new WebSocket(endpoint), new WebSocket(endpoint)];
const timeout = setTimeout(() => {
  console.error('Timed out waiting for authoritative movement.');
  process.exit(1);
}, 5000);

let active = false;
let inputSent = false;
let startY = null;
let movedUp = false;
let movedRight = false;
let projectileSeen = false;
let enemySeen = false;
let rightStartX = null;

for (const [player, socket] of sockets.entries()) {
  socket.addEventListener('error', (event) => {
    console.error(`Player ${player + 1} WebSocket error at ${endpoint}`, event);
  });
  socket.addEventListener('close', (event) => {
    if (!active) {
      console.error(
        `Player ${player + 1} WebSocket closed before activation: ${event.code} ${event.reason}`,
      );
    }
  });
  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: 'join', room, player, config }));
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.type === 'error') {
      throw new Error(message.message);
    }
    if (message.type !== 'snapshot' || message.phase !== 'active') {
      return;
    }
    active = true;
    startY ??= message.players[0].y;
    if (!inputSent) {
      inputSent = true;
      sockets[0].send(
        JSON.stringify({
          type: 'input',
          sequence: 1,
          direction: 0,
          moving: true,
        }),
      );
      return;
    }
    enemySeen ||= message.enemies.length > 0;
    projectileSeen ||= message.projectiles.length > 0;
    if (!movedUp && message.players[0].y < startY) {
      movedUp = true;
      rightStartX = message.players[0].x;
      sockets[0].send(
        JSON.stringify({
          type: 'input',
          sequence: 2,
          direction: 1,
          moving: true,
        }),
      );
      return;
    }
    if (movedUp && !movedRight && message.players[0].x > rightStartX) {
      movedRight = true;
      sockets[0].send(
        JSON.stringify({
          type: 'input',
          sequence: 3,
          direction: 1,
          moving: false,
        }),
      );
      sockets[0].send(JSON.stringify({ type: 'fire', sequence: 1 }));
      return;
    }
    if (movedUp && movedRight && projectileSeen && enemySeen) {
      clearTimeout(timeout);
      console.log(
        `ok room=${room} tick=${message.tick} player0=(${message.players[0].x},${message.players[0].y}) enemies=${message.enemies.length} projectiles=${message.projectiles.length}`,
      );
      sockets.forEach((client) => client.close());
      process.exit(0);
    }
  });
}

process.on('exit', () => {
  if (!active) {
    console.error('Room never reached active phase.');
  }
});
