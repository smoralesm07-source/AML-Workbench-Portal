'use strict';
/* ATLAS AML · Gasto Público progressive route 0576
 * Fast path: renders the compact Presupuesto Abierto aggregate first.
 * Heavy multiyear v037 remains available on demand for deep historical analysis.
 * Goal: no blank screen, no mandatory 15 MB cold load, reusable browser cache,
 * and explicit performance telemetry.
 */
(function(){
  const VIEW='public-spend';
  const AUDIT_ID='atlas-mp-audit-0550';
  const GUIDED_ID='atlas-public-spend-guided-0570';
  const STATUS_ID='atlas-public-spend-route-status-0576';
  const FAST_ID='atlas-public-spend-fast-0576';
  const FAST_URL='https://raw.githubusercontent.com/smoralesm07-source/Rada_Presupuesto_Abierto/main/docs/data/spend_view_v2.json';
  const TITLE='Gasto Público';
  const SUBTITLE='Flujos, concentración y proveedores desde Presupuesto Abierto.';
  let savedAudit=null;
  let savedGuided=null;
  let opening=false;
  let fastPayload=null;
  let fastPromise=null;

  const nf=new Intl.NumberFormat('es-CL');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>{const n=Number(v||0),a=Math.abs(n);if(a>=1e12)return '$'+(n/1e12).toLocaleString('es-CL',{maximumFractionDigits:2})+' bill.';if(a>=1e9)return '$'+(n/1e9).toLocaleString('es-CL',{maximumFractionDigits:1})+' mil M';if(a>=1e6)return '$'+(n/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})+' M';return '$'+nf.format(Math.round(n));};
  const pct=v=>Number.isFinite(Number(v))?(100*Number(v)).toLocaleString('es-CL',{maximumFractionDigits:1})+'%':'—';
  const now=()=>performance?.now?.()||Date.now();

  function rememberCurrent(){
    const a=document.getElementById(AUDIT_ID),g=document.getElementById(GUIDED_ID);
    if(a)savedAudit=a;if(g)savedGuided=g;
  }

  function publish(status,extra={}){
    window.__ATLAS_PUBLIC_SPEND_MOBILE_0573__={status,version:'0576.0',view:VIEW,fastReady:!!fastPayload,loaderReady:typeof window.__AML_PUBLIC_SPEND__?.load==='function',checkedAt:new Date().toISOString(),...extra};
  }

  function ensureContent(){
    let content=document.querySelector('#content');
    if(content)return content;
    try{window.shell?.(TITLE,SUBTITLE);}catch(_){ }
    return document.querySelector('#content');
  }

  function host(){
    const content=ensureContent();
    if(!content)return null;
    let h=content.querySelector('.v037-spend');
    if(!h){content.innerHTML='<section class="v037-spend mpa-strategic-host"></section>';h=content.querySelector('.v037-spend');}
    return h;
  }

  function restoreSurfaces(h){
    if(!h)return;
    if(!document.getElementById(GUIDED_ID)&&savedGuided)h.prepend(savedGuided);
    if(!document.getElementById(AUDIT_ID)&&savedAudit)h.prepend(savedAudit);
    rememberCurrent();
    const audit=document.getElementById(AUDIT_ID),guided=document.getElementById(GUIDED_ID);
    if(audit&&guided)audit.style.display='none';
  }

  function style(){return `<style id="atlas-public-spend-fast-style-0576">
    #${FAST_ID}{font-family:inherit;color:var(--text,#17212b)}
    #${FAST_ID} .psf-bar{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;padding:14px 16px;border:1px solid rgba(110,128,145,.22);border-radius:14px;background:rgba(255,255,255,.72)}
    #${FAST_ID} .psf-bar h2{margin:0 0 3px;font-size:18px} #${FAST_ID} .psf-bar p{margin:0;color:#66717c;font-size:12px}
    #${FAST_ID} .psf-status{font-size:12px;color:#4e6576;white-space:nowrap} #${FAST_ID} .psf-actions{display:flex;gap:8px;flex-wrap:wrap}
    #${FAST_ID} button{border:1px solid #cfd8df;background:#fff;border-radius:9px;padding:8px 11px;cursor:pointer;font:inherit;font-size:12px}
    #${FAST_ID} .psf-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}
    #${FAST_ID} .psf-kpi,#${FAST_ID} .psf-card{border:1px solid rgba(110,128,145,.22);border-radius:14px;background:rgba(255,255,255,.78)}
    #${FAST_ID} .psf-kpi{padding:13px 14px} #${FAST_ID} .psf-kpi small{display:block;color:#6f7b85;margin-bottom:4px} #${FAST_ID} .psf-kpi b{font-size:20px}
    #${FAST_ID} .psf-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px} #${FAST_ID} .psf-card{padding:14px}
    #${FAST_ID} .psf-card h3{margin:0 0 10px;font-size:14px} #${FAST_ID} .psf-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:8px 0;border-top:1px solid rgba(110,128,145,.14);align-items:center}
    #${FAST_ID} .psf-row:first-of-type{border-top:0} #${FAST_ID} .psf-name{min-width:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} #${FAST_ID} .psf-amt{font-weight:650;font-size:12px}
    #${FAST_ID} .psf-note{margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(92,113,128,.07);font-size:11px;color:#61707d}
    #${FAST_ID} .psf-error{padding:18px;border:1px solid #e0b7b7;border-radius:12px;background:#fff7f7;color:#7d3535}
    @media(max-width:900px){#${FAST_ID} .psf-kpis{grid-template-columns:1fr 1fr}#${FAST_ID} .psf-grid{grid-template-columns:1fr}}
    @media(max-width:520px){#${FAST_ID} .psf-kpis{grid-template-columns:1fr}#${FAST_ID} .psf-bar{display:block}#${FAST_ID} .psf-actions{margin-top:10px}}
  </style>`;}

  function skeleton(message='Cargando resumen optimizado…'){
    const h=host();if(!h)return null;
    rememberCurrent();
    h.innerHTML=`${style()}<div id="${FAST_ID}"><div class="psf-bar"><div><h2>Gasto Público</h2><p>Presupuesto Abierto · carga progresiva optimizada</p></div><div id="${STATUS_ID}" class="psf-status">${esc(message)}</div></div><div class="psf-card"><div class="psf-note">Preparando la capa compacta. El histórico completo ya no bloquea la entrada a esta sección.</div></div></div>`;
    restoreSurfaces(h);return h;
  }

  function amountOf(x){return Number(x?.amount_l12??x?.amount_clp??x?.amount??0)||0;}
  function renderFast(D,perf={}){
    const h=host();if(!h)return false;
    const services=[...(D.services||[])].sort((a,b)=>amountOf(b)-amountOf(a));
    const providers=[...(D.providers||[])].sort((a,b)=>amountOf(b)-amountOf(a));
    const flows=D.flows||[];
    const total=Number(D.overview?.amount_l12||D.overview?.total_amount_l12||services.reduce((a,s)=>a+amountOf(s),0));
    const tx=Number(D.overview?.transactions_l12||0);
    const topShare=providers.length&&total?providers.slice(0,10).reduce((a,p)=>a+amountOf(p),0)/total:null;
    const windowText=(D.window?.months||[]).length?`${D.window.months[0]} → ${D.window.months[D.window.months.length-1]}`:'ventana publicada';
    h.innerHTML=`${style()}<div id="${FAST_ID}">
      <div class="psf-bar"><div><h2>Gasto Público</h2><p>Presupuesto Abierto · ${esc(windowText)}</p></div><div><div class="psf-actions"><button id="psf-reload" type="button">Actualizar resumen</button><button id="psf-full" type="button">Análisis histórico completo</button></div><div id="${STATUS_ID}" class="psf-status">Listo${perf.totalMs?` · ${Math.round(perf.totalMs)} ms`:''}</div></div></div>
      <div class="psf-kpis">
        <div class="psf-kpi"><small>Devengado visible</small><b>${money(total)}</b></div>
        <div class="psf-kpi"><small>Servicios públicos</small><b>${nf.format(services.length)}</b></div>
        <div class="psf-kpi"><small>Proveedores</small><b>${nf.format(providers.length)}</b></div>
        <div class="psf-kpi"><small>Relaciones publicadas</small><b>${nf.format(flows.length)}</b></div>
      </div>
      <div class="psf-grid">
        <section class="psf-card"><h3>Servicios con mayor magnitud</h3>${services.slice(0,10).map((s,i)=>`<div class="psf-row"><div class="psf-name">${i+1}. ${esc(s.organization_name||s.name||s.organization_id)}</div><div class="psf-amt">${money(amountOf(s))}</div></div>`).join('')||'<div class="psf-note">Sin servicios visibles.</div>'}</section>
        <section class="psf-card"><h3>Proveedores con mayor magnitud</h3>${providers.slice(0,10).map((p,i)=>`<div class="psf-row"><div class="psf-name">${i+1}. ${esc(p.provider_name||p.name||p.provider_id)}</div><div class="psf-amt">${money(amountOf(p))}</div></div>`).join('')||'<div class="psf-note">Sin proveedores visibles.</div>'}</section>
      </div>
      <div class="psf-note">${tx?`${nf.format(tx)} pagos en la ventana publicada · `:''}${topShare!=null?`Top 10 proveedores: ${pct(topShare)} del monto visible · `:''}La vista abre con el agregado compacto (~2,2 MB). El histórico multianual pesado sólo se carga cuando se solicita.</div>
    </div>`;
    restoreSurfaces(h);
    document.getElementById('psf-reload')?.addEventListener('click',()=>loadFast(true));
    document.getElementById('psf-full')?.addEventListener('click',loadFullHistory);
    publish('fast-ready',{services:services.length,providers:providers.length,flows:flows.length,totalMs:perf.totalMs||null});
    window.dispatchEvent(new CustomEvent('atlas:public-spend-fast-ready',{detail:{version:'0576.0',perf}}));
    return true;
  }

  async function fetchFast(force=false){
    if(fastPayload&&!force)return fastPayload;
    if(fastPromise&&!force)return fastPromise;
    fastPromise=(async()=>{
      const t0=now();
      const response=await fetch(FAST_URL,{cache:force?'reload':'force-cache'});
      const t1=now();
      if(!response.ok)throw new Error(`Resumen compacto · HTTP ${response.status}`);
      const text=await response.text();
      const t2=now();
      const payload=JSON.parse(text);
      const t3=now();
      if(payload?.schema!=='PRESUPUESTO_SPEND_VIEW_V2')throw new Error('Resumen compacto · esquema inesperado');
      fastPayload=payload;
      window.__ATLAS_PUBLIC_SPEND_PERF__={version:'0576.0',bytes:text.length,networkMs:t1-t0,readMs:t2-t1,parseMs:t3-t2,totalMs:t3-t0,measuredAt:new Date().toISOString()};
      return payload;
    })().finally(()=>{fastPromise=null;});
    return fastPromise;
  }

  async function loadFast(force=false){
    skeleton(force?'Actualizando resumen…':'Cargando resumen optimizado…');
    const start=now();
    try{
      const D=await fetchFast(force);
      const perf={...(window.__ATLAS_PUBLIC_SPEND_PERF__||{}),totalMs:now()-start};
      renderFast(D,perf);
      return true;
    }catch(error){
      const h=host();
      if(h)h.innerHTML=`${style()}<div id="${FAST_ID}"><div class="psf-bar"><div><h2>Gasto Público</h2><p>Presupuesto Abierto</p></div></div><div class="psf-error"><b>No fue posible cargar el resumen optimizado.</b><br><small>${esc(error?.message||error)}</small><div class="psf-actions" style="margin-top:12px"><button id="psf-retry" type="button">Reintentar</button><button id="psf-full" type="button">Intentar histórico completo</button></div></div></div>`;
      restoreSurfaces(h);
      document.getElementById('psf-retry')?.addEventListener('click',()=>loadFast(true));
      document.getElementById('psf-full')?.addEventListener('click',loadFullHistory);
      publish('fast-error',{error:String(error?.message||error)});
      return false;
    }
  }

  async function loadFullHistory(){
    const loader=window.__AML_PUBLIC_SPEND__?.load;
    if(typeof loader!=='function'){publish('full-loader-missing');return false;}
    const s=document.getElementById(STATUS_ID);if(s)s.textContent='Cargando histórico completo…';
    publish('full-loading');
    try{await loader();publish('full-ready');return true;}catch(error){publish('full-error',{error:String(error?.message||error)});if(fastPayload)renderFast(fastPayload,window.__ATLAS_PUBLIC_SPEND_PERF__||{});return false;}
  }

  async function openPublicSpend(){
    if(opening)return false;opening=true;
    rememberCurrent();window.AtlasMobileNav?.close?.();publish('opening-fast');
    try{return await loadFast(false);}finally{opening=false;}
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    openPublicSpend().catch(error=>{publish('route-error',{error:String(error?.message||error)});skeleton('Error al abrir Gasto Público');});
  },true);

  window.AtlasPublicSpendMobile0573={open:openPublicSpend,ensure:()=>!!document.querySelector('.v037-spend'),recover:()=>loadFast(false),health:()=>window.__ATLAS_PUBLIC_SPEND_MOBILE_0573__||null,loadFull:loadFullHistory};
  window.AtlasPublicSpendRoute0573=window.AtlasPublicSpendMobile0573;
  publish('installed');
})();
