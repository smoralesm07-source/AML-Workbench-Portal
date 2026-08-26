'use strict';
/* ATLAS AML · Global source health 0.71.3 · stable topbar placement */
(function atlasGlobalSourceHealth0713(){
  const VERSION='0713.0',TTL=5*60*1000;
  const PIPELINES=['RUNTIME_SNAPSHOT','UAF_SECTOR_PROFILE','SII_ENTITY_YEAR','OSFL_PROFILE','SANCTION_IDENTITY'];
  let raf=0,matState=null,matAt=0,matInflight=null,retryTimer=0,retryCount=0;
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch{return window.sb||null;}};
  const stamp=v=>{if(!v)return '—';try{return new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));}catch{return String(v);}};
  const setData=(el,key,value)=>{if(el&&el.dataset[key]!==value)el.dataset[key]=value;};
  const setText=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};

  function authVisible(){const auth=document.querySelector('.auth-screen');if(!auth)return false;const r=auth.getBoundingClientRect?.();return !!r&&r.width>0&&r.height>0;}
  function findTopbar(){
    const vw=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);
    const search=document.querySelector('input[placeholder*="Buscar entidad" i],input[placeholder*="entidad o RUT" i],input[placeholder*="RUT" i]');
    if(search){
      let node=search.parentElement,best=null;
      for(let i=0;i<10&&node;i++,node=node.parentElement){
        const r=node.getBoundingClientRect?.();if(!r)continue;
        const hasExit=[...node.querySelectorAll('button,a')].some(el=>norm(el.textContent)==='salir');
        if(r.width>=vw*.72&&r.height<=110&&r.top<140){best=node;if(hasExit)break;}
      }
      if(best)return best;
    }
    const candidates=[...document.querySelectorAll('header,nav,[role="banner"],.topbar,.app-topbar,.app-header,.shell-topbar,.header')];
    const ranked=candidates.map(el=>({el,r:el.getBoundingClientRect?.()})).filter(x=>x.r&&x.r.width>=vw*.68&&x.r.height>=32&&x.r.height<=120&&x.r.top<140);
    return (ranked.find(x=>[...x.el.querySelectorAll('button,a')].some(el=>norm(el.textContent)==='salir'))||ranked[0])?.el||null;
  }
  function fallbackHost(){let h=document.querySelector('[data-atlas-global-audit-fallback="1"]');if(!h){h=document.createElement('div');h.dataset.atlasGlobalAuditFallback='1';h.hidden=true;document.body.appendChild(h);}return h;}
  function ensureSeed(){if(document.querySelector('.ash-audit,.a57-data-audit'))return;const seed=document.createElement('section');seed.className='v024-audit a57-data-audit';seed.dataset.atlasAuditSeed='0713';seed.hidden=true;seed.innerHTML='<button type="button" class="v024-audit-summary"><span class="a57-title"><span><strong>Auditoría y salud de fuentes</strong><small>Inicializando telemetría gobernada</small></span></span></button>';fallbackHost().appendChild(seed);}

  async function loadMaterialization(force=false){
    if(!force&&matState&&Date.now()-matAt<TTL)return matState;
    if(matInflight)return matInflight;
    const c=db();if(!c)return null;
    matInflight=(async()=>{const {data,error}=await c.from('aml_sync_state').select('pipeline,status,updated_at,fusion_synced_at,sii_synced_at').in('pipeline',PIPELINES);if(error)throw error;const map={};for(const row of data||[])map[row.pipeline]=row;matState=map;matAt=Date.now();return map;})().catch(()=>null).finally(()=>{matInflight=null;schedule();});
    return matInflight;
  }
  function materializationText(){
    if(!matState)return 'Materialización Atlas: verificando derivados internos…';
    const labels={RUNTIME_SNAPSHOT:'runtime',UAF_SECTOR_PROFILE:'UAF',SII_ENTITY_YEAR:'SII',OSFL_PROFILE:'OSFL',SANCTION_IDENTITY:'sanciones'};
    const parts=PIPELINES.map(p=>{const r=matState[p];return `${labels[p]} ${r?stamp(r.updated_at||r.fusion_synced_at||r.sii_synced_at):'—'}`;});
    const failed=PIPELINES.some(p=>matState[p]&&String(matState[p].status||'').toUpperCase().includes('FAIL'));
    return `${failed?'⚠':'✓'} Materialización Atlas · ${parts.join(' · ')}`;
  }
  function applySemantics(audit){
    if(!audit)return;
    setData(audit,'semanticContract','SOURCE_INTEGRATION_MATERIALIZATION_0713');
    setText(audit.querySelector('.a57-title small'),'Fuente · integración · materialización Atlas');
    audit.querySelectorAll('.ash-metric > span').forEach(el=>{if(norm(el.textContent)==='fuentes al día')setText(el,'Fuentes verificadas');});
    const head=audit.querySelector('.ash-catalog-head');if(head?.children?.[1])setText(head.children[1],'Dato en fuente');
    audit.querySelectorAll('.ash-catalog-row').forEach(row=>setText(row.querySelector('.ash-catalog-cell small'),'último dato observado en la fuente'));
    const panel=audit.querySelector('[data-ash-panel]');
    if(panel?.querySelector('.ash-summary-grid')){
      let note=panel.querySelector('[data-atlas-materialization="0713"]');
      if(!note){note=document.createElement('div');note.className='ash-impact';note.dataset.atlasMaterialization='0713';panel.appendChild(note);}
      setText(note,materializationText());
    }
  }
  function retryPlacement(){
    if(retryTimer||retryCount>=12)return;
    const delay=Math.min(1500,150+retryCount*125);
    retryCount+=1;
    retryTimer=setTimeout(()=>{retryTimer=0;schedule();},delay);
  }
  function place(){
    raf=0;
    if(authVisible())return;
    ensureSeed();
    const audit=document.querySelector('.ash-audit,.a57-data-audit');if(!audit)return;
    const top=findTopbar();
    if(!top){audit.hidden=true;fallbackHost().appendChild(audit);retryPlacement();return;}
    retryCount=0;if(retryTimer){clearTimeout(retryTimer);retryTimer=0;}
    document.querySelectorAll('[data-audit-host="1"]').forEach(el=>{if(el!==top)delete el.dataset.auditHost;});
    setData(top,'auditHost','1');setData(top,'atlasGlobalAuditHost','0713');
    setData(audit,'topbarMode','1');setData(audit,'topbarPlacement','center');setData(audit,'globalAudit','0713');
    if(audit.parentElement!==top)top.appendChild(audit);
    audit.hidden=false;
    const fallback=document.querySelector('[data-atlas-global-audit-fallback="1"]');if(fallback&&fallback!==top)fallback.remove();
    applySemantics(audit);void loadMaterialization(false);
  }
  function schedule(){if(!raf)raf=requestAnimationFrame(place);}
  function resetAndSchedule(){retryCount=0;if(retryTimer){clearTimeout(retryTimer);retryTimer=0;}schedule();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(resetAndSchedule,80),{once:true});else setTimeout(resetAndSchedule,80);
  ['hashchange','popstate','resize','pageshow','atlas:nav-refresh','atlas:runtime-ready','atlas:rendered','atlas:view-ready'].forEach(evt=>window.addEventListener(evt,resetAndSchedule));
  [250,600,1200,2200,3800].forEach(ms=>setTimeout(resetAndSchedule,ms));
  setInterval(()=>void loadMaterialization(false),TTL);
  window.AtlasGlobalSourceHealth={version:VERSION,semanticContract:'SOURCE_INTEGRATION_MATERIALIZATION_0713',freezeGuard:'NO_GLOBAL_DOM_OBSERVER',schedule:resetAndSchedule,place,refresh:(force=false)=>{resetAndSchedule();return loadMaterialization(force);},getMaterializationState:()=>matState};
})();
