'use strict';
/* ATLAS AML · Gasto Público progressive route 0577
 * Isolated fast surface: does NOT create .v037-spend, therefore legacy Audit/Guided
 * cannot auto-start and block the lightweight entry path.
 * Production first tries the same-origin snapshot vendored by Pages; raw GitHub is
 * only a fallback. Full v037 history is opt-in.
 */
(function(){
  const VIEW='public-spend';
  const FAST_ID='atlas-public-spend-fast-0577';
  const HOST_CLASS='atlas-public-spend-fast-host';
  const STATUS_ID='atlas-public-spend-route-status-0577';
  const LOCAL_URL='./data/public-spend/spend_view_v2.json';
  const FALLBACK_URL='https://raw.githubusercontent.com/smoralesm07-source/Rada_Presupuesto_Abierto/main/docs/data/spend_view_v2.json';
  const TITLE='Gasto Público';
  const SUBTITLE='Flujos, concentración y proveedores desde Presupuesto Abierto.';
  let opening=false;
  let payload=null;
  let inflight=null;

  const nf=new Intl.NumberFormat('es-CL');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>{const n=Number(v||0),a=Math.abs(n);if(a>=1e12)return '$'+(n/1e12).toLocaleString('es-CL',{maximumFractionDigits:2})+' bill.';if(a>=1e9)return '$'+(n/1e9).toLocaleString('es-CL',{maximumFractionDigits:1})+' mil M';if(a>=1e6)return '$'+(n/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})+' M';return '$'+nf.format(Math.round(n));};
  const pct=v=>Number.isFinite(Number(v))?(100*Number(v)).toLocaleString('es-CL',{maximumFractionDigits:1})+'%':'—';
  const clock=()=>window.performance?.now?.()||Date.now();

  function publish(status,extra={}){
    window.__ATLAS_PUBLIC_SPEND_MOBILE_0573__={
      status,version:'0577.0',view:VIEW,fastReady:!!payload,
      isolatedFastHost:!!document.querySelector('.'+HOST_CLASS),
      legacyHost:!!document.querySelector('.v037-spend'),
      legacyLoaderReady:typeof window.__AML_PUBLIC_SPEND__?.load==='function',
      checkedAt:new Date().toISOString(),...extra
    };
  }

  function shell(){
    try{if(typeof window.shell==='function')window.shell(TITLE,SUBTITLE,VIEW);}catch(error){publish('shell-error',{error:String(error?.message||error)});}
    return document.querySelector('#content');
  }

  function content(){return document.querySelector('#content')||shell();}

  function fastHost(reset=false){
    const c=content();if(!c)return null;
    let h=c.querySelector('.'+HOST_CLASS);
    if(!h||reset){
      c.innerHTML=`<section class="${HOST_CLASS}" data-atlas-public-spend-mode="fast"></section>`;
      h=c.querySelector('.'+HOST_CLASS);
    }
    return h;
  }

  function loading(message='Cargando resumen optimizado…'){
    const h=fastHost(true);if(!h)return false;
    h.innerHTML=`<div id="${FAST_ID}"><div class="psf-bar"><div><h2>Gasto Público</h2><p>Presupuesto Abierto · entrada optimizada</p></div><div id="${STATUS_ID}" class="psf-status">${esc(message)}</div></div><div class="psf-card"><div class="psf-note">La entrada rápida está aislada del histórico pesado y del auditor avanzado.</div><div class="psf-progress" aria-hidden="true"><i></i></div></div></div>`;
    publish('fast-loading');return true;
  }

  function amount(x){return Number(x?.amount_l12??x?.amount_clp??x?.amount??0)||0;}

  function render(D,perf={}){
    const h=fastHost(false);if(!h)return false;
    const services=[...(D.services||[])].sort((a,b)=>amount(b)-amount(a));
    const providers=[...(D.providers||[])].sort((a,b)=>amount(b)-amount(a));
    const flows=D.flows||[];
    const total=Number(D.overview?.amount_l12||D.overview?.total_amount_l12||services.reduce((a,s)=>a+amount(s),0));
    const tx=Number(D.overview?.transactions_l12||0);
    const top10=providers.length&&total?providers.slice(0,10).reduce((a,p)=>a+amount(p),0)/total:null;
    const months=D.window?.months||[];
    const windowText=months.length?`${months[0]} → ${months[months.length-1]}`:'ventana publicada';
    h.innerHTML=`<div id="${FAST_ID}">
      <div class="psf-bar"><div><h2>Gasto Público</h2><p>Presupuesto Abierto · ${esc(windowText)}</p></div><div><div class="psf-actions"><button id="psf-reload-0577" type="button">Actualizar resumen</button><button id="psf-full-0577" type="button">Análisis histórico completo</button></div><div id="${STATUS_ID}" class="psf-status">Listo${perf.totalMs?` · ${Math.round(perf.totalMs)} ms`:''}${perf.source?` · ${esc(perf.source)}`:''}</div></div></div>
      <div class="psf-kpis"><div class="psf-kpi"><small>Devengado visible</small><b>${money(total)}</b></div><div class="psf-kpi"><small>Servicios públicos</small><b>${nf.format(services.length)}</b></div><div class="psf-kpi"><small>Proveedores</small><b>${nf.format(providers.length)}</b></div><div class="psf-kpi"><small>Relaciones publicadas</small><b>${nf.format(flows.length)}</b></div></div>
      <div class="psf-grid"><section class="psf-card"><h3>Servicios con mayor magnitud</h3>${services.slice(0,10).map((s,i)=>`<div class="psf-row"><div class="psf-name">${i+1}. ${esc(s.organization_name||s.name||s.organization_id)}</div><div class="psf-amt">${money(amount(s))}</div></div>`).join('')||'<div class="psf-note">Sin servicios visibles.</div>'}</section><section class="psf-card"><h3>Proveedores con mayor magnitud</h3>${providers.slice(0,10).map((p,i)=>`<div class="psf-row"><div class="psf-name">${i+1}. ${esc(p.provider_name||p.name||p.provider_id)}</div><div class="psf-amt">${money(amount(p))}</div></div>`).join('')||'<div class="psf-note">Sin proveedores visibles.</div>'}</section></div>
      <div class="psf-note">${tx?`${nf.format(tx)} pagos en la ventana publicada · `:''}${top10!=null?`Top 10 proveedores: ${pct(top10)} del monto visible · `:''}El histórico multianual y el auditor avanzado se activan sólo al solicitar el análisis completo.</div>
    </div>`;
    document.getElementById('psf-reload-0577')?.addEventListener('click',()=>loadFast(true));
    document.getElementById('psf-full-0577')?.addEventListener('click',loadFull);
    publish('fast-ready',{services:services.length,providers:providers.length,flows:flows.length,...perf});
    window.dispatchEvent(new CustomEvent('atlas:public-spend-fast-ready',{detail:{version:'0577.0',perf}}));
    return true;
  }

  async function fetchWithTimeout(url,cacheMode,timeoutMs=10000){
    const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeoutMs);
    try{
      const t0=clock();const r=await fetch(url,{cache:cacheMode,signal:ctl.signal});const t1=clock();
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const text=await r.text();const t2=clock();const D=JSON.parse(text);const t3=clock();
      if(D?.schema!=='PRESUPUESTO_SPEND_VIEW_V2')throw new Error('esquema inesperado');
      return {D,perf:{bytes:text.length,networkMs:t1-t0,readMs:t2-t1,parseMs:t3-t2,totalMs:t3-t0}};
    }finally{clearTimeout(timer);}
  }

  async function obtain(force=false){
    if(payload&&!force)return {D:payload,perf:{...(window.__ATLAS_PUBLIC_SPEND_PERF__||{}),source:'memoria'}};
    if(inflight&&!force)return inflight;
    inflight=(async()=>{
      let firstError=null;
      try{
        const out=await fetchWithTimeout(LOCAL_URL,force?'reload':'default',8000);
        out.perf.source='snapshot local';payload=out.D;window.__ATLAS_PUBLIC_SPEND_PERF__={version:'0577.0',...out.perf,measuredAt:new Date().toISOString()};return out;
      }catch(error){firstError=error;publish('local-snapshot-fallback',{error:String(error?.message||error)});}
      try{
        const out=await fetchWithTimeout(FALLBACK_URL,force?'reload':'force-cache',12000);
        out.perf.source='respaldo remoto';payload=out.D;window.__ATLAS_PUBLIC_SPEND_PERF__={version:'0577.0',...out.perf,measuredAt:new Date().toISOString()};return out;
      }catch(error){throw new Error(`Snapshot local: ${String(firstError?.message||firstError||'no disponible')} · respaldo: ${String(error?.message||error)}`);}
    })().finally(()=>{inflight=null;});
    return inflight;
  }

  function renderError(error){
    const h=fastHost(false)||fastHost(true);if(!h)return false;
    h.innerHTML=`<div id="${FAST_ID}"><div class="psf-bar"><div><h2>Gasto Público</h2><p>Presupuesto Abierto</p></div></div><div class="psf-error"><b>No fue posible cargar el resumen de Gasto Público.</b><br><small>${esc(error?.message||error)}</small><div class="psf-actions"><button id="psf-retry-0577" type="button">Reintentar</button><button id="psf-full-0577" type="button">Análisis histórico completo</button></div></div></div>`;
    document.getElementById('psf-retry-0577')?.addEventListener('click',()=>loadFast(true));document.getElementById('psf-full-0577')?.addEventListener('click',loadFull);return true;
  }

  async function loadFast(force=false){
    loading(force?'Actualizando resumen…':'Cargando resumen optimizado…');const started=clock();
    try{const out=await obtain(force);out.perf.totalMs=clock()-started;render(out.D,out.perf);return true;}
    catch(error){publish('fast-error',{error:String(error?.message||error)});renderError(error);return false;}
  }

  async function loadFull(){
    const loader=window.__AML_PUBLIC_SPEND__?.load;
    if(typeof loader!=='function'){const error=new Error('El cargador histórico compilado no está disponible.');publish('full-loader-missing');renderError(error);return false;}
    const s=document.getElementById(STATUS_ID);if(s)s.textContent='Abriendo análisis histórico completo…';
    publish('full-loading');
    try{await loader();publish('full-ready');return true;}catch(error){publish('full-error',{error:String(error?.message||error)});shell();if(payload)render(payload,{...(window.__ATLAS_PUBLIC_SPEND_PERF__||{}),source:'memoria'});else renderError(error);return false;}
  }

  async function open(){
    if(opening)return false;opening=true;window.AtlasMobileNav?.close?.();publish('opening');
    try{shell();return await loadFast(false);}finally{opening=false;}
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();open().catch(error=>{publish('route-error',{error:String(error?.message||error)});renderError(error);});
  },true);

  window.AtlasPublicSpendMobile0573={open,ensure:()=>!!document.querySelector('.'+HOST_CLASS),recover:()=>loadFast(false),health:()=>window.__ATLAS_PUBLIC_SPEND_MOBILE_0573__||null,loadFull};
  window.AtlasPublicSpendRoute0573=window.AtlasPublicSpendMobile0573;
  publish('installed');
})();
