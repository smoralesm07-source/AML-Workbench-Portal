'use strict';
/* ATLAS · Territorio · SO comunales 0.91.8
 * Sustituye visualmente Evolución metodológica y Trazabilidad metodológica por
 * cobertura registral de sujetos obligados de la comuna seleccionada.
 */
(function atlasTerritorySo0918(){
  if(window.AtlasTerritorySO0918)return;
  let renderToken=0,bridgePromise=null;
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>Number(v||0).toLocaleString('es-CL');

  function currentSelection(){
    try{return typeof selected!=='undefined'?selected:null;}catch(_e){return null;}
  }

  function ensureLayout(){
    const grid=document.querySelector('.governance-grid');
    if(!grid)return null;
    grid.classList.add('so-register-grid');

    const roadmap=document.getElementById('roadmap');
    const trace=document.getElementById('trace');
    if(roadmap){roadmap.hidden=true;roadmap.setAttribute('aria-hidden','true');}
    if(trace){trace.hidden=true;trace.setAttribute('aria-hidden','true');}

    let panel=document.getElementById('subjects');
    if(!panel){
      panel=document.createElement('div');
      panel.id='subjects';
      panel.className='card panel so-register-panel';
      const ranking=document.getElementById('ranking');
      grid.insertBefore(panel,ranking||null);
    }

    const label=grid.previousElementSibling;
    if(label?.classList?.contains('section-label')){
      const title=label.querySelector('span'),sub=label.querySelector('small');
      if(title)title.textContent='SUJETOS OBLIGADOS EN EL TERRITORIO';
      if(sub)sub.textContent='Cobertura registral de la comuna seleccionada y sectores económicos involucrados';
    }
    return panel;
  }

  function ensureBridge(){
    try{if(window.parent?.AtlasTerritorySOBridge)return Promise.resolve(window.parent.AtlasTerritorySOBridge);}catch(_e){}
    if(bridgePromise)return bridgePromise;
    bridgePromise=new Promise((resolve,reject)=>{
      let parentWindow,parentDocument;
      try{parentWindow=window.parent;parentDocument=parentWindow.document;}catch(_e){reject(new Error('No fue posible acceder a la sesión principal de ATLAS.'));return;}
      if(parentWindow===window){reject(new Error('La cobertura SO se habilita al abrir Territorio desde ATLAS.'));return;}
      const existing=parentDocument.querySelector('script[data-atlas-territory-so-bridge]');
      const finish=()=>{
        if(parentWindow.AtlasTerritorySOBridge)resolve(parentWindow.AtlasTerritorySOBridge);
        else reject(new Error('El puente de datos territoriales no quedó disponible.'));
      };
      if(existing){
        if(parentWindow.AtlasTerritorySOBridge){finish();return;}
        existing.addEventListener('load',finish,{once:true});
        existing.addEventListener('error',()=>reject(new Error('No fue posible cargar el puente de datos SO.')),{once:true});
        setTimeout(()=>{if(parentWindow.AtlasTerritorySOBridge)resolve(parentWindow.AtlasTerritorySOBridge);},600);
        return;
      }
      const script=parentDocument.createElement('script');
      script.src='./assets/atlas-territory-so-bridge-0918.js?v=0918-2';
      script.dataset.atlasTerritorySoBridge='1';
      script.addEventListener('load',finish,{once:true});
      script.addEventListener('error',()=>reject(new Error('No fue posible cargar el puente de datos SO.')),{once:true});
      parentDocument.body.appendChild(script);
    }).catch(error=>{bridgePromise=null;throw error;});
    return bridgePromise;
  }

  function sectorRows(sectors,total){
    if(!sectors.length)return '<div class="so-empty">No se observan sujetos obligados registrados en el padrón UAF para esta comuna.</div>';
    return `<div class="so-sector-list">${sectors.map(row=>{
      const pct=total>0?100*Number(row.count||0)/total:0;
      return `<div class="so-sector-row"><div><b>${safe(row.sector)}</b><div class="so-sector-bar" aria-hidden="true"><i style="width:${Math.max(2,Math.min(100,pct)).toFixed(1)}%"></i></div></div><strong>${fmt(row.count)}</strong></div>`;
    }).join('')}</div>`;
  }

  async function renderSubjects(r){
    const panel=ensureLayout();
    if(!panel||!r)return;
    const token=++renderToken;
    panel.innerHTML=`<div class="so-register-head"><div><div class="kicker">COBERTURA REGISTRAL UAF</div><h3>Sujetos obligados · ${safe(r.commune_name)}</h3></div><span class="so-neutral-badge">SIN CLASIFICACIÓN DE RIESGO</span></div><div class="loading"><b>Consultando padrón UAF…</b></div>`;
    try{
      const bridge=await ensureBridge();
      const data=await bridge.commune(r.commune_name);
      if(token!==renderToken)return;
      panel.innerHTML=`<div class="so-register-head"><div><div class="kicker">COBERTURA REGISTRAL UAF</div><h3>Sujetos obligados · ${safe(r.commune_name)}</h3></div><span class="so-neutral-badge">SIN CLASIFICACIÓN DE RIESGO</span></div>
        <div class="so-kpis"><div><span>SO en la comuna</span><b>${fmt(data.total)}</b></div><div><span>Sectores involucrados</span><b>${fmt(data.sectorCount)}</b></div></div>
        <div class="so-register-subtitle">Sectores económicos presentes en el padrón UAF</div>
        ${sectorRows(data.sectors,data.total)}
        <div class="so-register-note">Lectura exclusivamente registral: muestra cantidad de SO y distribución sectorial observada en la comuna. Estos datos no modifican el IGR ni asignan riesgo a sectores o entidades.</div>`;
    }catch(error){
      if(token!==renderToken)return;
      panel.innerHTML=`<div class="so-register-head"><div><div class="kicker">COBERTURA REGISTRAL UAF</div><h3>Sujetos obligados · ${safe(r.commune_name)}</h3></div><span class="so-neutral-badge">SIN CLASIFICACIÓN DE RIESGO</span></div><div class="warn">No fue posible consultar el padrón UAF: ${safe(error?.message||error)}</div>`;
    }
  }

  function install(){
    ensureLayout();
    try{
      if(typeof renderDetail==='function'&&!renderDetail.__atlasSo0918){
        const base=renderDetail;
        const wrapped=function(){const out=base.apply(this,arguments);const r=currentSelection();if(r)void renderSubjects(r);return out;};
        wrapped.__atlasSo0918=true;
        renderDetail=wrapped;
      }
    }catch(error){console.warn('[ATLAS Territorio SO] no fue posible envolver renderDetail',error);}
    const r=currentSelection();
    if(r)void renderSubjects(r);
  }

  window.AtlasTerritorySO0918={active:true,version:'0.91.8',render:renderSubjects,install};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  setTimeout(install,250);
  setTimeout(()=>{const r=currentSelection();if(r)void renderSubjects(r);},1200);
})();