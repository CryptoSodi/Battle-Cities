// Boundary selection and state-preserving resize checks using real TS modules.
const fs=require('fs'),path=require('path'),http=require('http'),ts=require('typescript');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..');
const modules=['deviceUi','focusScroll'].map(name=>ts.transpileModule(fs.readFileSync(path.join(root,'src/webUi',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
const code=`
const deps={isPlaySolanaPsg1:profile=>profile?.model==='PSG1'};const require=()=>deps;
${modules.map(code=>`Object.assign(deps,(()=>{const exports={};${code};return exports})());`).join('\n')}
if(new URLSearchParams(location.search).has('native'))window.battleCitiesAndroidDevice={model:new URLSearchParams(location.search).get('native')};
deps.initializeDeviceUi();window.controls=()=>deps.isPsg1Controls();
const host=document.querySelector('[data-web-ui]');window.renders=0;
const render=()=>{window.renders++;host.innerHTML='<main><input data-field="amount" value=""><div class="scroll-list" style="height:100px;overflow:auto"><div style="height:700px"><button data-action="end">END</button></div></div><dialog><button>CLOSE</button></dialog></main>'};render();
const abort=new AbortController();deps.bindUiLayoutRefresh(host,abort.signal,render);window.stop=()=>abort.abort();
`;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><div data-web-ui></div><script>'+code+'</script></body></html>')});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:'+server.address().port;
  for(const [query,pinned] of [['',null],['?ui=android','android'],['?ui=psg1','psg1'],['?native=PSG1','psg1'],['?native=Seeker','android']]){
   await page.goto(url+query);
   for(const width of [1440,1280,1279,1024,900,899,640,900,1280]){
    await page.setViewportSize({width,height:800});
    const expected=pinned||(width<900?'android':width<1280?'medium':'web');
    await page.waitForFunction(expected=>{const d=document.documentElement.dataset;return expected==='medium'?d.uiDevice==='psg1'&&d.uiResponsive==='true':expected==='psg1'?d.uiDevice==='psg1'&&d.uiResponsive==='false':d.uiDevice==='standard'&&d.uiPlatform===expected},expected);
    if(await page.evaluate(()=>window.controls())!==(expected==='psg1'))errors.push('Physical control behavior leaked '+query+' '+width);
   }
  }
  await page.setViewportSize({width:1440,height:800});await page.goto(url);
  await page.locator('input').fill('0.75');await page.locator('input').focus();await page.locator('.scroll-list').evaluate(e=>e.scrollTop=120);
  await page.setViewportSize({width:1024,height:800});await page.waitForFunction(()=>document.documentElement.dataset.uiResponsive==='true');
  if(await page.locator('input').inputValue()!=='0.75'||!await page.locator('input').evaluate(e=>document.activeElement===e)||await page.locator('.scroll-list').evaluate(e=>e.scrollTop)!==120)errors.push('Form/focus/scroll lost at breakpoint');
  await page.locator('dialog').evaluate(e=>e.showModal());const renders=await page.evaluate(()=>window.renders);
  await page.setViewportSize({width:640,height:800});await page.waitForFunction(()=>document.documentElement.dataset.uiPlatform==='android');
  if(await page.evaluate(()=>window.renders)!==renders||!await page.locator('dialog').evaluate(e=>e.open))errors.push('Resize replaced open dialog');
  await page.locator('dialog').evaluate(e=>e.close());await page.waitForFunction(renders=>window.renders>renders,renders);
  if(await page.locator('input').inputValue()!=='0.75')errors.push('Dialog dismissal lost form state');
  await page.evaluate(()=>window.stop());const stopped=await page.evaluate(()=>window.renders);await page.setViewportSize({width:1440,height:800});await page.waitForFunction(()=>document.documentElement.dataset.uiPlatform==='web');
  if(await page.evaluate(()=>window.renders)!==stopped)errors.push('Unmounted layout listener still active');
  if(errors.length)throw Error(errors.join('\n'));
  console.log('PASS: 899/900/1279/1280 boundaries, repeated resize, native/preview priority, controller isolation, form/focus/scroll preservation, dialogs and cleanup.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
