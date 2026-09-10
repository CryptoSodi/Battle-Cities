// Exercise the real home leaderboard row renderer with local fixtures only.
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const compiled = ts.transpileModule(
  fs.readFileSync(path.join(root, 'src/webUi/MainMenuWebUi.ts'), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const context = {
  exports: {},
  require: () => new Proxy({}, { get: () => class {} }),
  window: { location: { search: '' } },
  URLSearchParams,
};
vm.runInNewContext(compiled, context);
const menu = new context.exports.MainMenuWebUi({
  isDev: false,
  playerIdentity: {
    getPlayer: () => ({ id: 'self', displayName: '7P5T...XYUM' }),
  },
});
const tiers = [
  { fromRank: 1, toRank: 1, amount: 1000 },
  { fromRank: 2, toRank: 2, amount: 750 },
  { fromRank: 3, toRank: 3, amount: 500 },
  { fromRank: 4, toRank: 10, amount: 250 },
];
const rows = Array.from({ length: 10 }, (_, i) => ({
  rank: i + 1,
  playerId: i === 0 ? 'self' : 'player' + i,
  displayName:
    i === 3
      ? 'A VERY LONG PLAYER NAME THAT MUST ELLIPSIZE'
      : 'COMMANDER ' + (i + 1),
  totalPoints: 123456 - i * 1000,
}));
const fixtures = {};
for (const [name, data, currentPlayer] of [
  ['full', rows, null],
  ['single', [rows[0]], null],
  ['unranked', [], null],
  [
    'outside',
    rows.map((r) => ({ ...r, playerId: 'other' + r.rank })),
    {
      rank: 42,
      playerId: 'self',
      displayName: '7P5T...XYUM',
      totalPoints: 1250,
    },
  ],
]) {
  menu.rewardsData = { currentPlayer };
  fixtures[name] = menu.rewardRowsMarkup(data, tiers);
}
fixtures.loading = menu.rewardRowsLoadingMarkup();
const markup = menu.render();
const setup = compiled
  .slice(
    compiled.indexOf(
      "if (document.documentElement.dataset.uiDevice === 'psg1')",
    ),
    compiled.indexOf('this.hydrateHud();'),
  )
  .replaceAll('host.', 'document.querySelector("[data-web-ui]").');
const styles = [
  'main.css',
  'main-menu-web.css',
  'cherry-chat-web.css',
  'psg1-ui.css',
  'home-rewards.css',
  'home-chrome.css',
  'psg1-home-tabs.css',
  'psg1-home-footer.css',
];
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(
      `<!doctype html><html data-ui-device="psg1"><head>${styles
        .map((s) => '<link rel="stylesheet" href="/' + s + '">')
        .join(
          '',
        )}</head><body class="web-ui-active main-menu-web-active"><div class="web-ui" data-web-ui>${markup}</div><script>${setup};document.querySelector('main').dataset.rewardTab='leaderboard';const fixtures=${JSON.stringify(
        fixtures,
      )};window.fill=name=>{const rows=document.querySelector('[data-home-rewards-rows]');rows.innerHTML=fixtures[name];rows.scrollTop=0};window.fill('full');</script></body></html>`,
    );
  }
  const file = path.join(
    root,
    'public',
    decodeURIComponent(req.url.split('?')[0]),
  );
  const mime = { '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf' }[
    path.extname(file)
  ];
  if (mime) res.setHeader('Content-Type', mime);
  fs.readFile(file, (e, data) => {
    res.statusCode = e ? 404 : 200;
    res.end(e ? '' : data);
  });
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const [width, height] of [
      [1280, 1100],
      [1280, 800],
      [960, 540],
      [640, 480],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page.evaluate(() => document.fonts.ready);
      for (const platform of ['desktop', 'android'])
        for (const name of Object.keys(fixtures)) {
          await page.evaluate(
            ([p, name]) => {
              document.documentElement.dataset.uiPlatform = p;
              window.fill(name);
            },
            [platform, name],
          );
          await page.evaluate(async () =>
            Promise.all(
              [...document.images].map((i) => i.decode().catch(() => {})),
            ),
          );
          const result = await page.evaluate(() => {
            const list = document.querySelector('[data-home-rewards-rows]'),
              header = document.querySelector(
                '.main-menu-web__leaderboard-columns',
              ),
              rows = [
                ...list.querySelectorAll('.main-menu-web__leaderboard-row'),
              ],
              r = (e) => e.getBoundingClientRect();
            const fits = rows.every((row, i) => {
              const box = r(row);
              return (
                (!i || box.top >= r(rows[i - 1]).bottom - 0.5) &&
                [...row.children].every((cell) => {
                  const b = r(cell);
                  return (
                    b.top >= box.top &&
                    b.bottom <= box.bottom + 0.5 &&
                    b.left >= box.left &&
                    b.right <= box.right + 0.5
                  );
                }) &&
                [...row.querySelectorAll('img')].every((img) => {
                  if (getComputedStyle(img).display === 'none') return true;
                  const b = r(img),
                    parent = r(img.parentElement);
                  return (
                    b.width <= 32.1 &&
                    b.height <= 32.1 &&
                    b.top >= parent.top &&
                    b.bottom <= parent.bottom
                  );
                })
              );
            });
            const columns =
              rows.length === 0 ||
              [...rows[0].children].every(
                (cell, i) =>
                  Math.abs(r(cell).left - r(header.children[i]).left) < 1 &&
                  Math.abs(r(cell).right - r(header.children[i]).right) < 1,
              );
            const rewards = rows.every((row) => {
              const amount = row.querySelector('.leaderboard-reward-amount');
              return (
                !amount ||
                (getComputedStyle(amount).display !== 'none' &&
                  amount.scrollWidth <= amount.clientWidth + 1)
              );
            });
            list.scrollTop = list.scrollHeight;
            const last = rows.at(-1),
              reachable = !last || r(last).bottom <= r(list).bottom + 0.5;
            list.scrollTop = 0;
            return {
              fits,
              columns,
              rewards,
              reachable,
              geometry: rows.length
                ? [
                    r(list).width,
                    r(header).width,
                    [...rows[0].children].map((e) => [r(e).left, r(e).right]),
                    [...header.children].map((e) => [r(e).left, r(e).right]),
                  ]
                : null,
              first: rows[0]?.textContent,
              unrankedIcon:
                !!list.querySelector('[data-reward-amount="0"] img') &&
                getComputedStyle(
                  list.querySelector('[data-reward-amount="0"] img'),
                ).display,
            };
          });
          if (
            !result.fits ||
            !result.columns ||
            !result.rewards ||
            !result.reachable
          )
            errors.push(
              `${width}/${platform}/${name} ${JSON.stringify(result)}`,
            );
          if (
            name === 'single' &&
            (!result.first.includes('123,456') ||
              !result.first.includes('1,000 BATC'))
          )
            errors.push('Real values missing');
          if (name === 'unranked' && result.unrankedIcon !== 'none')
            errors.push('Unranked chest shown');
          if (
            width === 1280 &&
            height === 800 &&
            platform === 'android' &&
            ['full', 'single', 'unranked'].includes(name)
          )
            await page
              .locator('#home-leaderboard-panel')
              .screenshot({
                path: path.join(__dirname, 'psg1-leaderboard-' + name + '.png'),
              });
        }
      console.log(
        width,
        height,
        'populated, vacant, unranked, outside-top-10 and loading checked',
      );
    }
    if (errors.length) throw Error(errors.join('\n'));
    console.log(
      'PASS: live row values, cell alignment, icon bounds, reward amounts and last-row reachability.',
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
