'use strict';

/* ATLAS AML 0.50.0 · build 0500 · Entity 360 command layer
 *
 * Capa aditiva sobre el expediente de seis lentes ya gobernado (0445 + 0447
 * autocompletado + 0448 ruta + 0449 autorización documental SII + 0460
 * desenlace del analista). No reemplaza ningún renderer existente: envuelve
 * v0203RenderEntity igual que 0449/0460 y sólo decora el DOM ya producido.
 *
 * Qué agrega, y por qué:
 *  - Lectura rápida: vigencia del dato, prioridad máxima y banderas
 *    administrativas en una sola franja, para orientar la primera mirada.
 *  - Estructura societaria y señales SII: aristas de propiedad, socios
 *    personas jurídicas, sociedades donde participa y señales estructurales.
 *    Estos campos ya se cargan en aml_entity_tax_profile (v0203OpenEntity)
 *    pero ninguna vista los mostraba.
 *  - Entidades relacionadas navegables: sólo relaciones con Entity ID
 *    gobernado explícito (target_entity_id/related_entity_id). Nunca navega
 *    por similitud de nombre; no transfiere puntaje entre expedientes.
 *  - Marcadores y recientes: lista local (localStorage, por analista/
 *    navegador) para retomar expedientes sin volver a buscar. No es dato
 *    gobernado ni se sincroniza con el backend.
 *  - Atajos de teclado y expediente imprimible.
 *
 * Alcance deliberado: sólo lectura sobre datos ya gobernados; no crea
 * inferencias AML nuevas, no toca Auth/Entra/RLS/refresh tokens y cada
 * tarjeta se omite explícitamente cuando el dato no está materializado
 * (ausencia de dato no se dibuja como cero).
 */
(function atlasEntity360Command0500(){
  const RELEASE='0.50.0';
  const BUILD='0500';
  const AUTHORITY='ENTITY360_COMMAND_LAYER_0500';
  const LS_KEY='atlas_entity360_bookmarks_v1';
  const MAX_RECENT=10;
  const MAX_PINNED=20;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
  function fmt(v){const n=num(v);return n==null?'—':n.toLocaleString('es-CL');}
  function arr(v){
    if(Array.isArray(v))return v;
    if(v==null||v==='')return[];
    if(typeof v==='string'){
      try{const j=JSON.parse(v);if(Array.isArray(j))return j;}catch(_e){}
      return v.split(/[|;]/).map(x=>x.trim()).filter(Boolean);
    }
    return[v];
  }
  function short(v,n=60){const s=String(v??'');return s.length>n?s.slice(0,n-1)+'…':s;}
  function content(){return typeof v019Content==='function'?v019Content():document.querySelector('#content');}
  function ageLabel(iso){
    if(!iso)return null;
    const t=new Date(iso).getTime();
    if(!Number.isFinite(t))return null;
    const days=Math.floor((Date.now()-t)/86400000);
    if(days<0)return null;
    if(days<1)return'hoy';
    if(days<31)return`hace ${days} día${days===1?'':'s'}`;
    const months=Math.floor(days/30.44);
    if(months<24)return`hace ${months} mes${months===1?'':'es'}`;
    const years=Math.floor(months/12);
    return`hace ${years} año${years===1?'':'s'}`;
  }
  function toIso(v){
    if(!v)return null;
    const s=String(v);
    const d=new Date(/^\d{4}$/.test(s)?`${s}-12-31T00:00:00`:(s.length<=10?`${s}T12:00:00`:s));
    return Number.isNaN(d.getTime())?null:d.toISOString();
  }

  /* ---------------- marcadores / recientes (localStorage, por navegador) ---------------- */

  function readStore(){
    try{
      const raw=localStorage.getItem(LS_KEY);
      const j=raw?JSON.parse(raw):null;
      return{pinned:Array.isArray(j?.pinned)?j.pinned:[],recent:Array.isArray(j?.recent)?j.recent:[]};
    }catch(_e){return{pinned:[],recent:[]};}
  }
  function writeStore(s){try{localStorage.setItem(LS_KEY,JSON.stringify(s));}catch(_e){}}
  function remember(row){
    if(!row?.entity_id)return;
    const s=readStore();
    const entry={entity_id:String(row.entity_id),name:row.name||row.entity_id,rut:row.rut||'',at:new Date().toISOString()};
    s.recent=[entry,...s.recent.filter(x=>x.entity_id!==entry.entity_id)].slice(0,MAX_RECENT);
    writeStore(s);
    renderBookmarks();
  }
  function togglePin(entityId,name,rut){
    if(!entityId)return;
    const s=readStore();
    const i=s.pinned.findIndex(x=>x.entity_id===entityId);
    if(i>=0)s.pinned.splice(i,1);
    else s.pinned=[{entity_id:entityId,name:name||entityId,rut:rut||'',at:new Date().toISOString()},...s.pinned].slice(0,MAX_PINNED);
    writeStore(s);
    renderBookmarks();
  }
  function bookmarkItem(r,pinned){
    return `<button type="button" class="a50-bm-item" data-a50-open="${esc(r.entity_id)}" title="Abrir ${esc(r.name)}">
      <span>${esc(short(r.name,26))}</span><small>${esc(r.rut||r.entity_id)}</small>
      <i data-a50-pin="${esc(r.entity_id)}" data-a50-pin-name="${esc(r.name)}" data-a50-pin-rut="${esc(r.rut||'')}" class="${pinned?'on':''}" title="${pinned?'Quitar marcador':'Marcar entidad'}">★</i>
    </button>`;
  }
  function bookmarksHtml(){
    const s=readStore();
    const pinnedHtml=s.pinned.length?s.pinned.map(r=>bookmarkItem(r,true)).join(''):'';
    const recentOnly=s.recent.filter(r=>!s.pinned.some(p=>p.entity_id===r.entity_id));
    const recentHtml=recentOnly.length?recentOnly.slice(0,6).map(r=>bookmarkItem(r,false)).join(''):'';
    if(!pinnedHtml&&!recentHtml){
      return `<div class="a50-bm-empty"><b>Marcadores y recientes</b><span>Las entidades que abras quedarán aquí para volver rápido. Marca ★ las que sigues activamente. Sólo en este navegador; no es dato gobernado.</span></div>`;
    }
    return `${pinnedHtml?`<div class="a50-bm-group"><span>Marcadas</span><div class="a50-bm-row">${pinnedHtml}</div></div>`:''}${recentHtml?`<div class="a50-bm-group"><span>Recientes</span><div class="a50-bm-row">${recentHtml}</div></div>`:''}`;
  }
  function renderBookmarks(){
    const host=document.querySelector('#a50-bookmarks');
    if(host)host.innerHTML=bookmarksHtml();
  }
  function mountBookmarks(){
    const c=content();if(!c)return;
    let host=document.querySelector('#a50-bookmarks');
    if(!host||host.parentElement!==c.parentElement){
      host?.remove();
      host=document.createElement('section');
      host.id='a50-bookmarks';
      host.className='a50-bookmarks';
      host.setAttribute('aria-label','Marcadores y entidades recientes');
      const anchor=document.querySelector('#a47-entity-search-host');
      if(anchor&&anchor.parentElement===c.parentElement)anchor.insertAdjacentElement('afterend',host);
      else c.insertAdjacentElement('beforebegin',host);
    }
    renderBookmarks();
  }

  /* ---------------- lectura rápida (resumen ejecutivo) ---------------- */

  function execSummaryHtml(pkg){
    const e=pkg?.e||{},findings=pkg?.findings||[],sanctions=pkg?.sanctions||[],taxRows=pkg?.taxRows||[];
    const dates=[
      ...findings.map(f=>f.updated_at),
      ...sanctions.map(s=>s.updated_at||s.event_date),
      ...taxRows.map(t=>t.commercial_year?`${t.commercial_year}`:null),
      e.updated_at
    ].map(toIso).filter(Boolean);
    let newest=null;
    for(const iso of dates){const t=new Date(iso).getTime();if(newest==null||t>newest)newest=t;}
    const freshness=newest?ageLabel(new Date(newest).toISOString()):null;

    const flags=[];
    if(e.is_uaf_observed)flags.push(['SO UAF observado','uaf']);
    if(sanctions.length)flags.push([`${sanctions.length} sanción(es)`,'bad']);
    const cgrCount=findings.filter(f=>arr(f?.payload?.producer_ids).some(x=>String(x).toUpperCase().includes('CGR'))).length;
    if(cgrCount)flags.push([`${cgrCount} hallazgo(s) CGR`,'warn']);
    if(!e.is_uaf_observed&&!sanctions.length&&!cgrCount)flags.push(['Sin banderas administrativas materializadas','neutral']);

    const scores=findings.map(f=>num(f.score_investigate)).filter(v=>v!=null);
    const maxScore=scores.length?Math.max(...scores):null;

    return `<section class="a50-brief" id="a50-brief" aria-label="Lectura rápida del expediente">
      <div class="a50-brief-head"><span class="a45-eyebrow">LECTURA RÁPIDA</span><h3>Qué mirar primero en este expediente</h3></div>
      <div class="a50-brief-grid">
        <div class="a50-brief-item"><span>Vigencia del dato</span><b>${freshness?esc(freshness):'sin fecha materializada'}</b><small>corte más reciente entre hallazgos, sanciones y perfil tributario</small></div>
        <div class="a50-brief-item"><span>Prioridad máxima</span><b>${maxScore==null?'—':maxScore.toFixed(1)}</b><small>IPA de investigar más alto; ordena revisión, no es probabilidad</small></div>
        <div class="a50-brief-item"><span>Evidencia vinculada</span><b>${fmt(findings.length)}</b><small>hallazgos con este Entity ID</small></div>
      </div>
      <div class="a50-brief-flags">${flags.map(([t,c])=>`<span class="${esc(c)}">${esc(t)}</span>`).join('')}</div>
    </section>`;
  }

  /* ---------------- estructura societaria y señales SII ---------------- */

  function dv(v){
    if(v==null||v==='')return null;
    const n=Number(v);
    return Number.isFinite(n)&&String(v).trim()!==''&&/^-?\d+(\.\d+)?$/.test(String(v).trim())?fmt(n):esc(v);
  }
  function structureCard(pkg){
    const tax=pkg?.tax||(Array.isArray(pkg?.taxRows)&&pkg.taxRows.length?pkg.taxRows[pkg.taxRows.length-1]:null);
    if(!tax)return'';
    const rows=[
      ['Sector económico',tax.economic_sector],
      ['Subsector',tax.economic_subsector],
      ['Aristas de propiedad (edges)',tax.ownership_edge_count],
      ['Socios personas jurídicas',tax.legal_entity_partner_count],
      ['Sociedades donde participa',tax.societies_as_partner_count],
      ['Señales estructurales SII',tax.signal_count]
    ].map(([k,v])=>[k,dv(v)]).filter(([,v])=>v!=null&&v!=='—');
    const signalTypes=arr(tax.signal_types);
    const addrTotal=num(tax.address_count),addrCurrent=num(tax.current_address_count);
    const addrDelta=(addrTotal!=null&&addrCurrent!=null)?addrTotal-addrCurrent:null;
    if(!rows.length&&!signalTypes.length&&addrDelta==null)return'';
    return `<article class="a45-card a50-structure" id="a50-structure-card">
      <h3>Estructura societaria y señales SII</h3>
      <p class="a45-note">Campos ya cargados en el perfil tributario que ninguna otra vista de este expediente mostraba. Más aristas societarias o señales estructurales no equivale a riesgo por sí solo: es complejidad a leer junto con el resto del expediente.</p>
      ${rows.length?`<dl class="a45-dl">${rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`:''}
      ${addrDelta!=null?`<p class="a45-note"><b>${fmt(addrCurrent)}</b> domicilio(s) vigente(s) de <b>${fmt(addrTotal)}</b> publicado(s) históricamente${addrDelta>0?` · ${fmt(addrDelta)} ya no vigente(s)`:''}.</p>`:''}
      ${signalTypes.length?`<div class="a45-roles">${signalTypes.slice(0,10).map(s=>`<span class="warn">${esc(s)}</span>`).join('')}</div>`:''}
    </article>`;
  }

  /* ---------------- entidades relacionadas navegables (Entity ID gobernado) ---------------- */

  function navigableRelations(pkg){
    const raw=arr(pkg?.e?.profile?.relaciones||pkg?.e?.profile?.relationships);
    const out=[],seen=new Set();
    for(const r of raw){
      if(!r||typeof r!=='object')continue;
      const id=r.target_entity_id||r.related_entity_id;
      if(!id||seen.has(String(id)))continue;
      seen.add(String(id));
      const name=r.target_name||r.related_entity_name||r.entity_name||r.target_label||String(id);
      out.push({id:String(id),name:String(name),type:r.relationship_type||r.relation_type||r.type||'RELACIÓN'});
    }
    return out.slice(0,12);
  }
  function navigablePanel(pkg){
    const rel=navigableRelations(pkg);
    if(!rel.length)return'';
    return `<article class="a45-card a50-navlinks" id="a50-navlinks-card">
      <h3>Entidades relacionadas con Entity ID propio</h3>
      <p class="a45-note">Sólo vínculos con identificador gobernado explícito; nunca por similitud de nombre. Abrir un expediente relacionado no transfiere puntaje ni conclusión entre entidades.</p>
      <div class="a50-navlist">${rel.map(r=>`<button type="button" data-a50-open="${esc(r.id)}"><b>${esc(short(r.name,34))}</b><span>${esc(r.type)}</span></button>`).join('')}</div>
    </article>`;
  }

  /* ---------------- expediente imprimible ---------------- */

  let printCleanupBound=false;
  function bindPrintCleanup(){
    if(printCleanupBound)return;
    printCleanupBound=true;
    window.addEventListener('afterprint',()=>{document.querySelector('.a45')?.classList.remove('a50-print-all');});
  }
  function addPrintButton(){
    const host=document.querySelector('.a45-command>div:last-child');
    if(!host||host.querySelector('#a50-print'))return;
    const btn=document.createElement('button');
    btn.type='button';btn.id='a50-print';btn.className='a45-btn ghost';btn.textContent='Imprimir expediente';
    btn.addEventListener('click',()=>{
      document.querySelector('.a45')?.classList.add('a50-print-all');
      window.print();
      setTimeout(()=>document.querySelector('.a45')?.classList.remove('a50-print-all'),600);
    });
    host.appendChild(btn);
  }

  /* ---------------- montaje / decoración ---------------- */

  function decorate(entityId,pkg){
    if(!entityId)return;
    const cover=document.querySelector('.a45-cover');
    if(cover){
      cover.parentElement?.querySelector('#a50-brief')?.remove();
      cover.insertAdjacentHTML('afterend',execSummaryHtml(pkg));
    }
    const charPanel=document.querySelector('[data-a45-panel="character"]');
    if(charPanel){
      charPanel.querySelector('#a50-structure-card')?.remove();
      const html=structureCard(pkg);
      if(html){
        const anchor=charPanel.querySelector('#a49-docauth-card')||charPanel.querySelector('.a45-grid.g12')||charPanel.querySelector('.a45-panel-head');
        anchor?.insertAdjacentHTML('afterend',html);
      }
    }
    const netPanel=document.querySelector('[data-a45-panel="network"]');
    if(netPanel){
      netPanel.querySelector('#a50-navlinks-card')?.remove();
      const html=navigablePanel(pkg);
      if(html){
        const anchor=netPanel.querySelector('.a45-caution')||netPanel.querySelector('.a45-panel-head');
        anchor?.insertAdjacentHTML('afterend',html);
      }
    }
    addPrintButton();
    mountBookmarks();
    window.__ATLAS_ENTITY360_COMMAND__={
      active:true,release:RELEASE,build:BUILD,authority:AUTHORITY,entityId,
      features:['brief','structure_signals','governed_relation_nav','bookmarks','keyboard_shortcuts','print_dossier'],
      renderedAt:new Date().toISOString()
    };
  }

  /* ---------------- atajos de teclado (buscar, cambiar lente) ---------------- */

  document.addEventListener('keydown',e=>{
    if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey)return;
    const tag=(document.activeElement?.tagName||'').toLowerCase();
    const typing=tag==='input'||tag==='textarea'||document.activeElement?.isContentEditable;
    if(e.key==='/'&&!typing){
      const input=document.querySelector('#a47-entity-q');
      if(input){e.preventDefault();input.focus();input.select?.();}
      return;
    }
    if(typing)return;
    if(/^[1-6]$/.test(e.key)){
      const buttons=document.querySelectorAll('.a45-lenses [data-a45-lens]');
      const btn=buttons[Number(e.key)-1];
      if(btn){e.preventDefault();btn.click();}
    }
  });

  /* ---------------- clic delegado: marcadores y navegación gobernada ---------------- */

  document.addEventListener('click',e=>{
    const pin=e.target.closest('[data-a50-pin]');
    if(pin){e.preventDefault();e.stopPropagation();togglePin(pin.dataset.a50Pin,pin.dataset.a50PinName,pin.dataset.a50PinRut);return;}
    const open=e.target.closest('[data-a50-open]');
    if(open&&typeof window.openEntity==='function'){e.preventDefault();window.openEntity(open.dataset.a50Open);}
  });

  bindPrintCleanup();

  /* ---------------- integración: landing (marcadores visibles sin entidad abierta) ---------------- */

  const ENTRY=window.__ATLAS_ENTITY_ENTRY__;
  if(ENTRY&&typeof ENTRY.load==='function'){
    const baseLoad=ENTRY.load;
    ENTRY.load=(...args)=>{
      const result=baseLoad(...args);
      setTimeout(mountBookmarks,0);
      setTimeout(mountBookmarks,300);
      return result;
    };
  }

  /* ---------------- integración: expediente abierto ---------------- */

  const baseRender=typeof window.v0203RenderEntity==='function'?window.v0203RenderEntity:null;
  if(baseRender){
    const render0500=function(pkg,...args){
      const result=baseRender(pkg,...args);
      const entityId=pkg?.e?.entity_id;
      if(entityId){
        remember({entity_id:entityId,name:pkg.e.name,rut:pkg.e.rut});
        for(const delay of [0,260,900,2200])setTimeout(()=>decorate(entityId,pkg),delay);
      }
      return result;
    };
    try{v0203RenderEntity=render0500;}catch(_error){}
    window.v0203RenderEntity=render0500;
  }

  window.AtlasEntityCommand={
    release:RELEASE,build:BUILD,authority:AUTHORITY,
    semantic:'ADDITIVE_DECORATION_ONLY_NO_SYNTHETIC_FACTS_NO_FUZZY_NAV'
  };
  window.__ATLAS_ENTITY360_COMMAND__={active:true,release:RELEASE,build:BUILD,authority:AUTHORITY,installedAt:new Date().toISOString()};
})();
