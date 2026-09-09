// Render real UI classes; all network responses and navigation are local fixtures.
const fs = require('fs');
const path = require('path');
const http = require('http');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const files = [
  'psg1Console',
  'HeadquartersWebUi',
  'SocialsWebUi',
  'RankingWebUi',
];
const modules = files.map(
  (name) =>
    ts.transpileModule(
      fs.readFileSync(path.join(root, 'src/webUi', name + '.ts'), 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    ).outputText,
);
const styles = [
  'main.css',
  'main-menu-web.css',
  'shop-web.css',
  'operations-web.css',
  'ranking-web.css',
  'ranking-web-overrides.css',
  'standard-pages-web.css',
  'shop-ui-contract.css',
  'psg1-ui.css',
  'psg1-screens.css',
];
const fixture = `
let pressed=''; window.calls=[]; window.rankState='ready'; window.socialState='locked';
window.open=(...args)=>{window.calls.push(['open',...args]);return {opener:null}};
const input={getActiveMethod:()=>({isDownAny:key=>key===pressed})};
const navigator={push:(...args)=>window.calls.push(['push',...args])};
const deps={isPsg1Ui:()=>document.documentElement.dataset.uiDevice==='psg1',
MenuInputContext:{HorizontalPrev:'left',HorizontalNext:'right',VerticalPrev:'up',VerticalNext:'down',Select:'select',Back:'back'},
GameSceneType:new Proxy({},{get:(_,key)=>key}),animateBackNavigation:()=>window.calls.push(['back']),getApiUrl:url=>url,
apiFetch:async url=>{window.calls.push(['api',url]);if(window.socialState==='error')throw Error('fixture unavailable');return {ok:true,json:async()=>url.includes('/x/')?(window.socialState==='locked'?{}:{connected:true,follows:true,repostTask:{id:'repost',postId:'123',rewardFuel:2,claimed:true},commentTask:{id:'comment',postId:'123',rewardFuel:3,claimed:false}}):{authenticated:true,verified:true,rewardClaimed:true}}},
RankingClient:class {async getRankings(scope,season){window.calls.push(['rank',scope,season]);if(window.rankState==='loading')return new Promise(()=>{});if(window.rankState==='error')return null;return {currentSeason:{number:7},seasons:[{id:'s6',name:'Season 6'},{id:'s5',name:'Season 5'}],me:{rank:12,totalPoints:93750},rows:window.rankState==='empty'?[]:Array.from({length:30},(_,i)=>({playerId:'p'+i,rank:i+1,displayName:i===0?'COMMANDER LONG PLAYER NAME':'PLAYER '+(i+1),perks:[],totalPoints:Math.max(0,98000-i*1000)}))}}}};
const require=()=>deps;
${modules
  .map(
    (code) =>
      `Object.assign(deps,(()=>{const exports={};${code};return exports})());`,
  )
  .join('\n')}
window.mountScreen=name=>{window.screenUi?.unmount();window.screenUi=new deps[name](navigator,input);window.screenUi.mount()};
window.press=key=>{pressed=key;window.screenUi.update();pressed=''};
window.mountScreen('HeadquartersWebUi');`;
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(
      '<!doctype html><html data-ui-device="psg1" data-ui-platform="android"><head>' +
        styles
          .map((s) => '<link rel="stylesheet" href="/' + s + '">')
          .join('') +
        '</head><body class="web-ui-active game-running"><div class="web-ui" data-web-ui></div><script>' +
        fixture +
        '</script></body></html>',
    );
  }
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, rel.startsWith('/data/') ? '' : 'public', rel);
  const mime = {
    '.css': 'text/css',
    '.png': 'image/png',
    '.ttf': 'font/ttf',
    '.woff2': 'font/woff2',
  }[path.extname(file)];
  if (mime) res.setHeader('Content-Type', mime);
  fs.readFile(file, (e, data) => {
    res.statusCode = e ? 404 : 200;
    res.end(e ? '' : data);
  });
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const screens = ['HeadquartersWebUi', 'SocialsWebUi', 'RankingWebUi'];
    const mount = async (name) => {
      await page.evaluate((name) => window.mountScreen(name), name);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        );
      });
    };
    for (const [width, height] of [
      [1280, 800],
      [1280, 720],
      [960, 540],
      [640, 480],
      [1024, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto('http://127.0.0.1:' + server.address().port);
      for (const screen of screens) {
        await mount(screen);
        const bounds = await page.evaluate(() => ({
          scroll: [
            document.documentElement.scrollWidth,
            document.documentElement.scrollHeight,
          ],
          nav: [...document.querySelector('[data-ui-nav]').children]
            .filter((e) => !e.hasAttribute('data-ui-spacer'))
            .map((e) => e.getBoundingClientRect().toJSON()),
          grid: document
            .querySelector('.operations-web__grid, .ranking-web__rows')
            .getBoundingClientRect()
            .toJSON(),
        }));
        if (bounds.scroll[0] > width || bounds.scroll[1] > height)
          errors.push(screen + ' document overflow at ' + width);
        if (bounds.grid.right > width || bounds.grid.bottom > height)
          errors.push(screen + ' content outside viewport at ' + width);
        if (bounds.nav.some((r) => r.right > width || r.y < 0 || r.height < 38))
          errors.push(screen + ' nav clipped at ' + width);
        if (width === 1280 && height === 800)
          await page.screenshot({
            path: path.join(
              __dirname,
              'psg1-' + screen.replace('WebUi', '').toLowerCase() + '.png',
            ),
          });
        console.log(width, height, screen, JSON.stringify(bounds.scroll));
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await mount('HeadquartersWebUi');
    if ((await page.locator('h1').innerText()) !== 'QUATERS')
      errors.push('PSG1 title missing');
    await page.evaluate(() => window.press('right'));
    if (
      (await page.locator(':focus').getAttribute('data-hq-key')) !== 'entry-1'
    )
      errors.push('Quaters directional focus');
    await page.evaluate(() => window.press('select'));
    if (
      !(await page.evaluate(() =>
        window.calls.some((c) => c[0] === 'push' && c[1] === 'MainEvents'),
      ))
    )
      errors.push('Quaters navigation');
    for (let i = 0; i < 7; i++)
      await page.locator('[data-hq-entry="' + i + '"]').click();
    await page.evaluate(() => window.press('back'));
    if (!(await page.evaluate(() => window.calls.some((c) => c[0] === 'back'))))
      errors.push('Back action');
    await mount('SocialsWebUi');
    if (!(await page.locator('[data-social-action="x-repost"]').isDisabled()))
      errors.push('Locked task enabled');
    await page.locator('[data-social-action="website"]').click();
    if (
      !(await page.evaluate(() =>
        window.calls.some(
          (c) => c[0] === 'open' && c[1] === 'https://battlecities.com',
        ),
      ))
    )
      errors.push('Social website action');
    await page.evaluate(() => (window.socialState = 'ready'));
    await page.locator('[data-social-refresh]').click();
    await page.locator('[data-social-action="x-repost"].is-complete').waitFor();
    await page.screenshot({
      path: path.join(__dirname, 'psg1-socials-ready.png'),
    });
    await page.evaluate(() => (window.socialState = 'error'));
    await page.locator('[data-social-refresh]').click();
    await page.getByText('SOCIAL VERIFICATION UNAVAILABLE').waitFor();
    await mount('RankingWebUi');
    await page.locator('[data-rank-scope="trading"]').click();
    if (
      !(await page.evaluate(() =>
        window.calls.some((c) => c[0] === 'rank' && c[1] === 'trading'),
      ))
    )
      errors.push('Trading filter');
    await page.locator('[data-rank-season-toggle]').click();
    await page.locator('[data-rank-season-option="s6"]').click();
    if (
      !(await page.evaluate(() =>
        window.calls.some((c) => c[0] === 'rank' && c[2] === 's6'),
      ))
    )
      errors.push('Season filter');
    await page.locator('[data-rank-season-toggle]').click();
    await page.evaluate(() => window.press('back'));
    if (
      (await page
        .locator('[data-rank-season-toggle]')
        .getAttribute('aria-expanded')) !== 'false'
    )
      errors.push('Season menu Back');
    await page.locator('[data-rank-player="p0"]').click();
    if (
      !(await page.evaluate(() =>
        window.calls.some(
          (c) => c[0] === 'push' && c[1] === 'MainPlayerProfile',
        ),
      ))
    )
      errors.push('Player profile navigation');
    for (const state of ['empty', 'error', 'loading']) {
      await page.evaluate((state) => (window.rankState = state), state);
      await mount('RankingWebUi');
      if (!(await page.locator('.ranking-web__empty').isVisible()))
        errors.push('Missing ranking ' + state);
    }
    // Non-PSG devices: the new sheet must not alter any of these screens.
    for (const [device, width, height] of [
      ['desktop', 1280, 800],
      ['android', 375, 812],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(
        (device) => (document.documentElement.dataset.uiDevice = device),
        device,
      );
      for (const screen of screens) {
        await mount(screen);
        const unchanged = await page.evaluate(() => {
          const sheet = [...document.styleSheets].find((s) =>
            s.href?.endsWith('psg1-screens.css'),
          );
          const nodes = [...document.querySelectorAll('main, main *')];
          const snapshot = () =>
            nodes
              .map((el) => {
                const s = getComputedStyle(el);
                return [
                  s.display,
                  s.width,
                  s.height,
                  s.padding,
                  s.fontSize,
                  s.background,
                  s.border,
                  s.gridTemplateColumns,
                ].join('|');
              })
              .join('\n');
          const before = snapshot();
          sheet.disabled = true;
          const after = snapshot();
          sheet.disabled = false;
          return before === after;
        });
        if (!unchanged)
          errors.push('Non-PSG style leak: ' + device + ' ' + screen);
      }
    }
    if (errors.length) throw Error(errors.join('\n'));
    console.log(
      'PASS: layout, gamepad, destinations, social states/actions, ranking filters/states, desktop + Android isolation.',
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  server.close();
});
