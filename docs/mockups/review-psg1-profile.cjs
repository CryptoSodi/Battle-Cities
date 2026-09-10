// Real player profile UI, local fixtures only; no wallet, sharing or replay navigation.
const fs = require('fs');
const path = require('path');
const http = require('http');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const modules = ['focusScroll', 'psg1Console', 'PlayerProfileWebUi'].map(name => ts.transpileModule(fs.readFileSync(path.join(root, 'src/webUi', name + '.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
const styles = ['main.css','main-menu-web.css','shop-web.css','player-profile-web.css','operations-web.css','standard-pages-web.css','shop-ui-contract.css','psg1-ui.css','psg1-screens.css','psg1-player-profile.css'];
const fixture = `
let pressed='';window.state='ready';window.calls=[];
window.open=(...args)=>window.calls.push(['open',...args]);
Object.defineProperty(navigator,'share',{value:async value=>window.calls.push(['share',value]),configurable:true});
const deps={isPsg1Ui:()=>document.documentElement.dataset.uiDevice==='psg1',
MenuInputContext:{HorizontalPrev:'left',HorizontalNext:'right',VerticalPrev:'up',VerticalNext:'down',Select:'select',Back:'back'},
animateBackNavigation:()=>window.calls.push(['back']),
PlayerProfileRequestError:class extends Error {constructor(message,status){super(message);this.status=status}},
PlayerProfileClient:class {async getProfile(id,page){
 window.calls.push(['load',id,page]);
 if(window.state==='loading')return new Promise(()=>{});
 if(window.state==='error'||window.state==='404')throw new deps.PlayerProfileRequestError('fixture',window.state==='404'?404:503);
 return {id,displayName:'COMMANDER LONG PLAYER NAME',provider:window.state==='empty'?'guest':'wallet',walletAddress:window.state==='empty'?null:'7P5T123456789ABCDEFGHIJKLMNPQRSTUVWXYZ1234XYUM',avatarUrl:null,joinedAt:'2026-09-01',highscores:{primary:1234567,secondary:1},stats:{allTime:{totalPoints:12345678,matches:42,rank:2},currentSeason:{id:'s7',name:'SEASON SEVEN',rank:window.state==='empty'?null:12,totalPoints:1000,matches:3}},recentMatches:window.state==='empty'?[]:Array.from({length:10},(_,i)=>({id:'match-'+i,mode:i%2?'multi':'single',levelNumber:i+1,score:1234567,gamePoints:12345,won:i%2===0,replayAvailable:window.state!=='readonly'&&i%3!==1})),recentMatchesPage:{page,pageSize:10,total:window.state==='empty'?0:20}};
}}};const require=()=>deps;
${modules.map(code => `Object.assign(deps,(()=>{const exports={};${code};return exports})());`).join('\n')}
window.mount=()=>{window.ui?.unmount();window.ui=new deps.PlayerProfileWebUi({}, {getActiveMethod:()=>({isDownAny:key=>key===pressed})},()=>window.state==='invalid'?null:'player-one');window.ui.mount()};
window.press=key=>{pressed=key;window.ui.update();pressed=''};window.mount();
`;
const server=http.createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html data-ui-device="psg1" data-ui-platform="android"><head>'+styles.map(s=>'<link rel="stylesheet" href="/'+s+'">').join('')+'</head><body class="web-ui-active game-running"><div data-web-ui class="web-ui"></div><script>'+fixture+'</script></body></html>')}
 const file=path.join(root,'public',decodeURIComponent(req.url.split('?')[0]));
 const mime={'.css':'text/css','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2'}[path.extname(file)];if(mime)res.setHeader('Content-Type',mime);
 fs.readFile(file,(error,data)=>{res.statusCode=error?404:200;res.end(error?'':data)});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const mount=async state=>{await page.evaluate(state=>{window.state=state;window.mount()},state);if(state!=='loading')await page.waitForFunction(()=>!window.ui.loading);await page.evaluate(()=>document.fonts.ready)};
  for(const [width,height] of [[1280,1100],[1280,800],[960,540],[640,480]]){
   await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(()=>document.fonts.ready);
   for(const state of ['ready','empty','error','404','invalid','loading','readonly']){
    await mount(state);
    const fits=await page.evaluate(()=>{
     const main=document.querySelector('main'),header=document.querySelector('[data-ui-nav]'),status=document.querySelector('[data-profile-status]'),content=document.querySelector('.player-profile-web__content');
     const r=e=>e.getBoundingClientRect(),m=r(main),h=r(header),s=r(status),c=r(content);
     const framed=[...main.querySelectorAll('.player-profile-web__hero,.player-profile-web__stat,.player-profile-web__error,.player-profile-web__loading')].every(e=>getComputedStyle(e).borderTopWidth==='3px');
     const cells=[...main.querySelectorAll('.player-profile-web__match')].every(row=>[...row.children].every(cell=>{const a=r(row),b=r(cell);return b.left>=a.left&&b.right<=a.right&&b.top>=a.top&&b.bottom<=a.bottom&&getComputedStyle(cell).display!=='none'}));
     const back=r(document.querySelector('[data-ui-back]'));
     const heading=document.querySelector('[data-ui-nav] h1');
     return Math.abs(back.right-h.right)<1&&getComputedStyle(heading).color==='rgb(27, 20, 4)'&&document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight&&m.left>=0&&m.right<=innerWidth&&h.bottom<=c.top&&c.bottom<=s.top&&s.bottom<=innerHeight&&content.scrollWidth<=content.clientWidth&&framed&&cells;
    });
    if(!fits)errors.push('Layout/frame/cell bounds '+width+' '+state);
    if(width===1280&&height===800)await page.screenshot({path:path.join(__dirname,'psg1-profile-'+state+'.png')});
    if(state==='ready'){
     const headerBefore=await page.locator('[data-ui-nav]').boundingBox();
     await page.locator('[data-profile-match]:enabled').last().focus();
     const visible=await page.locator('[data-profile-match]:enabled').last().evaluate(e=>{const r=e.getBoundingClientRect(),box=e.closest('.player-profile-web__content').getBoundingClientRect();return r.top>=box.top&&r.bottom<=box.bottom});
     if(!visible||JSON.stringify(headerBefore)!==JSON.stringify(await page.locator('[data-ui-nav]').boundingBox()))errors.push('Focus scrolling moved header or hid match '+width);
     await page.evaluate(()=>window.press('select'));
     if(!await page.evaluate(()=>window.calls.some(c=>c[0]==='open'&&c[1].includes('profileReplayMatch=match-9'))))errors.push('Replay navigation');
    }
    if(state==='readonly'){
     await page.locator('.player-profile-web__content').focus();await page.evaluate(()=>window.press('down'));
     if(!await page.locator('.player-profile-web__content').evaluate(e=>e.scrollTop>0))errors.push('Read-only record cannot scroll with D-pad');
    }
   }
   console.log(width,height,'profile states + bounds + focus scrolling checked');
  }
  await mount('ready');
  await page.locator('[data-profile-share]').click();
  if(!await page.evaluate(()=>window.calls.some(c=>c[0]==='share'&&c[1].url.includes('playerId=player-one'))))errors.push('Share profile payload');
  await page.locator('[data-profile-page="2"]').click();await page.waitForFunction(()=>!window.ui.loading&&window.ui.page===2);
  if(await page.locator(':focus').getAttribute('data-profile-key')!=='previous')errors.push('Last-page focus restoration');
  await page.evaluate(()=>window.press('select'));await page.waitForFunction(()=>!window.ui.loading&&window.ui.page===1);
  if(await page.locator(':focus').getAttribute('data-profile-key')!=='next')errors.push('First-page focus restoration');
  await mount('error');await page.evaluate(()=>window.state='ready');await page.locator('[data-profile-retry]').click();await page.locator('.player-profile-web__hero').waitFor();
  await page.evaluate(()=>window.press('back'));if(!await page.evaluate(()=>window.calls.some(c=>c[0]==='back')))errors.push('Back action');
  for(const [device,width] of [['desktop',1280],['android',375]]){
   await page.setViewportSize({width,height:800});await page.evaluate(device=>document.documentElement.dataset.uiDevice=device,device);await mount('ready');
   const unchanged=await page.evaluate(()=>{
    const sheet=[...document.styleSheets].find(s=>s.href?.endsWith('psg1-player-profile.css'));
    const snapshot=()=>[...document.querySelectorAll('main,main *')].map(e=>{const s=getComputedStyle(e);return [s.display,s.width,s.height,s.fontSize,s.border,s.padding,s.background].join('|')}).join('\n');
    const before=snapshot();sheet.disabled=true;const after=snapshot();sheet.disabled=false;return before===after&&!document.querySelector('.psg1-console');
   });if(!unchanged)errors.push('Non-PSG profile changed '+device);
  }
  if(errors.length)throw Error(errors.join('\n'));
  console.log('PASS: profile states, layout, D-pad scrolling, replay/share fixtures, pagination/focus, Back and device isolation.');
 }finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
