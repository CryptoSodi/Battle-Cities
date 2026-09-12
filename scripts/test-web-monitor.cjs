/* Run with PLAYWRIGHT_MODULE pointing at an installed Playwright package. */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const assert = require('assert');
const webpack = require('webpack');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'battlecities-monitor-'));
const base = require('../webpack/base.config');
async function run() {
  await new Promise((resolve, reject) => webpack({
    mode: 'development', context: root, entry: './scripts/fixtures/web-monitor.ts',
    output: { path: output, filename: 'fixture.js' }, resolve: base.resolve,
    module: {rules:[{test:/\.ts$/,loader:require.resolve('ts-loader'),options:{transpileOnly:true}}]},
    plugins: base.plugins.filter(plugin => plugin.constructor.name !== 'CopyPlugin'),
  }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString('errors-only'))) : resolve()));
  const links = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8').match(/<link[^>]+rel="stylesheet"[^>]*>/g).join('\n');
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html');
      return res.end(`<!doctype html><html data-ui-platform="web" data-ui-device="standard"><head>${links}</head><body class="game-running"><div class="web-ui" data-web-ui></div><script src="/fixture.js"></script></body></html>`);
    }
    if (req.url.startsWith('/api/')) { res.writeHead(503, {'Content-Type':'application/json'}); return res.end('{"error":"Fixture offline"}'); }
    const pathname = decodeURIComponent(req.url.split('?')[0]);
    const file = pathname === '/fixture.js' ? path.join(output, 'fixture.js') : path.join(root, pathname.startsWith('/data/') ? '.' : 'public', pathname);
    res.setHeader('Content-Type', {'.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2'}[path.extname(file)] || 'application/octet-stream');
    fs.readFile(file, (error, data) => { res.statusCode = error ? 404 : 200; res.end(error ? '' : data); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const [width,height] of [[1920,1080],[1280,720]]) {
      await page.setViewportSize({width,height});
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(() => window.monitorTest);
      await page.evaluate(() => document.fonts.ready);
      const shell = await page.locator('.main-menu-web').elementHandle();
      for (const name of ['MainMore','MainWiki','MainTreasury','MainEvents','MainStaking','MainTrading','MainBoost','MainAirdrop','MainRanking','MainSocials','MainShop','SettingsMenu','MainTankSelect','MainPlayerProfile','LevelScore']) {
        await page.evaluate(name => window.monitorTest.show(name), name);
        await page.waitForTimeout(150);
        const bounds = await page.evaluate(() => {
          const host = document.querySelector('[data-monitor-page]');
          const root = host.querySelector('main');
          const box = e => {const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};};
          const style = root && getComputedStyle(root);
          return {host:box(host),page:root && box(root),scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight], skin:document.getElementById('web-monitor-console-skin').sheet.cssRules.length};
        });
        console.log(JSON.stringify({width,height,name,...bounds}));
        assert(bounds.page, name + ': no page');
        assert(bounds.skin > 100, 'shared console skin missing');
        assert(bounds.page.w <= bounds.host.w + 1 && bounds.page.h <= bounds.host.h + 1, name + ': escapes monitor');
        assert(bounds.scroll[0] <= width && bounds.scroll[1] <= height, name + ': document scroll');
        assert(await shell.evaluate(e => e.isConnected), 'shell was replaced');
        if (['MainMore','MainShop','MainWiki','MainRanking'].includes(name)) await page.screenshot({path:path.join(output,`${width}-${name}.png`)});
      }
      await page.locator('.main-menu-web__commands [data-menu-action="start"]').click();
      assert(await page.locator('[data-monitor-page]').count() === 0, 'Play did not restore home');
      await page.locator('.main-menu-web__commands [data-menu-action="headquarters"]').click();
      await page.locator('[data-hq-entry="1"]').click();
      await page.locator('[data-monitor-page] [data-ui-back]').click();
      await page.waitForSelector('[data-hq-entry="1"]');
      assert(await page.locator('[data-hq-entry="1"]').evaluate(e => e === document.activeElement), 'Back lost field manual focus');
      await page.locator('.main-menu-web__commands [data-menu-action="shop"]').click();
      const purchase = page.locator('[data-monitor-page] [data-shop-buy]').last();
      if (await purchase.count()) {
        await purchase.focus();
        assert(await purchase.evaluate(e => {const r=e.getBoundingClientRect(),h=e.closest('[data-monitor-page]').getBoundingClientRect();return r.top>=h.top && r.bottom<=h.bottom;}), 'purchase focus clipped');
      }
    }
    for (const [width,height,device,platform] of [[375,812,'standard','android'],[960,540,'psg1','android']]) {
      await page.setViewportSize({width,height});
      await page.evaluate(({device,platform}) => {document.documentElement.dataset.uiDevice=device;document.documentElement.dataset.uiPlatform=platform;window.monitorTest.show('MainMore');}, {device,platform});
      assert(await page.locator('[data-monitor-page]').count() === 0, 'native page unexpectedly embedded');
      const size = await page.locator('.headquarters-web').boundingBox();
      assert(size.width <= width+1 && size.height <= height+1, 'native layout changed');
      console.log(`PASS: ${device} ${width}x${height} remains full-screen`);
    }
    assert.deepStrictEqual(errors, [], 'browser errors');
    console.log('PASS: monitor containment, stable shell, shared skins, Play/home. Artifacts: ' + output);
  } finally { await browser.close(); server.close(); }
}
run().catch(error => {console.error(error);process.exitCode=1;});
