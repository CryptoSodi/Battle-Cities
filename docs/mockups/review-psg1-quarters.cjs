// Real Quaters page renderer with local-only fixtures; never contacts wallets/APIs.
const fs = require('fs');
const path = require('path');
const http = require('http');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const modules = [
  'src/webUi/focusScroll.ts',
  'src/webUi/psg1TabNavigation.ts',
  'src/wiki/WikiData.ts',
  'src/webUi/psg1Console.ts',
  'src/webUi/HeadquartersWebUi.ts',
  'src/webUi/HeadquartersPagesWebUi.ts',
].map(
  (file) =>
    ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
);
const styles = [
  'main.css',
  'main-menu-web.css',
  'shop-web.css',
  'operations-web.css',
  'headquarters-pages-web.css',
  'shop-ui-contract.css',
  'psg1-ui.css',
  'psg1-screens.css',
  'psg1-quarters.css',
  'psg1-backgrounds.css',
];
const fixture = `
let pressed='';window.calls=[];window.fixtureState='ready';
const navigator={push:(...args)=>window.calls.push(['push',...args])};
const input={getActiveMethod:()=>({isDownAny:key=>key===pressed})};
window.open=(...args)=>{window.calls.push(['open',...args]);return {opener:null}};
const ready=async(value,empty=null)=>{if(window.fixtureState==='error')throw Error('offline');if(window.fixtureState==='loading')return new Promise(()=>{});return window.fixtureState==='empty'?empty:value};
const rows=Array.from({length:24},(_,i)=>({rank:i+1,displayName:'COMMANDER '+(i+1),staked:1000,totalSp:5000,amount:100-i}));
const event={slug:'operation-one',name:'OPERATION IRON FRONT',description:'Play battles and complete objectives for campaign rewards.',status:'active',prizePool:'25,000 BATC'};
const deps={
isPsg1Ui:()=>document.documentElement.dataset.uiDevice==='psg1',
MenuInputContext:{HorizontalPrev:'left',HorizontalNext:'right',VerticalPrev:'up',VerticalNext:'down',Select:'select',Back:'back',PreviousTab:'l',NextTab:'r'},
GameSceneType:new Proxy({},{get:(_,key)=>key}),animateBackNavigation:()=>window.calls.push(['back']),
apiFetch:async url=>({ok:true,json:async()=>url.endsWith('account')?ready({authenticated:true,account:{tokenBalance:12500,solBalance:1.25,fuelBalance:20,inventory:{shield:2,'base-defence':3,freeze:4,speed:5,upgrade:1,'zoom-out':2,wipeout:3,'extra-life':1}}},{authenticated:false}):ready({entries:rows.map(r=>({currency:'BATC',amount:150,reason:'CAMPAIGN REWARD',createdAt:'2026-09-10T00:00:00Z'}))},{entries:[]})}),
StakingClient:class {
getSummary(){return ready({epoch:{number:7,day:3,lengthDays:30,rewardPool:25000},community:{lockedTokens:1200000},me:{staked:1500,latestSp:125,totalSp:9500,estimatedReward:250,perkTier:{level:2}},unstakes:[{amount:500,claimable:true,claimableAt:'2026-09-11'}]})}
getLeaderboard(){return ready(rows,[])}
async stake(n){window.calls.push(['stake',n]);return {ok:false,error:'TEST STAKE DECLINED'}}
async unstake(n){window.calls.push(['unstake',n]);return {ok:false,error:'TEST UNSTAKE DECLINED'}}
async claimUnstaked(){window.calls.push(['claim']);return {ok:false,error:'TEST CLAIM DECLINED'}}
},
TradingClient:class {
listTokens(){return ready(Array.from({length:8},(_,i)=>({symbol:'TOKEN '+(i+1),name:'MARKET ASSET '+(i+1),group:i%2?'partner':'major',trait:'armor',mint:'mint'+i})),[])}
getBoostStatus(){return ready({authenticated:true,trading:{boosts:{armor:8,speed:4,damage:5,luck:2},totalVolumeUsd:2500,rows:[{symbol:'SOL',group:'major',trait:'all',volumeUsd:2500}]},staking:{tier:{level:2},staked:1500,nextTier:{stake:5000}}})}
async verifySwap(p){window.calls.push(['swap',p.toMint]);return {ok:false,error:'TEST SWAP DECLINED'}}
},
EventClient:class {
listEvents(){return ready([event,{...event,slug:'operation-two',name:'SECOND FRONT'}],[])}
listPhases(){return ready([{name:'PHASE ONE',rewardPool:'10,000 BATC',status:'ACTIVE'}],[])}
getEventDetail(){return ready({item:{...event,currency:'BATC',currencyBalance:150,quests:[{id:'locked',name:'WIN FIVE BATTLES',description:'Win ranked battles in the active campaign.',value:2,target:5,completed:false},{id:'ready',name:'COMPLETE TRAINING',description:'Finish your first mission.',value:1,target:1,completed:true}]},me:{rank:3,amount:150}})}
getEventLeaderboard(){return ready(rows,[])}
async claimQuest(id){window.calls.push(['quest',id]);return {ok:false,error:'TEST QUEST DECLINED'}}
},
AirdropClient:class {
listCampaigns(){return ready([{slug:'drop-one',name:'COMMANDER AIRDROP',status:'active'}],[])}
getDiscordVerification(){return ready({verified:false})}
getEligibility(){return ready({frozen:true,weight:1250,allocation:500,claimedAt:null})}
async claim(slug){window.calls.push(['airdrop',slug]);return {ok:false,error:'TEST AIRDROP DECLINED'}}
}
};const require=()=>deps;
${modules
  .map(
    (code) =>
      `Object.assign(deps,(()=>{const exports={};${code};return exports})());`,
  )
  .join('\n')}
window.mountPage=scene=>{window.ui?.unmount();window.ui=new deps.HeadquartersPagesWebUi(navigator,input);window.ui.mount(scene)};
window.press=key=>{pressed=key;window.ui.update();pressed=''};
`;
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(
      '<!doctype html><html data-ui-device="psg1" data-ui-platform="android"><head>' +
        styles
          .map((s) => '<link rel="stylesheet" href="/' + s + '">')
          .join('') +
        '</head><body class="web-ui-active game-running"><div data-web-ui class="web-ui"></div><script>' +
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
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const scenes = [
      'MainTreasury',
      'MainEvents',
      'MainStaking',
      'MainTrading',
      'MainBoost',
      'MainAirdrop',
      'MainWiki',
    ];
    const mount = async (scene, state = 'ready') => {
      await page.evaluate(
        ([scene, state]) => {
          window.fixtureState = state;
          window.mountPage(scene);
        },
        [scene, state],
      );
      if (state !== 'loading')
        await page.waitForFunction(() => !window.ui.loading);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        );
      });
    };
    const check = async (label) => {
      const result = await page.evaluate(() => {
        const root = document.querySelector('main'),
          nav = root.querySelector('[data-ui-nav]'),
          shell = root.querySelector('.hq-page-web__shell'),
          content = root.querySelector('.hq-page-web__content'),
          heading = shell.querySelector(':scope > header'),
          status = root.querySelector('.hq-page-web__status');
        const fixed = [nav, status, ...(heading ? [heading] : [])],
          before = fixed.map((e) => e.getBoundingClientRect().top);
        content.scrollTop = content.scrollHeight;
        const stable = fixed.every(
          (e, i) => Math.abs(e.getBoundingClientRect().top - before[i]) < 1,
        );
        content.scrollTop = 0;
        const controls = [
          ...nav.querySelectorAll('[data-ui-tab],[data-ui-back]'),
        ];
        return {
          overflow:
            document.documentElement.scrollWidth > innerWidth ||
            document.documentElement.scrollHeight > innerHeight,
          stable,
          skin: root.classList.contains('psg1-console'),
          frames: [
            ...root.querySelectorAll(
              '.hq-page-web__stat,.hq-page-web__card,.hq-page-web__item,.hq-page-web__manual-card,.hq-page-web__empty',
            ),
          ].every((e) => getComputedStyle(e).borderTopWidth === '3px'),
          shellSurface: (() => {
            const shell = root.querySelector('.hq-page-web__shell');
            const style = getComputedStyle(shell);
            return style.borderTopWidth === '3px' &&
              style.backgroundImage !== 'none' &&
              style.boxShadow.includes('rgb(37, 143, 168)') &&
              getComputedStyle(shell, '::before').content !== 'none';
          })(),
          nav: controls.every((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.left >= 0 &&
              r.right <= innerWidth &&
              r.bottom <= innerHeight &&
              e.scrollWidth <= e.clientWidth + 1
            );
          }),
          contentBounds:
            content.getBoundingClientRect().bottom <=
            status.getBoundingClientRect().top + 1,
        };
      });
      if (
        result.overflow ||
        !result.stable ||
        !result.skin ||
        !result.frames ||
        !result.shellSurface ||
        !result.nav ||
        !result.contentBounds
      )
        errors.push(label + ' ' + JSON.stringify(result));
    };
    for (const [width, height] of [
      [1280, 1100],
      [1280, 800],
      [960, 540],
      [640, 480],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto('http://127.0.0.1:' + server.address().port);
      for (const scene of scenes) {
        await mount(scene);
        await check(scene + ' ' + width + 'x' + height);
        if (width === 1280 && height === 800)
          await page.screenshot({
            path: path.join(
              __dirname,
              'psg1-quarter-' +
                scene.replace('Main', '').toLowerCase() +
                '.png',
            ),
          });
        for (const tab of await page
          .locator('[data-page-tab]:not(:disabled)')
          .evaluateAll((nodes) => nodes.map((e) => e.dataset.pageTab))) {
          await page.locator('[data-page-tab="' + tab + '"]').click();
          await page.waitForFunction(() => !window.ui.loading);
          await check(scene + '/' + tab + ' ' + width);
        }
        if (scene === 'MainEvents') {
          await page
            .locator('[data-event]')
            .first()
            .click();
          await page.waitForFunction(() => !window.ui.loading);
          await check('Event detail ' + width);
          if (!(await page.locator('[data-quest="locked"]').isDisabled()))
            errors.push('Unfinished quest enabled');
          await page.locator('[data-page-tab="events-leaderboard"]').click();
          await page.waitForFunction(() => !window.ui.loading);
          await check('Event leaderboard ' + width);
        }
      }
      console.log(width, height, 'all seven destinations and tabs checked');
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const scene of scenes.filter((s) => s !== 'MainWiki'))
      for (const state of ['empty', 'error', 'loading']) {
        await mount(scene, state);
        await check(scene + '/' + state);
        if (state === 'error' && scene !== 'MainTreasury') {
          await page.evaluate(() => (window.fixtureState = 'ready'));
          await page.locator('[data-page-retry]').click();
          await page.waitForFunction(() => !window.ui.loading);
          await check(scene + '/retry');
        }
      }
    await mount('MainTreasury');
    await page.locator('[data-page-tab="treasury-holdings"]').focus();
    await page.evaluate(() => window.press('r'));
    if (await page.locator('[data-page-tab="treasury-history"]').getAttribute('aria-current') !== 'page') errors.push('Treasury R shortcut');
    await page.evaluate(() => window.press('l'));
    if (await page.locator('[data-page-tab="treasury-holdings"]').getAttribute('aria-current') !== 'page') errors.push('Treasury L shortcut');
    await page.locator('[data-page-tab="treasury-history"]').click();
    await page.evaluate(() => window.press('left'));
    if (
      (await page.locator(':focus').getAttribute('data-page-tab')) !==
      'treasury-holdings'
    )
      errors.push('Gamepad tab focus');
    await page.evaluate(() => window.press('select'));
    if (
      (await page
        .locator('[data-page-tab="treasury-holdings"]')
        .getAttribute('aria-current')) !== 'page'
    )
      errors.push('Gamepad Select');
    await page.evaluate(() => window.press('back'));
    if (!(await page.evaluate(() => window.calls.some((c) => c[0] === 'back'))))
      errors.push('Back failed');
    await mount('MainStaking');
    await page.locator('[data-stake-action="stake"]').click();
    await page.getByText('TEST STAKE DECLINED').waitFor();
    if (
      (await page.locator(':focus').getAttribute('data-stake-action')) !==
      'stake'
    )
      errors.push('Action focus lost after rerender');
    for (const [device, width] of [
      ['desktop', 1280],
      ['android', 390],
    ]) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate(
        (d) => (document.documentElement.dataset.uiDevice = d),
        device,
      );
      for (const scene of scenes) {
        await mount(scene);
        const same = await page.evaluate(() => {
          const sheet = [...document.styleSheets].find((s) =>
            s.href?.endsWith('psg1-quarters.css'),
          );
          const snapshot = () =>
            [...document.querySelectorAll('main,main *')]
              .map((e) => {
                const s = getComputedStyle(e);
                return [
                  s.width,
                  s.height,
                  s.fontSize,
                  s.display,
                  s.background,
                  s.border,
                ].join('|');
              })
              .join(';');
          const before = snapshot();
          sheet.disabled = true;
          const after = snapshot();
          sheet.disabled = false;
          return before === after && !document.querySelector('.psg1-console');
        });
        if (!same) errors.push(device + ' style leakage ' + scene);
      }
    }
    if (errors.length) throw Error(errors.join('\n'));
    console.log(
      'PASS: Quaters layouts, tabs, loading/empty/error/retry states, gamepad, mock action, focus restoration and device isolation.',
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
