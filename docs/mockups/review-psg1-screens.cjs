// Real screen classes and event handlers, isolated from wallets/network by fixtures.
const fs = require('fs');
const path = require('path');
const http = require('http');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const code = ['src/shop/ShopTypes.ts','src/webUi/SettingsWebUi.ts','src/webUi/ShopWebUi.ts'].map(compile);
const focusScrollCode = compile('src/webUi/focusScroll.ts');
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
(()=>{const exports={};${focusScrollCode};Object.assign(deps,exports)})();
class FakeShop {
 canStartRun(){return !window.noFuel}
 constructor(){this.equipped={}} isWalletConnected(){return !window.walletDisconnected} isVirtualEconomyAccount(){return false}
 async connectWallet(){window.connectCalls=(window.connectCalls||0)+1;window.walletDisconnected=false;return true}
 getTokenBalance(){return 1500} getSolBalance(){return 1.25} getFuelBalance(){return 12} getInventoryCount(){return 2}
 getWalletAddress(){return '7P5T123456789XYUM'} getEquipped(slot){return this.equipped[slot]||null}
 equipNext(slot){return this.equipped[slot]=this.equipped[slot]?null:'shield'}
 getCatalog(){return [...[1,5,20].map((n,i)=>({id:['fuel-one','fuel-five','fuel-twenty'][i],name:'FUEL X'+n,price:[150,600,1800][i],solPrice:0.01,reward:{fuel:n}})),...Object.values(deps.ShopInventoryItemId).map((id,i)=>({id,name:id.replaceAll('-',' ').toUpperCase(),price:300+i*75,solPrice:0.025,reward:{inventory:{[id]:1}}})),{id:deps.ShopItemId.StarterPack,name:'STARTER PACK',price:1200,solPrice:0.08,reward:{fuel:5,inventory:{shield:1,'base-defence':1}}}]}
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
 window.screenUi=screen==='settings'?new window.Settings({},input,{isGlobalMuted:()=>muted,setGlobalMuted:v=>muted=v,saveSettings:()=>{}},storage,{getPlayer:()=>({walletAddress:'7P5T123456789XYUM'}),getDisplayName:()=> 'PLAYER'}):new window.Shop({isBattleSetup:()=>!!window.battleSetup,gameStorage:storage,inputManager:input,navigator:{},getBattleFuelCost:()=>1,startBattle:()=>{window.startCalls=(window.startCalls||0)+1;return new Promise(resolve=>window.finishStart=resolve)}});
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
 for(const [width,height] of [[1280,1100],[1280,800],[1280,720],[960,540],[640,480],[1024,900]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(()=>document.fonts.ready);
  for(const screen of ['settings','loadout','bact','sol','swap']){
   if(screen==='settings')await page.evaluate(()=>window.mountScreen('settings'));
   else {await page.evaluate(()=>window.mountScreen('shop'));await page.locator('[data-shop-tab="'+screen+'"]').click()}
   await page.evaluate(async()=>{await Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{})))});
   const bounds=await page.evaluate(()=>({scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],page:document.querySelector('main').getBoundingClientRect().toJSON(),nav:document.querySelector('[data-ui-nav]').getBoundingClientRect().toJSON()}));
   if(bounds.scroll[0]>width||bounds.scroll[1]>height)errors.push(screen+' page overflow '+width+'x'+height);
   if(screen!=='settings') {
    const statusValid=await page.locator('.shop-web__connection-status').evaluate(e=>{
     const box=e.getBoundingClientRect();
     e.focus();
     return e.tagName==='DIV'&&e.getAttribute('role')==='status'&&e.tabIndex===-1&&document.activeElement!==e&&!window.screenUi.buttons.includes(e)&&!document.querySelector('[data-shop-wallet]')&&[...e.children].every(child=>{const r=child.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom});
    });
    if(!statusValid)errors.push('Connected status selectable or clipped '+screen+' '+width);
   }
   if(screen==='loadout') {
    const slotLayout=()=>page.locator('[data-shop-slot]').evaluateAll(slots=>slots.map(slot=>{
     const r=e=>e.getBoundingClientRect(),box=r(slot),index=r(slot.querySelector('.shop-web__slot-index')),art=r(slot.querySelector('.shop-web__slot-art')),label=r(slot.querySelector('.shop-web__slot-item b')),action=r(slot.querySelector('.shop-web__slot-action'));
     return {bounds:box.toJSON(),fits:index.bottom<=art.top+1&&art.bottom<=label.top+1&&label.bottom<=action.top+1&&action.bottom<box.bottom&&action.top-label.bottom<=9&&Math.abs((art.left+art.right)-(box.left+box.right))<2&&art.width>=box.height*.38,background:getComputedStyle(slot).backgroundImage};
    }));
    const before=await slotLayout();
    await page.locator('[data-shop-slot]').first().focus();
    const after=await slotLayout();
    if(before.some(s=>!s.fits)||after.some(s=>!s.fits)||JSON.stringify(before.map(s=>s.bounds))!==JSON.stringify(after.map(s=>s.bounds)))errors.push('Loadout socket geometry or label grouping '+width+'x'+height);
    const selected=await page.locator('[data-shop-slot]').first().evaluate(e=>e.classList.contains('is-selected')&&getComputedStyle(e).borderTopColor==='rgb(255, 179, 15)');
    if(!selected)errors.push('Loadout gold selection frame missing');
   }
   if(['loadout','bact','sol'].includes(screen)) {
    const rail=await page.evaluate(()=>{
     const side=document.querySelector('.shop-web__desktop-side'),shell=document.querySelector('.shop-web__desktop-shell'),wallet=document.querySelector('.shop-web__wallet-panel'),inventory=document.querySelector('.shop-web__inventory-panel');
     const r=side.getBoundingClientRect(),w=wallet.getBoundingClientRect(),i=inventory.getBoundingClientRect();
     return {width:r.width,expected:innerWidth<=700?150:Math.max(170,shell.getBoundingClientRect().width*.25),separate:w.bottom<i.top,framed:[wallet,inventory].every(e=>getComputedStyle(e).borderTopWidth==='3px'),aligned:Math.abs(w.left-i.left)<1&&Math.abs(w.width-i.width)<1,bottom:i.bottom,sideBottom:r.bottom};
    });
    if(Math.abs(rail.width-rail.expected)>1||!rail.separate||!rail.framed||!rail.aligned)errors.push(screen+' sidebar frame / width regression '+JSON.stringify(rail));
    if(width===1280&&height>=800&&rail.bottom>rail.sideBottom+1)errors.push(screen+' inventory panel clipped');
   }
   if(screen==='bact'||screen==='sol') {
    const cardText=await page.locator('.shop-web__card').evaluateAll(cards=>cards.every(card=>{
     const name=card.querySelector('h2'),detail=card.querySelector('p'),fits=[name,detail].every(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1);
     return fits&&(innerWidth!==1280||(parseFloat(getComputedStyle(name).fontSize)>=38&&parseFloat(getComputedStyle(detail).fontSize)>=32));
    }));
    if(!cardText)errors.push(screen+' enlarged names/details clipped or undersized');
    const scrolling=await page.evaluate(()=>{
     const grid=document.querySelector('.shop-web__cards'),content=document.querySelector('.shop-web__desktop-content .shop-web__content'),fixed=[document.querySelector('.shop-web__filters'),document.querySelector('.shop-web__label'),document.querySelector('.shop-web__status')];
     const before=fixed.map(e=>e.getBoundingClientRect().top),first=grid.firstElementChild.getBoundingClientRect().top;
     grid.scrollTop=grid.scrollHeight;
     const result=grid.scrollTop>0&&grid.firstElementChild.getBoundingClientRect().top<first&&fixed.every((e,i)=>Math.abs(e.getBoundingClientRect().top-before[i])<1)&&content.scrollTop===0;
     grid.querySelector('button').scrollIntoView({block:'nearest'});
     const focusSafe=content.scrollTop===0&&fixed.every((e,i)=>Math.abs(e.getBoundingClientRect().top-before[i])<1);
     grid.scrollTop=0;
     return result&&focusSafe;
    });
    if(!scrolling)errors.push(screen+' item-only scrolling / fixed filters regression');
    const prices=await page.locator('.shop-web__card > button').evaluateAll(buttons=>buttons.every(button=>{
     const b=button.getBoundingClientRect(),label=button.querySelector('span').getBoundingClientRect(),icon=button.querySelector('img').getBoundingClientRect(),style=getComputedStyle(button);
     return label.right<b.right-3&&icon.left>b.left+3&&icon.bottom<b.bottom&&label.bottom<b.bottom&&icon.right<label.left&&Math.abs((icon.left+label.right)-(b.left+b.right))<2&&Math.abs(b.height-Math.min(72,Math.max(40,innerHeight*.07)))<1;
    }));
    if(!prices)errors.push(screen+' price text/icon overflow or button size changed');
    if(await page.locator('.shop-web__wallet-panel h2').innerText()!=='WALLET'||await page.locator('.shop-web__inventory-panel > h3').innerText()!=='INVENTORY')errors.push(screen+' sidebar headings');
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
   if(screen==='swap') {
    const frames=await page.evaluate(()=>{
     const wallet=document.querySelector('.shop-web__wallet-panel'),presale=document.querySelector('.shop-web__presale-legend'),notice=document.querySelector('.shop-web__swap-notice');
     return {separate:wallet.getBoundingClientRect().bottom<presale.getBoundingClientRect().top,framed:[wallet,presale].every(e=>getComputedStyle(e).borderTopWidth==='3px'&&getComputedStyle(e).borderBottomWidth==='3px'),noticeFont:parseFloat(getComputedStyle(notice).fontSize),noticeBottom:notice.getBoundingClientRect().bottom,contentBottom:document.querySelector('.shop-web__content').getBoundingClientRect().bottom,icon:!!document.querySelector('.shop-web__swap-method img')};
    });
    if(!frames.separate||!frames.framed||!frames.icon||frames.noticeFont<13)errors.push('Swap frames / readability '+JSON.stringify(frames));
    if(width===1280&&height>=800&&frames.noticeBottom>frames.contentBottom)errors.push('Swap notice clipped at target size');
    if(width===1280&&height===1100) {
     const rates=await page.locator('.shop-web__swap-summary dt').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
     if(rates<28||frames.noticeFont<25||frames.contentBottom-frames.noticeBottom>90)errors.push('Tall PSG1 Swap did not use space for readable text');
    }
   }
   if(width===1280&&height===1100&&screen==='swap')await page.screenshot({path:path.join(__dirname,'psg1-swap-tall.png')});
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
 await page.locator('.shop-web__connection-status').click();
 if(await page.evaluate(()=>window.connectCalls||0))errors.push('Status click invoked wallet');
 await page.evaluate(()=>{window.walletDisconnected=true;window.mountScreen('shop')});
 await page.locator('[data-shop-wallet]').click();
 await page.locator('.shop-web__connection-status').waitFor();
 if(await page.evaluate(()=>window.connectCalls)!==1||!await page.locator('[data-shop-tab].is-active').evaluate(e=>document.activeElement===e))errors.push('Wallet connect or focus restoration failed');
 await page.evaluate(()=>window.mountScreen('shop'));
 await page.evaluate(()=>window.press('right'));
 if(await page.evaluate(()=>document.activeElement.dataset.shopTab)!=='bact')errors.push('Gamepad tab navigation order failed');
 await page.locator('[data-shop-tab="loadout"]').click();
 await page.locator('[data-shop-slot]').first().click();if(!await page.locator('.shop-web__slot-item').first().innerText().then(t=>t.includes('SHIELD')))errors.push('Equip did not update');
 await page.locator('[data-shop-tab="bact"]').click();await page.locator('[data-shop-filter="fuel"]').click();if(await page.locator('[data-shop-buy]').count()!==3)errors.push('Fuel filter failed');
 await page.locator('[data-shop-filter="all"]').click();
 await page.locator('[data-shop-buy]').last().focus();
 const visibleBuy=()=>page.locator('[data-shop-buy]').last().evaluate(e=>{
  const r=e.getBoundingClientRect(),box=e.closest('.shop-web__cards').getBoundingClientRect();
  return r.top>=box.top&&r.bottom<=box.bottom;
 });
 if(!await visibleBuy())errors.push('Focused catalog item hidden');
 await page.locator('[data-shop-buy]').last().click();
 if(!await visibleBuy())errors.push('Catalog focus hidden after purchase rerender');
 await page.locator('[data-shop-filter="fuel"]').click();
 await page.locator('[data-shop-buy]').first().click();if(!(await page.locator('.shop-web__status').innerText()).includes('TEST PURCHASE DECLINED'))errors.push('Purchase status failed');
 await page.locator('[data-shop-tab="swap"]').click();await page.locator('[data-shop-swap-amount]').fill('0.5');if(!(await page.locator('[data-shop-swap-receive]').innerText()).includes('500'))errors.push('Swap preview failed');
 await page.evaluate(()=>{window.nativeNotifications=true;window.mountScreen('settings')});
 if(await page.locator('[data-setting="notifications"]').count()!==1)errors.push('Native notifications missing');
 // PSG1 starts immediately; fuel checks and duplicate-start protection remain.
 for(const width of [1280,640]){
  await page.setViewportSize({width,height:800});
  await page.evaluate(()=>{window.battleSetup=true;window.noFuel=false;window.startCalls=0;document.documentElement.dataset.uiDevice='psg1';window.mountScreen('shop')});
  if(await page.locator('[data-shop-controls-dialog]').count())errors.push('PSG1 controls dialog still rendered');
  await page.locator('[data-shop-start]').focus();await page.evaluate(()=>window.press('select'));
  await page.locator('[data-shop-start]').click();
  if(await page.evaluate(()=>window.startCalls)!==1)errors.push('PSG1 start was blocked or duplicated');
  await page.evaluate(()=>window.finishStart());
  await page.evaluate(()=>{window.noFuel=true;window.mountScreen('shop')});await page.locator('[data-shop-start]').click();
  if(await page.evaluate(()=>window.startCalls)!==1||!(await page.locator('.shop-web__status').innerText()).includes('NEED 1 FUEL'))errors.push('PSG1 fuel guard changed');
 }
 await page.setViewportSize({width:1280,height:800});
 await page.evaluate(()=>{document.documentElement.dataset.uiDevice='desktop';window.noFuel=false;window.startCalls=0;window.mountScreen('shop')});
 await page.locator('[data-shop-start]').click();
 if(!await page.locator('[data-shop-controls-dialog]').evaluate(e=>e.open)||await page.evaluate(()=>window.startCalls)!==0)errors.push('Desktop briefing skipped');
 await page.locator('[data-shop-controls-confirm]').click();
 if(await page.evaluate(()=>window.startCalls)!==1)errors.push('Desktop confirmation failed');
 await page.evaluate(()=>{window.finishStart();window.battleSetup=false});
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
