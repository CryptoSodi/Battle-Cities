// Real screen classes and event handlers, isolated from wallets/network by fixtures.
const fs = require('fs');
const path = require('path');
const http = require('http');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const code = ['src/shop/ShopTypes.ts','src/webUi/SettingsWebUi.ts','src/webUi/ShopWebUi.ts'].map(compile);
const styles = ['main.css','main-menu-web.css','shop-web.css','operations-web.css','standard-pages-web.css','shop-ui-contract.css','psg1-ui.css','psg1-screens.css'];
const fixture = `
const process={env:{BATTLECITY_VERSION:'PREVIEW'}};
let exports={}; const require=(name)=>deps;
const deps={PowerupType:{}, isPsg1Ui:()=>document.documentElement.dataset.uiDevice==='psg1',isPlaySolanaPsg1:()=>true,
NativeNotificationClient:class{isAvailable(){return !!window.nativeNotifications}async getSettings(){return {supported:true,enabled:false,permission:'granted'}}},animateBackNavigation:()=>window.backUsed=true,
MenuInputContext:{HorizontalPrev:'left',HorizontalNext:'right',VerticalPrev:'up',VerticalNext:'down',Select:'select',Back:'back'},
moveFocus:(buttons,current,x,y)=>buttons[(buttons.indexOf(current)+(x||y)+buttons.length)%buttons.length].focus()};
${code[0]}
Object.assign(deps,exports); exports={};
class FakeShop {
 constructor(){this.equipped={}} isWalletConnected(){return true} isVirtualEconomyAccount(){return false}
 getTokenBalance(){return 1500} getSolBalance(){return 1.25} getFuelBalance(){return 12} getInventoryCount(){return 2}
 getWalletAddress(){return '7P5T123456789XYUM'} getEquipped(slot){return this.equipped[slot]||null}
 equipNext(slot){return this.equipped[slot]=this.equipped[slot]?null:'shield'}
 getCatalog(){return [...[1,5,20].map((n,i)=>({id:['fuel-one','fuel-five','fuel-twenty'][i],name:'FUEL X'+n,price:[150,600,1800][i],solPrice:0.01,reward:{fuel:n}})),...Object.values(deps.ShopInventoryItemId).map((id,i)=>({id,name:id.replaceAll('-',' ').toUpperCase(),price:300+i*75,solPrice:0.02,reward:{inventory:{[id]:1}}}))]}
 async purchaseItem(){return {ok:false,statusText:'TEST PURCHASE DECLINED'}}
 async getPresaleState(){return {configured:true,ended:false,currentPriceSol:'0.001',network:'devnet',stages:[],participants:0}}
}
deps.ShopManager=FakeShop;
window.Settings=(()=>{const exports={};${code[1]};return exports.SettingsWebUi})();
window.Shop=(()=>{const exports={};${code[2]};return exports.ShopWebUi})();
let muted=false; const saved={}; let pressed='';
const input={getActiveMethod:()=>({isDownAny:key=>key===pressed}),getNativeAndroidGamepad:()=>({getDeviceProfile:()=>({})})};
window.press=key=>{pressed=key;window.screenUi.update();pressed=''};
const storage={getBoolean:k=>!!saved[k],setBoolean:(k,v)=>saved[k]=v,save:()=>{}};
window.mountScreen=screen=>{
 window.screenUi?.unmount();
 window.screenUi=screen==='settings'?new window.Settings({},input,{isGlobalMuted:()=>muted,setGlobalMuted:v=>muted=v,saveSettings:()=>{}},storage,{getPlayer:()=>({walletAddress:'7P5T123456789XYUM'}),getDisplayName:()=> 'PLAYER'}):new window.Shop({isBattleSetup:()=>false,gameStorage:storage,inputManager:input,navigator:{},getBattleFuelCost:()=>1});
 window.screenUi.mount();
};
window.mountScreen('settings');`;
const server=http.createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html data-ui-device="psg1" data-ui-platform="android"><head>'+styles.map(s=>'<link rel="stylesheet" href="/'+s+'">').join('')+'</head><body class="web-ui-active game-running"><div class="web-ui" data-web-ui></div><script>'+fixture+'</script></body></html>');return}
 const rel=decodeURIComponent(req.url.split('?')[0]);const file=path.join(root,rel.startsWith('/data/')?'':'public',rel);
 const mime={'.css':'text/css','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2'}[path.extname(file)];if(mime)res.setHeader('Content-Type',mime);
 fs.readFile(file,(e,data)=>{res.statusCode=e?404:200;res.end(e?'':data)});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
 for(const [width,height] of [[1280,800],[1280,720],[960,540],[640,480],[1024,900]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(()=>document.fonts.ready);
  for(const screen of ['settings','loadout','bact','sol','swap']){
   if(screen==='settings')await page.evaluate(()=>window.mountScreen('settings'));
   else {await page.evaluate(()=>window.mountScreen('shop'));await page.locator('[data-shop-tab="'+screen+'"]').click()}
   await page.evaluate(async()=>{await Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{})))});
   const bounds=await page.evaluate(()=>({scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],page:document.querySelector('main').getBoundingClientRect().toJSON(),nav:document.querySelector('[data-ui-nav]').getBoundingClientRect().toJSON()}));
   if(bounds.scroll[0]>width||bounds.scroll[1]>height)errors.push(screen+' page overflow '+width+'x'+height);
   if(screen==='bact'||screen==='sol') {
    const layout=await page.evaluate(()=>{
     const cards=[...document.querySelectorAll('.shop-web__desktop-content .shop-web__card')].every(card=>{
      const rect=e=>e.getBoundingClientRect();const c=rect(card),name=rect(card.querySelector('h2')),icon=rect(card.querySelector('.shop-web__card-icon')),desc=rect(card.querySelector('p')),buy=rect(card.querySelector('button'));
      return name.bottom<=icon.top+1&&icon.bottom<=desc.top+1&&desc.bottom<=buy.top+1&&buy.bottom<=c.bottom&&Math.abs((icon.left+icon.right)-(c.left+c.right))<2;
     });
     const owned=[...document.querySelectorAll('.shop-web__desktop-owned .shop-web__owned-tile')].every(tile=>{const t=tile.getBoundingClientRect(),img=tile.querySelector('img').getBoundingClientRect(),count=tile.querySelector('strong'),r=count.getBoundingClientRect(),s=getComputedStyle(count);return img.bottom<r.top&&Math.abs(r.bottom-(t.bottom-2))<2&&r.width>=t.width-5&&s.borderTopWidth==='2px'&&count.scrollWidth<=count.clientWidth+1});
     return {cards,owned};
    });
    if(!layout.cards||!layout.owned)errors.push(screen+' card order / owned footer alignment '+width+'x'+height+' '+JSON.stringify(layout));
   }
   if(width===1280&&height===800)await page.screenshot({path:path.join(__dirname,'psg1-'+screen+'.png')});
   console.log(width,height,screen,JSON.stringify(bounds.scroll));
  }
 }
 await page.evaluate(()=>window.mountScreen('settings'));
 const mute=await page.locator('[data-setting="mute"]').getAttribute('aria-checked');
  await page.locator('[data-setting="mute"]').click();
  if(await page.locator('[data-setting="mute"]').getAttribute('aria-checked')===mute)errors.push('Mute did not change');
 await page.evaluate(()=>window.press('select'));
 if(await page.locator('[data-setting="mute"]').getAttribute('aria-checked')!==mute)errors.push('Gamepad Select did not toggle mute');
 await page.locator('[data-setting="scanline"]').click();
 if(await page.locator('[data-setting="scanline"]').getAttribute('aria-checked')!=='true')errors.push('Scanline did not change');
 await page.evaluate(()=>window.press('back'));if(!await page.evaluate(()=>window.backUsed))errors.push('Settings Back failed');
 await page.evaluate(()=>window.mountScreen('shop'));
 await page.evaluate(()=>window.press('right'));
 if(await page.evaluate(()=>document.activeElement.dataset.shopTab)!=='bact')errors.push('Gamepad tab navigation order failed');
 await page.locator('[data-shop-tab="loadout"]').click();
 await page.locator('[data-shop-slot]').first().click();if(!await page.locator('.shop-web__slot-item').first().innerText().then(t=>t.includes('SHIELD')))errors.push('Equip did not update');
 await page.locator('[data-shop-tab="bact"]').click();await page.locator('[data-shop-filter="fuel"]').click();if(await page.locator('[data-shop-buy]').count()!==3)errors.push('Fuel filter failed');
 await page.locator('[data-shop-buy]').first().click();if(!(await page.locator('.shop-web__status').innerText()).includes('TEST PURCHASE DECLINED'))errors.push('Purchase status failed');
 await page.locator('[data-shop-tab="swap"]').click();await page.locator('[data-shop-swap-amount]').fill('0.5');if(!(await page.locator('[data-shop-swap-receive]').innerText()).includes('500'))errors.push('Swap preview failed');
 await page.evaluate(()=>{window.nativeNotifications=true;window.mountScreen('settings')});
 if(await page.locator('[data-setting="notifications"]').count()!==1)errors.push('Native notifications missing');
 // The new presentation must have zero computed-style effect on other devices.
 for(const [platform,width] of [['desktop',1280],['android',375]]){
  await page.setViewportSize({width,height:800});
  await page.evaluate(p=>{document.documentElement.dataset.uiDevice=p;document.documentElement.dataset.uiPlatform=p},platform);
  for(const screen of ['settings','shop']){
   await page.evaluate(s=>window.mountScreen(s),screen);
   const metrics=()=>page.evaluate(()=>Array.from(document.querySelectorAll('main,main button')).map(e=>{const s=getComputedStyle(e);return [e.getBoundingClientRect().toJSON(),s.background,s.color,s.fontSize]}));
   const before=await metrics();await page.evaluate(()=>document.querySelector('link[href="/psg1-screens.css"]').disabled=true);
   if(JSON.stringify(before)!==JSON.stringify(await metrics()))errors.push(platform+' '+screen+' changed outside PSG1');
   await page.evaluate(()=>document.querySelector('link[href="/psg1-screens.css"]').disabled=false);
  }
 }
 console.log('ERRORS',errors);await browser.close();server.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
