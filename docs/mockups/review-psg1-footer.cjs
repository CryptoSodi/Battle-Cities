// Render the real menu markup and styles with fixture data; no wallet/API calls.
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'src/webUi/MainMenuWebUi.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const context = { exports: {}, require: () => new Proxy({}, { get: () => class {} }), window: { location: { search: '' } }, URLSearchParams };
vm.runInNewContext(compiled, context);
const menu = new context.exports.MainMenuWebUi({ isDev: false });
const markup = menu.render();
const bindTabs = 'function ' + menu.bindRewardTabs.toString();
const errorRender = 'function ' + menu.renderHomeRewardsError.toString();
const setup = compiled.slice(compiled.indexOf("if (document.documentElement.dataset.uiDevice === 'psg1')"), compiled.indexOf('this.hydrateHud();'));
const chatCode = ts.transpileModule(fs.readFileSync(path.join(root,'src/webUi/CherryChatWebUi.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const chatPlacement=compiled.slice(compiled.indexOf('this.cherryChat.mount();'), compiled.indexOf('this.bindHomeChatPlacement();'));
const guideTimer=compiled.slice(compiled.indexOf('const psg1FooterGuide ='), compiled.indexOf('this.refreshTick = 0;', compiled.indexOf('const psg1FooterGuide =')));
const styles = ['main.css', 'main-menu-web.css', 'cherry-chat-web.css', 'psg1-ui.css', 'home-rewards.css', 'home-chrome.css', 'psg1-home-tabs.css', 'psg1-home-footer.css'];
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!DOCTYPE html><html data-ui-device="psg1"><head>${styles.map(s => `<link rel="stylesheet" href="/${s}">`).join('')}</head><body class="web-ui-active main-menu-web-active"><div class="web-ui" data-web-ui>${markup}</div><script>${setup.replaceAll('host.', 'document.querySelector("[data-web-ui]").')};document.querySelector('[data-menu-action="start"]').classList.add('is-selected');document.querySelector('[data-psg1-footer-guide]').classList.add('main-menu-web__psg1-footer-guide--hidden');document.querySelector('.main-menu-web__hazard').classList.add('main-menu-web__hazard--guide-dismissed');document.querySelectorAll('[data-home-rewards-countdown]').forEach(e=>e.textContent='00:12:34');document.querySelectorAll('[data-home-round-progress]').forEach(e=>e.value=42);document.querySelector('[data-menu-player]').textContent='7P5T XYUM';document.querySelector('[data-menu-level-progress]').value=55;document.querySelectorAll('[data-reward-tab-button]').forEach(b=>b.onclick=()=>{document.querySelector('main').dataset.rewardTab=b.dataset.rewardTabButton;document.querySelectorAll('[data-reward-tab-button]').forEach(c=>c.setAttribute('aria-selected',c===b));});window.retryCount=0;window.fixtureUi={host:document.querySelector('[data-web-ui]'),abortController:new AbortController(),fitAndroidHome:()=>{},setText:(s,t)=>document.querySelectorAll(s).forEach(e=>e.textContent=t),loadHomeRewards:()=>window.retryCount++};(${bindTabs}).call(window.fixtureUi);(${errorRender}).call(window.fixtureUi,1);const Chat=(()=>{const exports={};const require=()=>({});${chatCode};return exports.CherryChatWebUi})();window.chat=new Chat({getPlayer:()=>({provider:'wallet',walletAddress:'test'})});window.chat.load=async()=>{};window.fixtureUi.cherryChat=window.chat;window.startFooter=()=>{const host=window.fixtureUi.host;const psg1FooterGuide=host.querySelector('[data-psg1-footer-guide]');psg1FooterGuide.classList.remove('main-menu-web__psg1-footer-guide--hidden');psg1FooterGuide.closest('footer').classList.remove('main-menu-web__hazard--guide-dismissed');(function(){${chatPlacement}${guideTimer}}).call(window.fixtureUi)};window.startFooter();</script></body></html>`);
    return;
  }
  const file = path.join(root, 'public', decodeURIComponent(req.url.split('?')[0]));
  const mime = { '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf' }[path.extname(file)];
  if (mime) res.setHeader('Content-Type', mime);
  fs.readFile(file, (error, data) => { res.statusCode = error ? 404 : 200; res.end(error ? '' : data); });
});


(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
 for(const [width,height] of [[1280,800],[1280,720],[960,540],[640,480],[1920,1080]]){
 await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});
 for(const platform of ['desktop','android']){
  await page.evaluate(p=>document.documentElement.dataset.uiPlatform=p,platform);
  for(const dismissed of [false,true]){
   await page.evaluate(d=>{document.querySelector('footer.main-menu-web__hazard').classList.toggle('main-menu-web__hazard--guide-dismissed',d);document.querySelector('[data-psg1-footer-guide]').classList.toggle('main-menu-web__psg1-footer-guide--hidden',d);},dismissed);
   const m=await page.evaluate(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {footer:rect('.main-menu-web__hazard'),chat:rect('.game-cherry__launcher'),guide:rect('[data-psg1-footer-guide]'),ticker:rect('.main-menu-web__ticker-window'),status:getComputedStyle(document.querySelector('.main-menu-web__round-status')).display,visible:getComputedStyle(document.querySelector('.main-menu-web__ticker-window')).visibility,font:parseFloat(getComputedStyle(document.querySelector('.main-menu-web__ticker-run span')).fontSize),scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]}});
   if(Math.abs(m.chat.right-m.footer.right)>1||m.chat.bottom>m.footer.bottom+1||m.chat.top<m.footer.top-1)errors.push('Chat not in right footer slot '+width+' '+platform);
   if(m.guide.right>m.chat.x||m.ticker.right>m.chat.x)errors.push('Chat overlays guide/ticker '+width);
   if(m.status!=='none'||m.visible!==(dismissed?'visible':'hidden'))errors.push('Wrong footer layer '+width);
   if(dismissed&&m.font<22)errors.push('Ticker too small');
   if(m.scroll[0]>width||m.scroll[1]>height)errors.push('Page overflow');
   if(width===1280&&height===800&&platform==='desktop')await page.screenshot({path:path.join(__dirname,'psg1-footer-'+(dismissed?'ticker':'legend')+'.png')});
  }
 }
 }
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()));
 await page.evaluate(()=>{clearTimeout(window.fixtureUi.psg1FooterTimer);window.startFooter()});await page.clock.fastForward(9999);
 if(await page.locator('[data-psg1-footer-guide]').evaluate(e=>e.classList.contains('main-menu-web__psg1-footer-guide--hidden')))errors.push('Legend dismissed early');
 await page.clock.fastForward(2);
 if(!await page.locator('[data-psg1-footer-guide]').evaluate(e=>e.classList.contains('main-menu-web__psg1-footer-guide--hidden')))errors.push('Legend did not dismiss after 10 seconds');
 await page.locator('.game-cherry__launcher').click();if(!await page.locator('.game-cherry__dialog').evaluate(e=>e.open))errors.push('Chat does not open');
 await page.locator('[data-chat-close]').click();if(await page.locator('.game-cherry__dialog').evaluate(e=>e.open))errors.push('Chat does not close');
 await page.evaluate(()=>window.chat.unmount());
 const full=await page.evaluate(()=>{const f=document.querySelector('.main-menu-web__hazard'),g=document.querySelector('[data-psg1-footer-guide]');return Math.abs(g.getBoundingClientRect().width-f.clientWidth)<2});
 if(!full)errors.push('Missing chat leaves empty slot');
 await page.emulateMedia({reducedMotion:'reduce'});
 if(await page.locator('.main-menu-web__hazard-track').evaluate(e=>getComputedStyle(e).animationName)!=='none')errors.push('Reduced motion not respected');
 for(const [device,platform] of [['android','android'],['desktop','desktop']]){
  await page.evaluate(([d,p])=>{document.documentElement.dataset.uiDevice=d;document.documentElement.dataset.uiPlatform=p},[device,platform]);
  const same=await page.evaluate(()=>{const sheet=[...document.styleSheets].find(s=>s.href?.endsWith('psg1-home-footer.css'));const snap=()=>[...document.querySelectorAll('.main-menu-web__hazard, .main-menu-web__hazard *')].map(e=>{const s=getComputedStyle(e);return [s.width,s.height,s.fontSize,s.display,s.visibility,s.padding].join('|')}).join(';');const a=snap();sheet.disabled=true;const b=snap();sheet.disabled=false;return a===b});
  if(!same)errors.push('Non-PSG style leak');
 }
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS: right-edge chat, uncluttered legend, 10-second timeout, larger ticker, chat actions, no-chat layout, reduced motion, device isolation.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
