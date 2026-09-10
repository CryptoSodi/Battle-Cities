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
const tabNavigationCode = ts.transpileModule(fs.readFileSync(path.join(root, 'src/webUi/psg1TabNavigation.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const layoutCode = ts.transpileModule(fs.readFileSync(path.join(root, 'src/webUi/focusScroll.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const deviceCode = ts.transpileModule(fs.readFileSync(path.join(root, 'src/webUi/deviceUi.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const navigationFixture = `
let pressed='';window.routes=[];
const deps={isPsg1Ui:()=>document.documentElement.dataset.uiDevice==='psg1',
isPlaySolanaPsg1:profile=>profile?.model==='PSG1',
MenuInputContext:{HorizontalPrev:'left',HorizontalNext:'right',VerticalPrev:'up',VerticalNext:'down',Select:'select',Back:'back',PreviousTab:'l',NextTab:'r'},
EventClient:class {},TradingClient:class {},CherryChatWebUi:class {getLauncher(){return null}blocksMenuInput(){return false}},
beginSinglePlayerReplaySession:()=>{},GameSceneType:{MainTankSelect:'tank-select'}};
const require=()=>deps;
(()=>{const exports={};${deviceCode};Object.assign(deps,exports)})();window.initializeLayout=deps.initializeDeviceUi;
(()=>{const exports={};${tabNavigationCode};Object.assign(deps,exports)})();
(()=>{const exports={};${layoutCode};Object.assign(deps,exports)})();
const Menu=(()=>{const exports={};${compiled};return exports.MainMenuWebUi})();
const ui=new Menu({inputManager:{getActiveMethod:()=>({isDownAny:key=>key===pressed})},navigator:{push:route=>window.routes.push(route)}});
ui.host=document.querySelector('[data-web-ui]');ui.active=true;ui.abortController=new AbortController();
ui.syncDeviceLayout();deps.bindUiLayoutRefresh(ui.host,ui.abortController.signal,()=>ui.syncDeviceLayout());ui.bindActions();ui.bindRewardTabs();ui.focusInitialAction();window.menuUi=ui;
window.press=key=>{pressed=key;ui.update();pressed=''};
`;
const setup = '';
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
      )};window.fill=name=>{const rows=document.querySelector('[data-home-rewards-rows]');rows.innerHTML=fixtures[name];rows.scrollTop=0};window.fill('full');${navigationFixture}</script></body></html>`,
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
      if (await page.locator(':focus').getAttribute('data-menu-action') !== 'start') errors.push('START not selected initially');
      if (await page.locator('[data-menu-action].is-selected').count() !== 1 || await page.locator('[data-menu-action].is-selected').getAttribute('data-menu-action') !== 'start') errors.push('Initial selection highlight is not START');
      await page.locator('[data-reward-tab-button="rewards"]').click();
      await page.locator('[data-menu-action="start"]').focus();
      await page.evaluate(() => window.press('r'));
      if (await page.locator('main').getAttribute('data-reward-tab') !== 'leaderboard' || await page.locator(':focus').getAttribute('data-menu-action') !== 'start') errors.push('Home R shortcut lost START focus');
      await page.evaluate(() => window.press('l'));
      if (await page.locator('main').getAttribute('data-reward-tab') !== 'rewards') errors.push('Home L shortcut failed');
      const reachable = await page.evaluate(() => {
        for(let i=0;i<20;i++){window.press('down');if(document.activeElement.hasAttribute('data-reward-tab-button'))return true}return false;
      });
      if (!reachable) errors.push('Home tabs absent from D-pad queue');
      await page.locator('[data-reward-tab-button="leaderboard"]').focus();
      await page.evaluate(() => window.press('select'));
      if (await page.locator('main').getAttribute('data-reward-tab') !== 'leaderboard' || await page.evaluate(() => window.routes.length)) errors.push('Tab Select launched a menu action');
      await page.evaluate(() => window.press('down'));
      if (await page.locator(':focus').getAttribute('data-reward-tab-button')) errors.push('Home tab focus trapped');
      const hintsFit = await page.locator('.psg1-home-tab-content').evaluateAll(nodes => nodes.every(node => {
        const box=node.closest('button').getBoundingClientRect();return [...node.children].every(child=>{const r=child.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom});
      }));
      if (!hintsFit) errors.push('Home L/R hints or labels clipped '+width);
      await page.locator('[data-menu-action="start"]').focus();
      if (width === 1280 && height === 800) await page.screenshot({path:path.join(__dirname, 'psg1-home-navigation.png')});
      const protectedState = await page.evaluate(() => {
        const main=document.querySelector('main'),before=main.dataset.rewardTab;
        const dialog=document.createElement('dialog');dialog.open=true;window.menuUi.host.append(dialog);window.press('r');dialog.remove();
        if(main.dataset.rewardTab!==before)return false;
        window.menuUi.cherryChat.blocksMenuInput=()=>true;window.press('r');window.menuUi.cherryChat.blocksMenuInput=()=>false;
        if(main.dataset.rewardTab!==before)return false;
        document.documentElement.dataset.uiDevice='desktop';window.press('r');document.documentElement.dataset.uiDevice='psg1';
        return main.dataset.rewardTab===before;
      });
      if (!protectedState) errors.push('Shoulders bypassed modal/chat/device guard');
      const hintsFollowLegend = await page.evaluate(() => {
        const footer=document.querySelector('.main-menu-web__hazard');
        const guide=document.querySelector('[data-psg1-footer-guide]');
        const hints=[...document.querySelectorAll('.psg1-home-tab-content kbd')];
        const labels=[...document.querySelectorAll('.psg1-home-tab-content > span')];
        const layout=()=>JSON.stringify(labels.map(e=>e.getBoundingClientRect().toJSON()));
        const before=layout();
        if(!hints.every(e=>getComputedStyle(e).visibility==='visible'))return false;
        guide.classList.add('main-menu-web__psg1-footer-guide--hidden');
        footer.classList.add('main-menu-web__hazard--guide-dismissed');
        const hidden=getComputedStyle(guide).visibility==='hidden'&&hints.every(e=>getComputedStyle(e).visibility==='hidden')&&layout()===before;
        const tab=document.querySelector('main').dataset.rewardTab;
        window.press('r');
        const shortcutWorks=document.querySelector('main').dataset.rewardTab!==tab;
        window.press('l');
        guide.classList.remove('main-menu-web__psg1-footer-guide--hidden');
        footer.classList.remove('main-menu-web__hazard--guide-dismissed');
        return hidden&&shortcutWorks&&hints.every(e=>getComputedStyle(e).visibility==='visible')&&layout()===before;
      });
      if (!hintsFollowLegend) errors.push('L/R hints did not follow legend visibility without shifting labels');
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
    await page.locator('[data-reward-tab-button="leaderboard"]').click();
    await page.locator('[data-menu-action="start"]').focus();
    await page.evaluate(()=>window.initializeLayout());
    for(const width of [1440,1279,900,899,640,1024,1280,960]) {
      await page.setViewportSize({width,height:800});
      await page.waitForFunction(width=>document.documentElement.dataset.uiDevice===(width>=900&&width<1280?'psg1':'standard'),width);
      const transition=await page.evaluate(()=>{
        const medium=document.documentElement.dataset.uiResponsive==='true';
        const sidebar=document.querySelectorAll('.psg1-round-sidebar');
        const clock=document.querySelectorAll('.main-menu-web__reward-clock');
        const settings=document.querySelector('[data-menu-action="settings"]');
        const geometry=sidebar.length===(medium?1:0)&&clock.length===(medium?1:2)&&!!settings.closest('.main-menu-web__hud')===medium;
        const hints=!medium||(getComputedStyle(document.querySelector('[data-psg1-footer-guide]')).display==='none'&&getComputedStyle(document.querySelector('.main-menu-web__ticker-window')).visibility==='visible'&&getComputedStyle(document.querySelector('.psg1-home-tab-content kbd')).visibility==='hidden');
        return geometry&&hints&&document.querySelector('main').dataset.rewardTab==='leaderboard'&&document.activeElement.dataset.menuAction==='start';
      });
      if(!transition)errors.push('Home resize structure/focus/tab/controller hints '+width);
      if(width===1024)await page.screenshot({path:path.join(__dirname,'responsive-medium-home.png')});
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
