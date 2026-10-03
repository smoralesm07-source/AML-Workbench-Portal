'use strict';
/* ATLAS AML · Huella municipal · Monitor Municipal Presupuesto Abierto
 * Integra relaciones proveedor–municipio sin convertir DTE observados en pagos.
 * Lee aml_v_municipal_public_footprint por RUT normalizado y decora GP13 + Entidad 360.
 */
(function atlasMunicipalFootprint1400(){
  const VERSION='MUNICIPAL-FOOTPRINT-1400.1';
  const VIEW='aml_v_municipal_public_footprint';
  const CACHE_TTL=5*60*1000;
  const cache=new Map();
  let gpInstalled=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  const clp=v=>{const n=num(v);return n==null?'—':`$${Math.round(n).toLocaleString('es-CL')}`;};
  const integer=v=>{const n=num(v);return n==null?'—':Math.round(n).toLocaleString('es-CL');};
  const rutKey=v=>String(v??'').toUpperCase().replace(/[^0-9K]/g,'');
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};

  function ensureStyle(){
    if(document.querySelector('link[data-atlas-municipal-footprint-style]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href='./assets/atlas-municipal-footprint-1400.css?v=1400-1';
    link.dataset.atlasMunicipalFootprintStyle='1';document.head.appendChild(link);
  }

  async function fetchRows(key){
    key=rutKey(key);if(key.length<2)return[];
    const hit=cache.get(key);if(hit&&Date.now()-hit.at<CACHE_TTL)return hit.rows;
    const client=db();if(!client)return[];
    const {data,error}=await client.from(VIEW)
      .select('provider_rut_key,provider_rut,provider_name,municipality_code,municipality_rut,municipality_name,region_name,period_year,net_dte_clp,document_count,coverage_status,relationship_label,semantics,refreshed_at')
      .eq('provider_rut_key',key)
      .order('period_year',{ascending:false})
      .order('net_dte_clp',{ascending:false})
      .limit(1600);
    if(error){console.warn('[Atlas Municipal Footprint]',error.message||error);return[];}
    const rows=data||[];cache.set(key,{at:Date.now(),rows});return rows;
  }

  function aggregate(rows){
    const map=new Map();
    for(const r of rows){
      const id=String(r.municipality_code||r.municipality_rut||r.municipality_name||'');
      if(!id)continue;
      let x=map.get(id);
      if(!x){x={id,name:r.municipality_name||'Municipalidad',rut:r.municipality_rut||'',region:r.region_name||'',amount:0,docs:0,years:[],partial:false,unknown:false};map.set(id,x);}
      x.amount+=Number(r.net_dte_clp||0);x.docs+=Number(r.document_count||0);
      x.years.push({year:Number(r.period_year),amount:Number(r.net_dte_clp||0),docs:Number(r.document_count||0),coverage:r.coverage_status||'unknown'});
      if(r.coverage_status==='partial_period'||r.coverage_status==='partial')x.partial=true;
      if(!r.coverage_status||r.coverage_status==='unknown')x.unknown=true;
    }
    return[...map.values()].sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount)||b.docs-a.docs);
  }

  function coverageBadge(g){
    if(g.partial)return'<span class="amf14-badge partial">corte parcial</span>';
    if(g.unknown)return'<span class="amf14-badge unknown">cobertura no determinada</span>';
    return'<span class="amf14-badge complete">cobertura completa</span>';
  }
  function yearChips(g){
    return g.years.sort((a,b)=>b.year-a.year).slice(0,5).map(y=>`<span class="amf14-year ${y.coverage==='partial_period'?'partial':''}" title="${esc(y.coverage==='partial_period'?'Año en curso · corte parcial':y.coverage==='complete'?'Cobertura completa':'Cobertura no determinada')}"><b>${y.year}</b> ${clp(y.amount)} · ${integer(y.docs)} DTE</span>`).join('');
  }

  function markup(rows,{compact=false}={}){
    const groups=aggregate(rows);if(!groups.length)return'';
    const total=groups.reduce((a,g)=>a+g.amount,0),docs=groups.reduce((a,g)=>a+g.docs,0);
    const provider=rows.find(r=>r.provider_name)?.provider_name||'Entidad';
    const limit=compact?8:12;
    return `<section class="amf14-panel ${compact?'compact':''}" data-amf14-panel>
      <header class="amf14-head">
        <div><span>HUELLA MUNICIPAL · PRESUPUESTO ABIERTO</span><h3>DTE municipales observados</h3><p>${esc(provider)} registra documentos tributarios asociados a municipalidades. <b>Esta señal no acredita pago efectivo.</b></p></div>
        <div class="amf14-source">Monitor Municipal</div>
      </header>
      <div class="amf14-kpis">
        <span><b>${integer(groups.length)}</b><small>municipios observados</small></span>
        <span><b>${integer(docs)}</b><small>DTE observados</small></span>
        <span><b>${clp(total)}</b><small>monto neto DTE</small></span>
      </div>
      <div class="amf14-list" data-amf14-list>
        ${groups.map((g,i)=>`<article class="amf14-row ${i>=limit?'amf14-more':''}">
          <div class="amf14-identity"><b>${esc(g.name)}</b><small>${[g.region,g.rut].filter(Boolean).map(esc).join(' · ')}</small>${coverageBadge(g)}</div>
          <div class="amf14-metrics"><b>${clp(g.amount)}</b><small>${integer(g.docs)} DTE · ${g.years.length} ${g.years.length===1?'año':'años'}</small></div>
          <div class="amf14-years">${yearChips(g)}</div>
        </article>`).join('')}
      </div>
      ${groups.length>limit?`<button type="button" class="amf14-toggle" data-amf14-toggle data-count="${groups.length-limit}">Ver ${groups.length-limit} municipios más</button>`:''}
      <footer><span>Lectura</span> Un DTE informa una relación documental proveedor–municipio; no debe interpretarse automáticamente como compra pagada o transferencia ejecutada. Los años en curso se muestran como corte parcial.</footer>
    </section>`;
  }

  function bindToggle(scope){
    const btn=scope?.querySelector?.('[data-amf14-toggle]');if(!btn)return;
    btn.onclick=()=>{const open=scope.classList.toggle('amf14-expanded');btn.textContent=open?'Ver menos':`Ver ${btn.dataset.count} municipios más`;};
  }

  function selectedSupplierKey(){
    try{
      const st=window.AtlasGastoPublico1300?.state?.()||{};
      const s=st.selectedSupplier??st.supplier??st.selectedSupplierKey??null;
      if(typeof s==='string'||typeof s==='number')return rutKey(s);
      return rutKey(s?.supplier_key||s?.supplierKey||s?.rut||s?.provider_rut||s?.key||'');
    }catch(_e){return'';}
  }

  async function decorateGp13(){
    const root=document.querySelector('.gp13-root');if(!root)return;
    const key=selectedSupplierKey();
    const previous=root.querySelector('[data-amf14-gp13]');
    if(!key){previous?.remove();return;}
    if(previous?.dataset.rutKey===key)return;
    const rows=await fetchRows(key);
    if(!rows.length){previous?.remove();return;}
    const host=root.querySelector('.gp13-profile')||root.querySelector('[data-gp13-profile]')||root;
    previous?.remove();
    const wrap=document.createElement('div');wrap.dataset.amf14Gp13='1';wrap.dataset.rutKey=key;wrap.innerHTML=markup(rows);
    host.appendChild(wrap);bindToggle(wrap);
  }

  function installGpHook(){
    const api=window.AtlasGastoPublico1300;if(!api||gpInstalled)return;
    gpInstalled=true;
    for(const name of ['open','render','setState']){
      const base=api[name];if(typeof base!=='function'||base.__amf14Wrapped)continue;
      const wrapped=function(...args){const out=base.apply(this,args);Promise.resolve(out).finally(()=>setTimeout(()=>void decorateGp13(),30));return out;};
      Object.defineProperty(wrapped,'__amf14Wrapped',{value:true});api[name]=wrapped;
    }
    setTimeout(()=>void decorateGp13(),50);
  }

  function entityRut(pkg){
    const e=pkg?.e||pkg?.entity||pkg?.data?.entity||pkg?.data||pkg||{};
    return e?.rut||e?.profile?.rut||pkg?.rut||'';
  }
  async function decorateEntity(pkg){
    const key=rutKey(entityRut(pkg));if(!key)return;
    const host=document.querySelector('#content');if(!host)return;
    const old=host.querySelector('[data-amf14-entity]');
    if(old?.dataset.rutKey===key)return;
    const rows=await fetchRows(key);
    if(!rows.length){old?.remove();return;}
    old?.remove();
    const wrap=document.createElement('div');wrap.dataset.amf14Entity='1';wrap.dataset.rutKey=key;wrap.innerHTML=markup(rows,{compact:true});
    const target=host.querySelector('.entity-dossier,.entity360,.v0203-entity,.entity-profile')||host;
    target.appendChild(wrap);bindToggle(wrap);
  }

  function installEntityHook(){
    const base=window.v0203RenderEntity;if(typeof base!=='function'||base.__amf14Wrapped)return;
    const wrapped=async function(...args){const out=await base.apply(this,args);setTimeout(()=>void decorateEntity(args[0]),30);return out;};
    Object.defineProperty(wrapped,'__amf14Wrapped',{value:true});Object.defineProperty(wrapped,'__amf14Base',{value:base});
    window.v0203RenderEntity=wrapped;
  }

  function refresh(){installGpHook();installEntityHook();void decorateGp13();}
  ensureStyle();
  window.addEventListener('click',e=>{if(e.target?.closest?.('.gp13-root'))setTimeout(refresh,40);},true);
  ['atlas:public-spend-gp13-ready','atlas:nav-refresh','pageshow'].forEach(evt=>window.addEventListener(evt,()=>setTimeout(refresh,30)));
  [0,250,800,1800,4000,8000].forEach(ms=>setTimeout(refresh,ms));
  setInterval(()=>{if(document.querySelector('.gp13-root'))refresh();else installEntityHook();},1800);
  window.AtlasMunicipalFootprint1400={version:VERSION,fetchRows,decorateGp13,decorateEntity,refresh,clearCache:()=>cache.clear()};
  window.__ATLAS_MUNICIPAL_FOOTPRINT_1400__={active:true,version:VERSION,semantics:'DTE observado; no acredita pago efectivo',installedAt:new Date().toISOString()};
})();
