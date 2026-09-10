// Reuse local-only real-renderer fixtures, without running their PSG1 test loops.
const fs=require('fs'),path=require('path'),Module=require('module');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..');
function fixtureServer(name){
 const filename=path.join(__dirname,'review-psg1-'+name+'.cjs');
 const source=fs.readFileSync(filename,'utf8'),end=source.lastIndexOf('\n(async');
 if(end<0)throw Error('Fixture entry point missing '+name);
 const module=new Module(filename);module.filename=filename;module.paths=Module._nodeModulePaths(path.dirname(filename));
 module._compile(source.slice(0,end)+'\nmodule.exports=server;',filename);return module.exports;
}
const groups={
 screens:['settings','loadout','bact','sol','swap'],
 operations:['HeadquartersWebUi','SocialsWebUi','RankingWebUi'],
 quarters:['MainTreasury','MainEvents','MainStaking','MainTrading','MainBoost','MainAirdrop','MainWiki'],
 'tank-select':['tank'],results:['perfect','clear','failed','loading'],profile:['ready','empty','error'],
};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
 try{
  for(const [group,screens] of Object.entries(groups)){
   const server=fixtureServer(group);await new Promise(r=>server.listen(0,'127.0.0.1',r));
   try{
    const page=await browser.newPage({hasTouch:true,reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(group+': '+e.message));
    await page.route('**/*',async route=>{
     if(route.request().resourceType()!=='document')return route.continue();
     const response=await route.fetch();let html=await response.text();
     html=html.replace('data-ui-device="psg1"','data-ui-device="standard"').replace('<head>','<head><link rel="stylesheet" href="/android-screens.css">');
     // Put the override after all legacy styles, exactly as in production.
     html=html.replace('<link rel="stylesheet" href="/android-screens.css">','').replace('</head>','<link rel="stylesheet" href="/android-screens.css"></head>');
     await route.fulfill({response,body:html});
    });
    for(const [width,height] of [[390,844],[360,740],[768,1024],[844,390]]){
     await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:'+server.address().port);
     for(const screen of screens){
      await page.evaluate(({group,screen})=>{
       document.documentElement.dataset.uiPlatform='android';
       if(group==='screens')window.mountScreen(screen==='settings'?'settings':'shop');
       else if(group==='operations')window.mountScreen(screen);
       else if(group==='quarters')window.mountPage(screen);
       else if(group==='results')window.mount(screen,8);
       else if(group==='profile'){window.state=screen;window.mount()}
       else window.mount();
      },{group,screen});
      if(group==='screens'&&screen!=='settings')await page.locator('[data-shop-tab="'+screen+'"]').tap();
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});
      const metrics=await page.evaluate(()=>{
       const main=document.querySelector('main'),r=main.getBoundingClientRect();
       const scrolls=[...main.querySelectorAll('*')].filter(e=>/auto|scroll/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight);
       return {doc:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],root:[r.left,r.top,r.right,r.bottom],bad:[...main.querySelectorAll('button')].filter(e=>e.getClientRects().length&& !e.closest('dialog:not([open])')).filter(e=>{const b=e.getBoundingClientRect();return b.width<20||b.height<25}).map(e=>e.textContent.trim()).slice(0,5),scrolls:scrolls.length};
      });
      if(metrics.doc[0]>width||metrics.doc[1]>height||metrics.root[2]>width+1||metrics.root[3]>height+1||metrics.bad.length)errors.push(group+'/'+screen+' '+width+': '+JSON.stringify(metrics));
      const contentErrors=await page.evaluate(()=>{
       const failures=[];
       for(const card of document.querySelectorAll('.settings-web__rows article,.tank-select-web__card,.shop-web__card')){
        const bounds=card.getBoundingClientRect();
        for(const child of card.children){
         const r=child.getBoundingClientRect();
         if(r.width&&r.height&&(r.top<bounds.top-2||r.bottom>bounds.bottom+2||r.left<bounds.left-2||r.right>bounds.right+2))failures.push('Card overflow: '+child.textContent.trim());
        }
       }
       for(const row of document.querySelectorAll('.settings-web__rows article')){
        const label=row.querySelector('h2').getBoundingClientRect(),button=row.querySelector('button').getBoundingClientRect();
        if(label.right>button.left+1)failures.push('Settings label overlaps toggle');
       }
       for(const scroller of document.querySelectorAll('.shop-web__cards,.tank-select-web__grid')){
        if(scroller.scrollHeight<=scroller.clientHeight)continue;
        const old=scroller.scrollTop;scroller.scrollTop=scroller.scrollHeight;
        if(scroller.scrollTop===0)failures.push('Items cannot scroll');
        scroller.scrollTop=old;
       }
       return failures;
      });
      errors.push(...contentErrors.map(e=>group+'/'+screen+' '+width+': '+e));
      if(width===390)await page.screenshot({path:path.join(__dirname,'android-'+group+'-'+screen+'.png')});
     }
     console.log(group,width,height,'rendered');
    }
    await page.close();
   }finally{server.close()}
  }
  // Main menu must have identical computed styles with/without the new sheet.
  const server=fixtureServer('leaderboard');await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
   const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('http://127.0.0.1:'+server.address().port);
   const unchanged=await page.evaluate(async()=>{
    document.documentElement.dataset.uiDevice='standard';document.documentElement.dataset.uiPlatform='android';await document.fonts.ready;
    const snapshot=()=>[...document.querySelectorAll('.main-menu-web,.main-menu-web *')].map(e=>{const s=getComputedStyle(e);return [s.display,s.width,s.height,s.fontSize,s.padding,s.color,s.background,s.border].join('|')}).join('\n');
    const before=snapshot(),link=document.createElement('link');link.rel='stylesheet';link.href='/android-screens.css';document.head.append(link);await new Promise(r=>link.onload=r);return before===snapshot();
   });if(!unchanged)errors.push('ANDROID MAIN PAGE CHANGED');await page.close();
  }finally{server.close()}
  if(errors.length)throw Error(errors.join('\n'));
  console.log('PASS: all Android subpages fit portrait/tablet/landscape; main page unchanged.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
