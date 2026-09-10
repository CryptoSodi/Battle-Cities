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
const styles = ['main.css', 'main-menu-web.css', 'cherry-chat-web.css', 'psg1-ui.css', 'home-rewards.css', 'home-chrome.css', 'psg1-home-tabs.css'];
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!DOCTYPE html><html data-ui-device="psg1"><head>${styles.map(s => `<link rel="stylesheet" href="/${s}">`).join('')}</head><body class="web-ui-active main-menu-web-active"><div class="web-ui" data-web-ui>${markup}</div><script>${setup.replaceAll('host.', 'document.querySelector("[data-web-ui]").')};document.querySelector('[data-menu-action="start"]').classList.add('is-selected');document.querySelector('[data-psg1-footer-guide]').classList.add('main-menu-web__psg1-footer-guide--hidden');document.querySelector('.main-menu-web__hazard').classList.add('main-menu-web__hazard--guide-dismissed');document.querySelectorAll('[data-home-rewards-countdown]').forEach(e=>e.textContent='00:12:34');document.querySelectorAll('[data-home-round-progress]').forEach(e=>e.value=42);document.querySelector('[data-menu-player]').textContent='7P5T XYUM';document.querySelector('[data-menu-level-progress]').value=55;document.querySelectorAll('[data-reward-tab-button]').forEach(b=>b.onclick=()=>{document.querySelector('main').dataset.rewardTab=b.dataset.rewardTabButton;document.querySelectorAll('[data-reward-tab-button]').forEach(c=>c.setAttribute('aria-selected',c===b));});window.retryCount=0;window.fixtureUi={host:document.querySelector('[data-web-ui]'),abortController:new AbortController(),fitAndroidHome:()=>{},setText:(s,t)=>document.querySelectorAll(s).forEach(e=>e.textContent=t),loadHomeRewards:()=>window.retryCount++};(${bindTabs}).call(window.fixtureUi);(${errorRender}).call(window.fixtureUi,1);</script></body></html>`);
    return;
  }
  const file = path.join(root, 'public', decodeURIComponent(req.url.split('?')[0]));
  const mime = { '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf' }[path.extname(file)];
  if (mime) res.setHeader('Content-Type', mime);
  fs.readFile(file, (error, data) => { res.statusCode = error ? 404 : 200; res.end(error ? '' : data); });
});

(async () => {
 await new Promise(r => server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page=await browser.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const [width,height] of [[1280,800],[1280,720],[1920,1080],[960,540],[640,480]]) {
   await page.setViewportSize({width,height}); await page.goto('http://127.0.0.1:'+server.address().port);
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});
   for(const platform of ['desktop','android']){
    await page.evaluate(p=>document.documentElement.dataset.uiPlatform=p,platform);
    const labels=await page.evaluate(()=>[...document.querySelectorAll('.android-home-button-icon + .main-menu-web__action-label')].map(e=>{const b=e.closest('button').getBoundingClientRect(),r=e.getBoundingClientRect();return {fits:r.left>=b.left&&r.right<=b.right&&r.top>=b.top+b.height*0.69&&r.bottom<=b.bottom&&e.scrollWidth<=e.clientWidth+1,size:getComputedStyle(e).fontSize}}));
    if(labels.some(l=>!l.fits)||new Set(labels.map(l=>l.size)).size!==1)errors.push('Hero labels clipped or inconsistent '+width+' '+platform);
    const metrics=[];
    for(const tab of ['rewards','leaderboard']){
     await page.locator('[data-reward-tab-button="'+tab+'"]').click();
     if(tab==='rewards') {
      const fits=await page.evaluate(()=>[...document.querySelectorAll('.main-menu-web__podium')].every(p=>{
       const box=p.getBoundingClientRect();
       return [...p.querySelectorAll('strong, span')].every(e=>{const r=e.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom&&e.scrollWidth<=e.clientWidth+1});
      }));
      if(!fits)errors.push('Reward text exceeds plaque '+width+' '+platform);
     }
     metrics.push(await page.evaluate(()=>{
      const rect=e=>e.getBoundingClientRect().toJSON();
      const tabs=[...document.querySelectorAll('[data-reward-tab-button]')].map(b=>({bounds:rect(b),icon:rect(b.querySelector('.psg1-home-tab-content img')),label:rect(b.querySelector('.psg1-home-tab-content span')),fit:getComputedStyle(b.querySelector('.psg1-home-tab-content img')).objectFit,legacy:[...b.querySelectorAll(':scope > img')].map(i=>getComputedStyle(i).display)}));
      const card=document.querySelector('.main-menu-web__leaderboard-message--error');
      return {tabs,card:rect(card),rows:rect(card.parentElement),retry:rect(card.querySelector('button')),bg:getComputedStyle(card).backgroundColor,border:getComputedStyle(card).borderTopWidth,decor:getComputedStyle(card,'::before').display,timer:rect(document.querySelector('.psg1-round-sidebar')),scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]};
     }));
     if(width===1280&&height===800&&platform==='android')await page.screenshot({path:path.join(__dirname,'psg1-home-'+tab+'-fixed.png')});
    }
    if(JSON.stringify(metrics[0].tabs)!==JSON.stringify(metrics[1].tabs))errors.push('Tab geometry shifted '+width);
    if(JSON.stringify(metrics[0].timer)!==JSON.stringify(metrics[1].timer))errors.push('Timer shifted '+width);
    for(const m of metrics){
     if(m.scroll[0]>width||m.scroll[1]>height)errors.push('Page overflow '+width);
     for(const t of m.tabs){
      if(t.fit!=='contain'||t.legacy.some(d=>d!=='none'))errors.push('Stretched or duplicate artwork');
      if(t.label.right>t.bounds.right||t.label.left<t.bounds.left||t.icon.top<t.bounds.top||t.icon.bottom>t.bounds.bottom)errors.push('Tab contents clipped '+width);
     }
    }
    const m=metrics[1];
    if(m.card.x<m.rows.x||m.card.right>m.rows.right||m.card.y<m.rows.y||m.card.bottom>m.rows.bottom||m.retry.bottom>m.card.bottom)errors.push('Error container clipped '+width);
    if(m.bg==='rgba(0, 0, 0, 0)'||m.border==='0px'||m.decor!=='none')errors.push('Missing error container');
    await page.locator('[data-home-rewards-retry]').click();
    if(!await page.evaluate(()=>window.retryCount>0))errors.push('Retry handler failed');
    await page.locator('[data-reward-tab-button="leaderboard"]').focus();
    await page.keyboard.press('ArrowLeft');
    if(await page.locator('[data-reward-tab-button="rewards"]').getAttribute('aria-selected')!=='true')errors.push('Arrow navigation failed');
    console.log(width,height,platform,'checked');
   }
  }
  for(const [device,platform,width] of [['desktop','desktop',1280],['android','android',390]]){
   await page.setViewportSize({width,height:800});
   await page.evaluate(([d,p])=>{document.documentElement.dataset.uiDevice=d;document.documentElement.dataset.uiPlatform=p},[device,platform]);
   const same=await page.evaluate(()=>{
    const sheet=[...document.styleSheets].find(s=>s.href?.endsWith('psg1-home-tabs.css'));
    const snapshot=()=>[...document.querySelectorAll('.android-home-tabs button, .android-home-tabs button > img, .main-menu-web__leaderboard-message--error')].map(e=>{const s=getComputedStyle(e);return [s.width,s.height,s.background,s.border,s.fontSize,s.display].join('|')}).join(';');
    const before=snapshot();sheet.disabled=true;const after=snapshot();sheet.disabled=false;
    return before===after&&[...document.querySelectorAll('.psg1-home-tab-content')].every(e=>getComputedStyle(e).display==='none');
   });
   if(!same)errors.push('Non-PSG style leak '+device);
  }
  if(errors.length)throw Error(errors.join('\n'));
  console.log('PASS: matched icons, stable tab geometry, contained errors, Retry, keyboard tabs, non-PSG isolation.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
