/* Local-only visual fixture: uses the actual TypeScript renderer, not a
   hand-maintained approximation. Never linked from the production app. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'src/webUi/MainMenuWebUi.ts'),
  'utf8',
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const sandbox = {
  exports: {},
  require: () => ({}),
  URLSearchParams,
  window: { location: { search: '' } },
  console,
};
vm.runInNewContext(code, sandbox);
const menu = Object.create(sandbox.exports.MainMenuWebUi.prototype);
menu.options = { isDev: false };
const render = menu.render();
assert(!render.includes('data-menu-action="leaderboard"'));
assert(!render.includes('data-menu-action="logout"'));
const timerElements = Object.fromEntries(['[data-home-rewards-countdown]', '[data-home-countdown-label]', '[data-home-round-progress]', '[data-home-round]'].map(key => [key, {textContent: '', value: 0}]));
menu.host = {querySelector: selector => timerElements[selector]};
menu.rewardsData = {enabled: false, nextRewardAt: new Date(Date.now() + 900000).toISOString(), rewardIntervalMinutes: 30};
menu.syncHomeRewardsCountdown();
assert.equal(timerElements['[data-home-countdown-label]'].textContent, 'ROUND ENDS IN');
assert(timerElements['[data-home-round-progress]'].value > 49 && timerElements['[data-home-round-progress]'].value <= 50);
assert(/^00:14:59$|^00:15:00$/.test(timerElements['[data-home-rewards-countdown]'].textContent));
menu.rewardsData.enabled = true;
menu.syncHomeRewardsCountdown();
assert.equal(timerElements['[data-home-countdown-label]'].textContent, 'NEXT REWARD IN');
assert(render.includes('home-reward-chests') === false); // Artwork is CSS-backed.
assert.equal((render.match(/main-menu-web__chest--/g) || []).length, 4);
assert(!render.includes('mobile-gamepad-qr'));
assert(!render.includes('main-menu-web__events-viewport'));
assert(render.includes('data-menu-events-primary'));
assert(render.includes('data-home-presence hidden'));
assert(menu.rewardRowsMarkup([], []).includes('NO SCORES THIS ROUND'));
assert(
  menu
    .rewardRowsMarkup(
      [{ rank: 1, displayName: '<img onerror=alert(1)>', totalPoints: 99 }],
      [],
    )
    .includes('&lt;img'),
);
assert.equal(
  menu.rewardForRank(4, [{ fromRank: 4, toRank: 10, amount: 250 }]),
  250,
);
console.log(
  'Home renderer checks passed: art, QR relocation, footer, empty state, escaping, reward tiers.',
);
if (process.argv.includes('--serve')) {
  const http = require('http');
  http
    .createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/settings') {
        const settings = ts.transpileModule(
          fs.readFileSync(
            path.join(root, 'src/webUi/SettingsWebUi.ts'),
            'utf8',
          ),
          {
            compilerOptions: {
              module: ts.ModuleKind.CommonJS,
              target: ts.ScriptTarget.ES2020,
            },
          },
        ).outputText;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(
          '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
            [
              'main',
              'main-menu-web',
              'standard-pages-web',
              'operations-web',
              'shop-ui-contract',
              'psg1-ui',
              'home-rewards',
              'home-chrome',
            ]
              .map((f) => '<link rel="stylesheet" href="/' + f + '.css">')
              .join('') +
            '</head><body class="game-running"><div class="web-ui" data-web-ui></div><script>var exports={}; var process={env:{BATTLECITY_VERSION:"TEST"}}; var require=()=>({NativeNotificationClient:class {isAvailable(){return false}},isPlaySolanaPsg1:()=>false,moveFocus:()=>{}});' +
            settings +
            '; var ui = new exports.SettingsWebUi({}, {getNativeAndroidGamepad:()=>({getDeviceProfile:()=>({})}),getMobileGamepadHost:()=>({createQrElement:async()=>{var e=document.createElement("div");e.className="mobile-gamepad-qr";e.textContent="LOCAL PAIRING FIXTURE";return e}})}, {isGlobalMuted:()=>false,setGlobalMuted:()=>{},saveSettings:()=>{}}, {getBoolean:()=>false,setBoolean:()=>{},save:()=>{}}); ui.mount();</script></body></html>',
        );
        return;
      }
      if (url.pathname === '/') {
        let html = render.replace('PLAYER</strong>', 'LOCAL PREVIEW</strong>');
        const rows = url.searchParams.has('empty')
          ? []
          : Array.from({ length: 10 }, (_, i) => ({
              rank: i + 1,
              displayName:
                i === 0 ? 'LONG PLAYER NAME TEST' : 'TEST PLAYER ' + (i + 1),
              totalPoints: 12450 - i * 520,
            }));
        html = html.replace(
          menu.rewardRowsLoadingMarkup(),
          menu.rewardRowsMarkup(rows, [
            { fromRank: 1, toRank: 1, amount: 1000 },
            { fromRank: 2, toRank: 2, amount: 750 },
            { fromRank: 3, toRank: 3, amount: 500 },
            { fromRank: 4, toRank: 10, amount: 250 },
          ]),
        );
        html = html
          .replace(
            'Loading current round',
            'LOCAL TEST DATA · PAYOUTS DISABLED',
          )
          .replace('SYNCING ROUND', 'ROUND ENDS 24:37')
          .replace('Loading events…', 'No live events right now');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(
          '<!doctype html><html ' +
            (url.searchParams.has('psg1') ? 'data-ui-device="psg1"' : '') +
            '><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
            [
              'main',
              'main-menu-web',
              'cherry-chat-web',
              'standard-pages-web',
              'shop-ui-contract',
              'psg1-ui',
              'home-rewards',
              'home-chrome',
            ]
              .map((f) => '<link rel="stylesheet" href="/' + f + '.css">')
              .join('') +
            '</head><body class="game-running web-ui-active main-menu-web-active"><div class="web-ui" data-web-ui>' +
            html +
            '</div></body></html>',
        );
        return;
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const base = relative.startsWith('data/')
        ? root
        : path.join(root, 'public');
      const target = path.resolve(base, relative);
      if (
        !target.startsWith(base + path.sep) ||
        !fs.existsSync(target) ||
        !fs.statSync(target).isFile()
      ) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader(
        'Content-Type',
        {
          '.css': 'text/css',
          '.png': 'image/png',
          '.woff2': 'font/woff2',
          '.woff': 'font/woff',
          '.ttf': 'font/ttf',
        }[path.extname(target)] || 'application/octet-stream',
      );
      fs.createReadStream(target).pipe(res);
    })
    .listen(8083, '127.0.0.1', () =>
      console.log('Local visual fixture: http://127.0.0.1:8083'),
    );
}
