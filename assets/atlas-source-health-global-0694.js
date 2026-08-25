'use strict';
/* ATLAS AML 0.71.0 · Auditoría y salud de fuentes global · semántica fuente/integración/materialización */
(function atlasGlobalSourceHealth0710(){
  const VERSION='0710.1',TTL=5*60*1000;
  const PIPELINES=['RUNTIME_SNAPSHOT','UAF_SECTOR_PROFILE','SII_ENTITY_YEAR','OSFL_PROFILE','SANCTION_IDENTITY'];
  let raf=0,host=null,matState=null,matAt=0,matInflight=null;
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch{return window.sb||null;}};
  const stamp=v=>{if(!v)return '—';try{return new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));}catch{return String(v)}};

  function authVisible(){
    const auth=document.querySelector('.auth-screen');
    if(!auth)return false;
    const r=auth.getBoundingClientRect?.();
    return !!r&&r.width>0&&r.height>0;
  }

  function findTopbar(){
    const vw=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);
    const search=document.querySelector('input[placeholder*="Buscar entidad" i],input[placeholder*="entidad o RUT" i],input[placeholder*="RUT" i]');
    if(search){
      let node=search.parentElement,best=null;
      for(let i=0;i<10&&node;i++,node=node.parentElement){
        const r=node.getBoundingClientRect?.();
        if(!r)continue;
        const hasExit=[...node.querySelectorAll('button,a')].some(el=>norm(el.textContent)==='salir');
        if(r.width>=vw*.80&&r.height<=110){best=node;if(hasExit)break;}
      }
      if(best)return best;
    }
    const candidates=[...document.querySelectorAll('header,nav,[role="banner"],.topbar,.app-topbar,.app-header,.shell-topbar,.header')];
    const ranked=candidates.map(el=>({el,r:el.getBoundingClientRect?.()})).filter(x=>x.r&&x.r.width>=vw*.72&&x.r.height>=32&&x.r.height<=120&&x.r.top<140);
    const withExit=ranked.find(x=>[...x.el.querySelectorAll('button,a')].some(el=>norm(el.textContent)==='salir'));
    return (withExit||ranked[0])?.el||null;
  }

  function fallbackHost(){
    let h=document.querySelector('[data-atlas-global-audit-fallback="1"]');
    if(!h){h=document.createElement('div');h.dataset.atlasGlobalAuditFallback='1';document.body.appendChild(h);}
    return h;
  }

  function ensureSeed(){
    if(document.querySelector('.ash-audit,.a57-data-audit'))return;
    const seed=document.createElement('section');
    seed.className='v024-audit a57-data-audit';
    seed.dataset.atlasAuditSeed='0710';
    seed.innerHTML='<button type="button" class="v024-audit-summary"><span class="a57-title"><span><strong>Auditoría y salud de fuentes</strong><small>Inicializando telemetría gobernada</small></span></span></button>';
    document.body.appendChild(seed);
  }

  async function loadMaterialization(force=false){
    if(!force&&matState&&Date.now()-matAt<TTL)return matState;
    if(matInflight)return matInflight;
    const c=db();if(!c)return null;
    matInflight=(async()=>{
      const {data,error}=await c.from('aml_sync_state').select('pipeline,status,updated_at,fusion_synced_at,sii_synced_at').in('pipeline',PIPELINES);
      if(error)throw error;
      const map={};for(const row of data||[])map[row.pipeline]=row;
      matState=map;matAt=Date.now();return map;
    })().catch(()=>null).finally(()=>{matInflight=null;schedule();});
    return matInflight;
  }

  function materializationText(){
    if(!matState)return 'Materialización Atlas: verificando derivados internos…';
    const label={RUNTIME_SNAPSHOT:'runtime',UAF_SECTOR_PROFILE:'UAF',SII_ENTITY_YEAR:'SII',OSFL_PROFILE:'OSFL',SANCTION_IDENTITY:'sanciones'};
    const parts=PIPELINES.map(p=>{const r=matState[p];return `${label[p]} ${r?stamp(r.updated_at||r.fusion_synced_at||r.sii_synced_at):'—'}`;});
    const failed=PIPELINES.filter(p=>matState[p]&&String(matState[p].status||'').toUpperCase().includes('FAIL'));
    return `${failed.length?'⚠':'✓'} Materialización Atlas · ${parts.join(' · ')}`;
  }

  function applySemantics(audit){
    if(!audit)return;
    audit.dataset.semanticContract='SOURCE_INTEGRATION_MATERIALIZATION_0710';
    const subtitle=audit.querySelector('.a57-title small');
    if(subtitle&&subtitle.textContent!=='Fuente · integración · materialización Atlas')subtitle.textContent='Fuente · integración · materialización Atlas';
    audit.querySelectorAll('.ash-metric > span').forEach(el=>{if(norm(el.textContent)==='fuentes al día')el.textContent='Fuentes verificadas';});
    const head=audit.querySelector('.ash-catalog-head');
    if(head?.children?.[1]&&head.children[1].textContent!=='Dato en fuente')head.children[1].textContent='Dato en fuente';
    audit.querySelectorAll('.ash-catalog-row').forEach(row=>{const first=row.querySelector('.ash-catalog-cell small');if(first&&first.textContent!=='último dato observado en la fuente')first.textContent='último dato observado en la fuente';});
    const panel=audit.querySelector('[data-ash-panel]');
    if(panel?.querySelector('.ash-summary-grid')){
      let note=panel.querySelector('[data-atlas-materialization="0710"]');
      if(!note){note=document.createElement('div');note.className='ash-impact';note.dataset.atlasMaterialization='0710';panel.appendChild(note);}
      const txt=materializationText();if(note.textContent!==txt)note.textContent=txt;
    }
    const footer=audit.querySelector('.ash-detail footer');
    if(footer){
      const txt='Fuente verificada, disponibilidad técnica y materialización Atlas son dimensiones separadas. Un estado verde de la fuente no implica por sí solo que todos los derivados ya estén rematerializados.';
      if(footer.textContent!==txt)footer.textContent=txt;
    }
  }

  function place(){
    raf=0;
    if(authVisible()){
      document.querySelector('[data-atlas-global-audit-fallback="1"]')?.remove();
      return;
    }
    ensureSeed();
    const audit=document.querySelector('.ash-audit,.a57-data-audit');
    if(!audit)return;
    const top=findTopbar();
    host=top||fallbackHost();
    document.querySelectorAll('[data-audit-host="1"]').forEach(el=>{if(el!==host)delete el.dataset.auditHost;});
    host.dataset.auditHost='1';
    host.dataset.atlasGlobalAuditHost='0710';
    audit.dataset.topbarMode='1';
    audit.dataset.topbarPlacement='center';
    audit.dataset.globalAudit='0710';
    if(audit.parentElement!==host)host.appendChild(audit);
    const fallback=document.querySelector('[data-atlas-global-audit-fallback="1"]');
    if(top&&fallback&&fallback!==host)fallback.remove();
    applySemantics(audit);
    void loadMaterialization(false);
  }

  function schedule(){if(!raf)raf=requestAnimationFrame(place);}
  const obs=new MutationObserver(schedule);
  obs.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(schedule,120),{once:true});else setTimeout(schedule,120);
  ['hashchange','popstate','resize','atlas:nav-refresh'].forEach(evt=>window.addEventListener(evt,schedule));
  setInterval(()=>void loadMaterialization(true),TTL);
  window.AtlasGlobalSourceHealth={version:VERSION,semanticContract:'SOURCE_INTEGRATION_MATERIALIZATION_0710',refresh:()=>{schedule();return loadMaterialization(true);},getMaterializationState:()=>matState};
})();
