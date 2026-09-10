// Real ResultsWebUi with a fake scene controller. No real sharing or navigation.
const fs = require('fs');
const path = require('path');
const http = require('http');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const modules = ['src/webUi/focusScroll.ts', 'src/webUi/psg1Console.ts', 'src/webUi/ResultsWebUi.ts'].map(
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
  'standard-pages-web.css',
  'results-web.css',
  'shop-ui-contract.css',
  'psg1-ui.css',
  'psg1-screens.css',
  'psg1-results.css',
];
const fixture = `
window.calls=[];let pressed='';window.state=null;
const deps={isPsg1Ui:()=>document.documentElement.dataset.uiDevice==='psg1',MenuInputContext:{HorizontalPrev:'left',HorizontalNext:'right',VerticalPrev:'up',VerticalNext:'down',Select:'select',Back:'back'}};const require=()=>deps;
${modules
  .map(
    (code) =>
      `Object.assign(deps,(()=>{const exports={};${code};return exports})());`,
  )
  .join('\n')}
const controller={advanceResultsFromWebUi:()=>{},getResultsWebUiState:()=>window.state,continueFromWebUi:()=>window.calls.push('continue'),shareResultsFromWebUi:async()=>{window.calls.push('share');window.state.status='REPORT COPIED'}};
window.mount=(result='perfect',count=4)=>{window.ui?.unmount();window.state=result==='loading'?null:{battleTime:'04:32',defeated:80,enemyTotal:80,highscore:999999,mvp:'COMMANDER VANGUARD',players:Array.from({length:count},(_,i)=>({bonus:i===0?1000:0,isPrimary:i===0,kills:[12,4,3,1],name:i===1?'AN EXTREMELY LONG COMMANDER NAME':'COMMANDER '+(i+1),rank:i+1,totalKills:20,totalPoints:999999-i*1000})),result,stage:99,status:'WAITING FOR COMMANDERS',timer:'NEXT ROUND IN 15',totalKills:80};window.ui=new deps.ResultsWebUi({getController:()=>controller,inputManager:{getActiveMethod:()=>({isDownAny:k=>pressed===k})}});window.ui.mount();window.ui.update(0)};
window.press=key=>{pressed=key;window.ui.update(0);pressed=''};window.mount();`;
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(
      '<!doctype html><html data-ui-device="psg1"><head>' +
        styles
          .map((s) => '<link rel="stylesheet" href="/' + s + '">')
          .join('') +
        '</head><body class="game-running"><div class="web-ui" data-web-ui></div><script>' +
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
  fs.readFile(file, (error, data) => {
    res.statusCode = error ? 404 : 200;
    res.end(error ? '' : data);
  });
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const assert = (ok, message) => {
      if (!ok) errors.push(message);
    };
    for (const [width, height] of [
      [1280, 1100],
      [1280, 800],
      [960, 540],
      [640, 480],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page.evaluate(() => document.fonts.ready);
      for (const result of ['perfect', 'clear', 'failed'])
        for (const count of [1, 4, 8]) {
          await page.evaluate(
            ([result, count]) => window.mount(result, count),
            [result, count],
          );
          const layout = await page.evaluate(() => {
            const list = document.querySelector('.results-web__players'),
              fixed = [
                ...document.querySelectorAll(
                  '.results-web__header,.results-web__status-strip,.results-web__footer,.results-web__actions',
                ),
              ];
            const tops = fixed.map((e) => e.getBoundingClientRect().top);
            list.scrollTop = list.scrollHeight;
            const stable = fixed.every(
              (e, i) => Math.abs(e.getBoundingClientRect().top - tops[i]) < 1,
            );
            list.scrollTop = 0;
            const rows = [...list.children],
              r = (e) => e.getBoundingClientRect();
            const fits = rows.every((row, i) => {
              const box = r(row);
              return (
                (i === 0 || box.top >= r(rows[i - 1]).bottom) &&
                [...row.children].every((e) => {
                  const child = r(e);
                  return (
                    child.top >= box.top &&
                    child.bottom <= box.bottom &&
                    child.left >= box.left &&
                    child.right <= box.right
                  );
                })
              );
            });
            const controls = [...document.querySelectorAll('button')];
            return {
              stable,
              fits,
              overflow:
                document.documentElement.scrollWidth > innerWidth ||
                document.documentElement.scrollHeight > innerHeight,
              listHeight: list.clientHeight,
              buttons: controls.every(
                (e) =>
                  e.scrollWidth <= e.clientWidth + 1 &&
                  r(e).bottom <= innerHeight,
              ),
              frames: rows.every(
                (e) => getComputedStyle(e).borderTopWidth === '3px',
              ),
              color: getComputedStyle(
                document.querySelector('.results-web__status-strip strong'),
              ).color,
            };
          });
          assert(
            layout.stable &&
              layout.fits &&
              !layout.overflow &&
              layout.buttons &&
              layout.frames &&
              layout.listHeight > 40,
            `${width}x${height} ${result}/${count}: ${JSON.stringify(layout)}`,
          );
          if (result === 'failed')
            assert(
              layout.color === 'rgb(240, 68, 50)',
              'Failed color ' + layout.color,
            );
          if (width === 1280 && height === 800 && count === 4)
            await page.screenshot({
              path: path.join(__dirname, 'psg1-results-' + result + '.png'),
            });
        }
      await page.evaluate(() => window.mount('loading'));
      assert(
        (await page.locator('.results-web--loading.psg1-console').count()) ===
          1,
        'Loading frame',
      );
      await page.evaluate(() => window.mount('clear', 8));
      await page.evaluate(() => window.press('down'));
      assert(
        await page
          .locator('.results-web__players')
          .evaluate((e) => e === document.activeElement),
        'Enter player scroll',
      );
      await page.evaluate(() => window.press('down'));
      assert(
        await page
          .locator('.results-web__players')
          .evaluate((e) => e.scrollTop > 0),
        'D-pad scroll',
      );
      await page.evaluate(() => {
        const list = document.querySelector('.results-web__players');
        list.scrollTop = list.scrollHeight;
        window.press('down');
      });
      assert(
        (await page.locator(':focus').getAttribute('data-results-key')) ===
          'share',
        'Exit scroll to share',
      );
      await page.evaluate(() => window.press('select'));
      await page.getByText('REPORT COPIED').waitFor();
      assert(
        (await page.locator(':focus').getAttribute('data-results-key')) ===
          'share',
        'Share focus restoration',
      );
      assert(
        await page.evaluate(() => window.calls.includes('share')),
        'Mock share',
      );
      await page.evaluate(() => {
        window.state.timer = 'NEXT ROUND IN 3';
        window.state.status = 'WAITING FOR NEXT STAGE';
        window.ui.update(0);
      });
      assert(
        (await page.locator('[data-results-timer]').textContent()) ===
          'NEXT ROUND IN 3',
        'Timer sync',
      );
      await page.evaluate(() => window.press('back'));
      assert(
        await page.evaluate(() => window.calls.includes('continue')),
        'Continue action',
      );
      console.log(
        width,
        height,
        'results, player counts, scrolling and actions checked',
      );
    }
    for (const [device, width] of [
      ['desktop', 1280],
      ['android', 390],
    ]) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate((d) => {
        document.documentElement.dataset.uiDevice = d;
        window.mount();
      }, device);
      assert(
        await page.evaluate(() => {
          const sheet = [...document.styleSheets].find((s) =>
            s.href?.endsWith('psg1-results.css'),
          );
          const snapshot = () =>
            [...document.querySelectorAll('main,main *')]
              .map((e) => {
                const s = getComputedStyle(e);
                return [
                  s.width,
                  s.height,
                  s.fontSize,
                  s.background,
                  s.border,
                ].join('|');
              })
              .join(';');
          const before = snapshot();
          sheet.disabled = true;
          const same = before === snapshot();
          sheet.disabled = false;
          return same && !document.querySelector('.psg1-console');
        }),
        device + ' isolation',
      );
    }
    if (errors.length) throw Error(errors.join('\n'));
    console.log(
      'PASS: result states, multiplayer rows, fixed summaries, controls, gamepad scroll, share focus, timer sync and platform isolation.',
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
