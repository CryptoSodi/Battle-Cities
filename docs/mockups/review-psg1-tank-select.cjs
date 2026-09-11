// Exercise the real roster using local fuel/navigation fixtures, never a live run.
const fs = require('fs');
const path = require('path');
const http = require('http');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const code = ['src/webUi/focusScroll.ts', 'src/webUi/psg1Console.ts', 'src/webUi/TankSelectWebUi.ts'].map(
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
  'tank-select-web.css',
  'shop-ui-contract.css',
  'psg1-ui.css',
  'psg1-screens.css',
  'psg1-tank-select.css',
  'psg1-backgrounds.css',
  'android-screens.css',
];
const fixture = `
window.fuel=12;window.calls=[];let pressed='';
const deps={isPsg1Ui:()=>document.documentElement.dataset.uiDevice==='psg1',TankTier:{A:'A',B:'B',C:'C',D:'D'},GameSceneType:{MainShop:'shop'},animateBackNavigation:()=>window.calls.push(['back']),MenuInputContext:{HorizontalPrev:'left',HorizontalNext:'right',VerticalPrev:'up',VerticalNext:'down',Select:'select',Back:'back'},ShopManager:class{getFuelBalance(){return window.fuel}canStartRun(cost){return window.fuel>=cost}}};
const require=()=>deps;
${code
  .map(
    (c) =>
      `Object.assign(deps,(()=>{const exports={};${c};return exports})());`,
  )
  .join('\n')}
window.mount=()=>{window.ui?.unmount();window.ui=new deps.TankSelectWebUi({}, {push:(...args)=>window.calls.push(args)}, {getActiveMethod:()=>({isDownAny:k=>k===pressed})},()=>({multiplayer:true,matchId:'test-match'}));window.ui.mount()};
window.press=key=>{pressed=key;window.ui.update();pressed=''};window.mount();`;
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
  fs.readFile(file, (e, data) => {
    res.statusCode = e ? 404 : 200;
    res.end(e ? '' : data);
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
      const layout = await page.evaluate(() => {
        const grid = document.querySelector('.tank-select-web__grid');
        const fixed = [
          ...document.querySelectorAll(
            '.tank-select-web__header,.tank-select-web__fuel,.tank-select-web__section-heading,.tank-select-web__actions',
          ),
        ];
        const tops = fixed.map((e) => e.getBoundingClientRect().top);
        grid.scrollTop = grid.scrollHeight;
        const stable = fixed.every(
          (e, i) => Math.abs(e.getBoundingClientRect().top - tops[i]) < 1,
        );
        grid.scrollTop = 0;
        const cards = [...document.querySelectorAll('[data-tank]')];
        const fits = cards.every((e) => {
          const r = (n) => e.querySelector(n).getBoundingClientRect(),
            title = r('h2'),
            art = r('.tank-select-web__tank-sprite,.tank-select-web__lock'),
            role = r('p'),
            stats = r('dl'),
            price = r('strong'),
            card = e.getBoundingClientRect();
          return (
            title.bottom <= art.top + 1 &&
            art.bottom <= role.top + 1 &&
            role.bottom <= stats.top + 1 &&
            stats.bottom <= price.top + 1 &&
            price.bottom <= card.bottom - 4 &&
            e.scrollWidth <= e.clientWidth + 1
          );
        });
        const columns = getComputedStyle(grid).gridTemplateColumns.split(' ')
          .length;
        const separateRows = cards
          .slice(columns)
          .every(
            (card, index) =>
              card.getBoundingClientRect().top >=
              cards[index].getBoundingClientRect().bottom,
          );
        const style = getComputedStyle(cards[0]);
        const heading = document.querySelector('.tank-select-web__header [data-ui-tab]');
        const headingIcon = heading.querySelector('.ui-page-heading-icon');
        const iconBounds = headingIcon.getBoundingClientRect();
        const headingBounds = heading.getBoundingClientRect();
        return {
          columns,
          stable,
          fits: fits && separateRows,
          card: {
            height: style.height,
            maxHeight: style.maxHeight,
            rows: style.gridTemplateRows,
            gridRows: getComputedStyle(grid).gridTemplateRows,
            autoRows: getComputedStyle(grid).gridAutoRows,
          },
          overflow:
            document.documentElement.scrollWidth > innerWidth ||
            document.documentElement.scrollHeight > innerHeight,
          frames: cards.every(
            (e) => getComputedStyle(e).borderTopWidth === '3px',
          ),
          shellSurface: (() => {
            const shell = document.querySelector('.tank-select-web__shell');
            const shellStyle = getComputedStyle(shell);
            return shellStyle.borderTopWidth === '3px' &&
              shellStyle.backgroundImage !== 'none' &&
              shellStyle.boxShadow.includes('rgb(37, 143, 168)') &&
              getComputedStyle(shell, '::before').content !== 'none';
          })(),
          headingIcon: headingIcon.complete && headingIcon.naturalWidth === 128 &&
            iconBounds.width >= 24 && iconBounds.left >= headingBounds.left && iconBounds.right <= headingBounds.right,
        };
      });
      assert(
        layout.columns === (width <= 1000 ? 2 : 4) && layout.stable && layout.fits && !layout.overflow && layout.frames && layout.shellSurface && layout.headingIcon,
        'Layout ' + width + ' ' + JSON.stringify(layout),
      );
      assert(
        (await page.locator('[data-tank]:disabled').count()) === 4,
        'Locked tanks',
      );
      await page.evaluate(() => window.press('right'));
      assert(
        (await page.locator(':focus').getAttribute('data-tank')) === '1',
        'Right focus',
      );
      await page.evaluate(() => window.press('select'));
      assert(
        await page
          .locator('[data-tank="1"]')
          .getAttribute('class')
          .then((c) => c.includes('is-active')),
        'Select active',
      );
      await page.locator('[data-tank="3"]').focus();
      await page.evaluate(() => window.press('down'));
      assert(
        (await page.locator(':focus').getAttribute('data-tank-continue')) !==
          null,
        'Footer reachable ' + width,
      );
      await page.evaluate(() => window.press('up'));
      assert(
        (await page.locator(':focus').getAttribute('data-tank')) === '3',
        'Return anchor',
      );
      await page.locator('[data-tank-continue]').click();
      assert(
        await page.evaluate(() =>
          window.calls.some(
            (c) =>
              c[0] === 'shop' &&
              c[1].tankTier === 'B' &&
              c[1].fuelCost === 2 &&
              c[1].matchId === 'test-match',
          ),
        ),
        'Continue params',
      );
      await page.evaluate(() => {
        window.fuel = 0;
        window.mount();
      });
      await page.locator('[data-tank-continue]').click();
      assert(
        (await page.locator('.tank-select-web__status').textContent()) ===
          'NEED 1 FUEL - VISIT THE SHOP',
        'Fuel error',
      );
      assert(
        (await page.locator(':focus').getAttribute('data-tank-continue')) !==
          null,
        'Fuel error focus',
      );
      await page.evaluate(() => window.press('back'));
      assert(
        await page.evaluate(() => window.calls.some((c) => c[0] === 'back')),
        'Back',
      );
      await page.evaluate(() => {
        window.fuel = 12;
        window.mount();
      });
      if (width === 1280 && height === 800)
        await page.screenshot({
          path: path.join(__dirname, 'psg1-tank-select.png'),
        });
      console.log(width, height, 'roster layout and controls checked');
    }
    for (const [device, width] of [
      ['desktop', 1280],
      ['android', 320],
      ['android', 375],
      ['android', 390],
      ['android', 640],
      ['android', 899],
    ]) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate((device) => {
        document.documentElement.dataset.uiDevice = device;
        document.documentElement.dataset.uiPlatform = device === 'android' ? 'android' : 'web';
        window.mount();
      }, device);
      assert(await page.locator('.tank-select-web__header .ui-page-heading-icon').evaluate(icon => {
        const bounds=icon.getBoundingClientRect(),heading=icon.closest('[data-ui-tab]').getBoundingClientRect();
        return icon.complete&&icon.naturalWidth===128&&bounds.width>=24&&bounds.left>=heading.left&&bounds.right<=heading.right;
      }), device + ' header tank icon at ' + width);
      assert(await page.evaluate(() => {
        const grid = document.querySelector('.tank-select-web__grid');
        return getComputedStyle(grid).gridTemplateColumns.split(' ').length === (document.documentElement.dataset.uiPlatform === 'android' ? 2 : 4) &&
          [...grid.querySelectorAll('dl div')].every(row => {
            const label = row.querySelector('dt'), value = row.querySelector('dd');
            const l = label.getBoundingClientRect(), v = value.getBoundingClientRect(), r = row.getBoundingClientRect();
            return Math.abs(l.top-v.top)<2 && l.right+3<=v.left && l.left>=r.left-1 && v.right<=r.right+1;
          }) && document.documentElement.scrollWidth <= innerWidth;
      }), device + ' two columns / aligned stat rows at ' + width);
      if(device === 'android') assert(await page.evaluate(() => [...document.querySelectorAll('[data-tank]')].every(card => {
        const art = card.querySelector('.tank-select-web__tank-sprite,.tank-select-web__lock'), bar = card.querySelector(':scope > strong');
        const a = art.getBoundingClientRect(), b = bar.getBoundingClientRect(), c = card.getBoundingClientRect(), stats = card.querySelector('dl').getBoundingClientRect();
        const icon = bar.querySelector('img');
        return getComputedStyle(card.querySelector('.tank-select-web__card-index')).display === 'none' && a.width >= 88 &&
          Math.abs((a.left+a.right)-(c.left+c.right))<2 && a.bottom<=stats.top && stats.bottom<=b.top && b.top-stats.bottom<=11 &&
          b.height>=48 && c.bottom-b.bottom<=14 && (!icon || icon.getBoundingClientRect().width>=32) && card.scrollWidth<=card.clientWidth+1;
      })), 'Android enlarged art / bottom fuel bar at ' + width);
      if(device === 'android') assert(await page.evaluate(() => {
        const shell = document.querySelector('.tank-select-web__shell').getBoundingClientRect();
        const button = document.querySelector('.tank-select-web__continue').getBoundingClientRect();
        const status = document.querySelector('.tank-select-web__status');
        return getComputedStyle(status).display === 'none' && button.height >= 44 && shell.bottom-button.bottom <= 16;
      }), 'Android compact empty footer at ' + width);
      if(device === 'android' && width === 390) await page.screenshot({path:path.join(__dirname,'android-tank-select-two-columns.png')});
      if(device === 'android') {
        await page.locator('[data-tank="3"]').click();
        assert(await page.locator('.tank-select-web__fuel').evaluate(panel => {
          const box = panel.getBoundingClientRect();
          return [...panel.querySelectorAll('span,small,b,strong,img')].every(element => {
            const r = element.getBoundingClientRect();
            return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom && element.scrollWidth <= element.clientWidth+1;
          }) && [...panel.querySelectorAll('span,small')].every(element => parseFloat(getComputedStyle(element).fontSize)>=14) &&
            parseFloat(getComputedStyle(panel.querySelector('b')).fontSize)>=16;
        }), 'Android readable fuel briefing / longest tank name at ' + width);
      }
      assert(
        await page.evaluate(() => {
          const sheet = [...document.styleSheets].find((s) =>
            s.href?.endsWith('psg1-tank-select.css'),
          );
          const snap = () =>
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
          const before = snap();
          sheet.disabled = true;
          const same = before === snap();
          sheet.disabled = false;
          return same && !document.querySelector('.psg1-console');
        }),
        device + ' isolation',
      );
    }
    if (errors.length) throw Error(errors.join('\n'));
    console.log(
      'PASS: roster bounds, name/art/details order, locked states, navigation, fuel guard, focus and device isolation.',
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
