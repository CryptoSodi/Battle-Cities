const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
require('browser-env')();

const dialogPrototype = Object.getPrototypeOf(document.createElement('dialog'));
dialogPrototype.showModal = function() { this.open = true; };
dialogPrototype.close = function() { this.open = false; };

const instances = [];
let mountError = false;
let player = { provider: 'wallet', walletAddress: 'game-wallet' };
let walletAddress = 'game-wallet';
let requests = [];
let connections = 0;
let providerAvailable = true;
class FakeCherryEmbed {
  constructor(config) { this.config = config; this.events = {}; instances.push(this); }
  async mount() {
    if (mountError) throw new Error('origin blocked');
    this.isReady = true;
  }
  on(event, callback) { this.events[event] = callback; }
  destroy() { this.destroyed = true; }
  setWalletAddress(value) { this.address = value; }
  setToken(value) { this.token = value; }
  signOut() { this.signedOut = true; }
}
const exportsObject = {};
const source = fs.readFileSync(path.join(__dirname, '../src/webUi/CherryChatWebUi.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInNewContext(compiled, {
  exports: exportsObject,
  document, window, performance, AbortController, Uint8Array, Error,
  require(id) {
    if (id === '@cherrydotfun/chat-embed-sdk') return { CherryEmbed: FakeCherryEmbed };
    if (id === '../network/api') return {
      apiFetchDirect: async (url, init) => {
        requests.push({ url, init });
        return { ok: true, json: async () => ({ token: 'short-lived-token' }) };
      },
    };
    if (id === '../wallet') return {
      getPhantomProvider: () => providerAvailable ? {
        connect: async () => { connections++; return { publicKey: { toString: () => walletAddress } }; },
        signMessage: async () => ({ signature: new Uint8Array(64) }),
      } : null,
    };
    throw new Error(`Unexpected dependency: ${id}`);
  },
});
const { CherryChatWebUi } = exportsObject;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const click = (selector) => document.querySelector(selector).click();
const status = () => document.querySelector('[data-chat-status]').textContent;

async function run() {
  const ui = new CherryChatWebUi({ getPlayer: () => player });
  ui.mount();
  assert.equal(instances.length, 0, 'Do not contact CHERRY before opening chat');
  click('.game-cherry__launcher');
  await flush();
  assert(ui.blocksMenuInput(), 'Chat must isolate menu input');
  const chat = instances[0];
  assert.equal(chat.config.roomId, 'ffd51288-710c-4558-83dc-d5fe9b04451d');
  assert.equal(chat.config.position, 'inline');
  chat.events.authStateChange(true);
  assert(chat.signedOut, 'Do not inherit a previous wallet session');
  click('[data-chat-connect]');
  await flush();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/cherry-embed-token');
  assert.equal(JSON.parse(requests[0].init.body).walletAddress, player.walletAddress);
  assert.equal(chat.token, 'short-lived-token');
  assert.equal(chat.address, player.walletAddress);
  assert.equal((await chat.config.signChallengeHandler(new Uint8Array([1]))).length, 64);
  click('[data-chat-close]');
  assert.equal(document.activeElement, ui.getLauncher(), 'Restore the launch control');
  assert(ui.blocksMenuInput(), 'Do not reuse the closing key as a menu command');
  await assert.rejects(() => chat.config.signChallengeHandler(new Uint8Array([1])));
  ui.unmount();
  assert(chat.destroyed);
  assert.equal(document.querySelector('.game-cherry'), null);

  ui.mount();
  click('.game-cherry__launcher');
  await flush();
  walletAddress = 'different-wallet';
  click('[data-chat-connect]');
  await flush();
  assert(status().includes('same wallet'));
  assert.equal(requests.length, 1, 'Mismatched wallets cannot obtain a token');
  player = { provider: 'google', walletAddress: null };
  const before = connections;
  click('[data-chat-connect]');
  await flush();
  assert.equal(connections, before, 'Do not replace a Google login');
  assert(status().includes('current login has not changed'));
  ui.unmount();

  const countBeforeGoogle = instances.length;
  ui.mount();
  assert.equal(ui.getLauncher(), null, 'Google players must not see the chat launcher');
  assert.equal(document.querySelector('.game-cherry'), null);
  assert.equal(instances.length, countBeforeGoogle, 'Google login must not load CHERRY');
  ui.unmount();
  player = { provider: 'wallet', walletAddress: 'game-wallet' };
  walletAddress = 'game-wallet';
  mountError = true;
  ui.mount();
  click('.game-cherry__launcher');
  await flush();
  assert(!document.querySelector('[data-chat-retry]').hidden);
  mountError = false;
  click('[data-chat-retry]');
  await flush();
  assert(instances[instances.length - 1].isReady);
  const last = instances[instances.length - 1];
  ui.unmount();
  await assert.rejects(() => last.config.signChallengeHandler(new Uint8Array([1])));
  assert.equal(document.querySelectorAll('.game-cherry').length, 0);
  console.log('CHERRY tests passed: lazy load, auth guards, focus, input isolation, retry, and cleanup.');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
