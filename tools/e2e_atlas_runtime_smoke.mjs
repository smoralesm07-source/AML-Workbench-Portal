import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const baseURL=process.env.ATLAS_E2E_URL||'http://127.0.0.1:4173/';
const accessToken=process.env.ATLAS_E2E_ACCESS_TOKEN||'';
const refreshToken=process.env.ATLAS_E2E_REFRESH_TOKEN||'';
const expectedEmail=process.env.ATLAS_E2E_EMAIL||'';
if(!accessToken||!refreshToken||!expectedEmail)throw new Error('E2E session inputs are missing');

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const pageErrors=[];
const consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push({text:m.text(),location:m.location()||null});});

const report={schema:'ATLAS_RUNTIME_SMOKE_V1',startedAt:new Date().toISOString(),routes:[],pageErrors,consoleErrors};
try{
  await page.goto(baseURL,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>typeof sb!=='undefined'&&!!sb?.auth?.setSession,null,{timeout:15000});
  const set=await page.evaluate(async({accessToken,refreshToken})=>{
    const {data,error}=await sb.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
    return {email:data?.session?.user?.email||null,error:error?.message||null};
  },{accessToken,refreshToken});
  assert.equal(set.error,null);
  assert.equal(set.email,expectedEmail);
  await page.reload({waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>{try{return typeof state!=='undefined'&&state?.access?.enabled===true&&state?.access?.provisional!==true}catch{return false}},null,{timeout:20000});
  await page.waitForFunction(()=>typeof navigate==='function',null,{timeout:10000});
  await page.waitForTimeout(300);

  const views=await page.evaluate(()=>[...new Set([...document.querySelectorAll('[data-view]')].map(el=>el.getAttribute('data-view')).filter(Boolean))]);
  report.discoveredViews=views;
  for(const view of views){
    const started=Date.now();
    const beforePageErrors=pageErrors.length;
    const beforeConsoleErrors=consoleErrors.length;
    let outcome='ok',detail='';
    try{
      await page.evaluate(async v=>{const out=navigate(v);if(out&&typeof out.then==='function')await out;},view);
      await page.waitForTimeout(250);
      const snap=await page.evaluate(()=>({
        view:(typeof state!=='undefined'&&state?.view)||null,
        text:(document.querySelector('#content')?.innerText||document.querySelector('#app')?.innerText||'').slice(0,800),
        runtimeReady:window.__AML_RUNTIME_READY__||null
      }));
      if(!snap.text.trim())throw new Error('route rendered no visible content');
      detail=snap.text.slice(0,120).replace(/\s+/g,' ');
    }catch(error){outcome='error';detail=String(error?.message||error);}
    report.routes.push({view,outcome,durationMs:Date.now()-started,newPageErrors:pageErrors.slice(beforePageErrors),newConsoleErrors:consoleErrors.slice(beforeConsoleErrors),detail});
  }

  report.finishedAt=new Date().toISOString();
  fs.writeFileSync('e2e-atlas-runtime-smoke.json',JSON.stringify(report,null,2));
  const failed=report.routes.filter(r=>r.outcome!=='ok'||r.newPageErrors.length);
  console.log(JSON.stringify({schema:report.schema,discoveredViews:report.discoveredViews,routes:report.routes,pageErrors:report.pageErrors,consoleErrors:report.consoleErrors},null,2));
  if(failed.length)throw new Error(`runtime smoke failures: ${failed.map(r=>`${r.view}:${r.detail}`).join(' | ')}`);
}finally{
  if(!fs.existsSync('e2e-atlas-runtime-smoke.json')){
    report.finishedAt=new Date().toISOString();
    fs.writeFileSync('e2e-atlas-runtime-smoke.json',JSON.stringify(report,null,2));
  }
  await browser.close();
}
