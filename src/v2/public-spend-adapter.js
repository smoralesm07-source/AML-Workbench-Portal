'use strict';

(function installAtlasV2PublicSpendAdapter(global) {
  const ACTIVE = global.__ATLAS_V2_PREVIEW_MODE__ === 'public-spend' || new URLSearchParams(location.search).get('atlasv2') === 'public-spend';
  if (!ACTIVE) return;

  const S = { tab: 'overview', monitor: null, search: '', offset: 0, limit: 40, result: null, detail: null, loading: false, error: null };
  let client = null;
  let searchTimer = null;
  const NF = new Intl.NumberFormat('es-CL');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const money = v => { const n=num(v),a=Math.abs(n); if(a>=1e12)return '$'+(n/1e12).toLocaleString('es-CL',{maximumFractionDigits:2})+' bill.'; if(a>=1e9)return '$'+(n/1e9).toLocaleString('es-CL',{maximumFractionDigits:1})+' mil M'; if(a>=1e6)return '$'+(n/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})+' M'; return '$'+NF.format(Math.round(n)); };
  const pct = v => Number.isFinite(Number(v)) ? (100*Number(v)).toLocaleString('es-CL',{maximumFractionDigits:1})+'%' : '—';

  function injectStyle() {
    if (document.getElementById('atlas-v2-public-spend-adapter-style')) return;
    const style=document.createElement('style');
    style.id='atlas-v2-public-spend-adapter-style';
    style.textContent=`
      .gpv2{display:grid;gap:14px;color:var(--text,#18222b)}
      .gpv2 *{box-sizing:border-box}.gpv2 button,.gpv2 input{font:inherit}
      .gpv2-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:22px;border:1px solid #dfe5e9;border-radius:16px;background:linear-gradient(135deg,#fff,#f7f9fa)}
      .gpv2-eyebrow{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#a44a0b}.gpv2 h2{margin:5px 0 7px;font-size:25px}.gpv2 p{margin:0;color:#5c6872}
      .gpv2-health{min-width:180px;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid #dfe5e9}.gpv2-health b,.gpv2-health span{display:block}.gpv2-health b{font-size:13px}.gpv2-health span{font-size:11px;color:#68747d;margin-top:3px}
      .gpv2-nav{display:flex;gap:8px;flex-wrap:wrap}.gpv2-nav button{border:1px solid #d7dfe4;background:#fff;border-radius:999px;padding:8px 13px;cursor:pointer}.gpv2-nav button.active{background:#1d2b34;color:#fff;border-color:#1d2b34}
      .gpv2-toolbar{display:flex;gap:8px;align-items:center}.gpv2-toolbar input{width:min(420px,100%);border:1px solid #ccd5db;border-radius:10px;padding:10px 12px;background:#fff}.gpv2-toolbar button{border:1px solid #ccd5db;background:#fff;border-radius:10px;padding:10px 12px;cursor:pointer}
      .gpv2-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.gpv2-kpi,.gpv2-card{background:#fff;border:1px solid #dfe5e9;border-radius:14px;padding:15px}.gpv2-kpi small,.gpv2-row small{display:block;color:#68747d}.gpv2-kpi b{display:block;font-size:22px;margin:5px 0}.gpv2-kpi span{font-size:11px;color:#68747d}
      .gpv2-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.gpv2-card h3{margin:0 0 10px;font-size:15px}.gpv2-list{display:grid;gap:7px}.gpv2-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;width:100%;text-align:left;border:0;border-top:1px solid #eef1f3;background:transparent;padding:10px 2px;cursor:pointer;color:inherit}.gpv2-row:first-child{border-top:0}.gpv2-row b{font-size:13px}.gpv2-row strong{font-size:13px;white-space:nowrap}.gpv2-row:hover{background:#fafbfc}
      .gpv2-domain{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;border-radius:999px;padding:5px 8px;background:#f0f3f5;color:#45535d}.gpv2-domain.live{background:#eef7f0;color:#2e6b3d}.gpv2-note{padding:11px 13px;border-left:3px solid #c76b26;background:#fff8f2;font-size:12px;color:#5f5147}.gpv2-empty,.gpv2-loading,.gpv2-error{padding:26px;text-align:center;border:1px dashed #ccd5db;border-radius:14px;background:#fff}.gpv2-error{color:#8a2f2f}
      .gpv2-pager{display:flex;justify-content:space-between;align-items:center;margin-top:10px}.gpv2-pager button{border:1px solid #ccd5db;background:#fff;border-radius:9px;padding:7px 10px;cursor:pointer}.gpv2-pager button:disabled{opacity:.45;cursor:default}
      .gpv2-drawer{position:fixed;z-index:9999;right:18px;top:18px;bottom:18px;width:min(520px,calc(100vw - 36px));overflow:auto;background:#fff;border:1px solid #d7dfe4;border-radius:16px;box-shadow:0 18px 55px rgba(0,0,0,.18);padding:20px}.gpv2-close{float:right;border:0;background:#eef1f3;border-radius:999px;width:34px;height:34px;cursor:pointer}.gpv2-detail-list{margin-top:12px;display:grid;gap:7px}
      @media(max-width:900px){.gpv2-kpis{grid-template-columns:1fr 1fr}.gpv2-grid{grid-template-columns:1fr}.gpv2-hero{display:block}.gpv2-health{margin-top:12px}.gpv2-toolbar{align-items:stretch}.gpv2-toolbar input{flex:1}}
    `;
    document.head.appendChild(style);
  }

  async function token() {
    if (typeof sb === 'undefined' || !sb?.auth?.getSession) return null;
    const { data, error }=await sb.auth.getSession();
    if (error) throw error;
    return data?.session?.access_token || null;
  }

  function api() {
    if (client) return client;
    if (!global.AtlasV2Data?.create) throw new Error('ATLAS v2 data client is unavailable');
    client=global.AtlasV2Data.create({ getAccessToken: token });
    return client;
  }

  function host(reset=false) {
    let content=document.querySelector('#content');
    if (!content && typeof global.shell === 'function') { global.shell('Gasto Público','Architecture v2 preview'); content=document.querySelector('#content'); }
    if (!content) return null;
    let h=content.querySelector('[data-gpv2-host]');
    if (!h || reset) { content.innerHTML='<section data-gpv2-host></section>'; h=content.querySelector('[data-gpv2-host]'); }
    return h;
  }

  function health(status, extra={}) {
    global.__ATLAS_V2_PUBLIC_SPEND_ADAPTER__={status,mode:'v2-preview',tab:S.tab,snapshot:S.monitor?.snapshotId||null,checkedAt:new Date().toISOString(),...extra};
  }

  function loading(message='Consultando read models v2…') { const h=host(true); if(h) h.innerHTML=`<div class="gpv2"><div class="gpv2-loading">${esc(message)}</div></div>`; health('loading'); }
  function errorView(error) { const h=host(true),msg=String(error?.message||error); if(h)h.innerHTML=`<div class="gpv2"><div class="gpv2-error"><b>No fue posible abrir el preview v2</b><p>${esc(msg)}</p><button data-gpv2-retry>Reintentar</button></div></div>`; h?.querySelector('[data-gpv2-retry]')?.addEventListener('click',()=>open(true)); health('error',{error:msg}); }

  function header() {
    const b=S.monitor?.data?.domains?.budget_execution || {}, q=b.quality || {}, availability=S.monitor?.data?.availability || {};
    return `<div class="gpv2-hero"><div><span class="gpv2-eyebrow">ATLAS · Architecture v2 preview</span><h2>Gasto Público</h2><p>Lectura preparada en backend · sin reconstrucción del universo en el navegador</p></div><div class="gpv2-health"><b>${q.detail_mode==='FULL_BACKEND'?'Backend listo':'Backend parcial'}</b><span>${esc(S.monitor?.snapshotId||'sin snapshot')}</span><span>${esc(S.monitor?.meta?.serverTiming||'')}</span></div></div>
    <div class="gpv2-nav">${[['overview','Resumen'],['services','Servicios'],['providers','Proveedores'],['relations','Relaciones']].map(([k,l])=>`<button data-gpv2-tab="${k}" class="${S.tab===k?'active':''}">${l}</button>`).join('')}</div>
    ${S.tab==='overview'?'':`<div class="gpv2-toolbar"><input id="gpv2-search" type="search" value="${esc(S.search)}" placeholder="Buscar en el backend…"><button data-gpv2-clear>Limpiar</button></div>`}
    <div class="gpv2-note">Dominios separados: <span class="gpv2-domain ${availability.budget_execution==='READY'?'live':''}">Ejecución presupuestaria</span> <span class="gpv2-domain ${availability.procurement==='READY'?'live':''}">Compras públicas</span>. No se suman ni homologan universos distintos.</div>`;
  }

  function topRow(row,kind) {
    if(kind==='service') {
      const id=row.organization_id||row.buyer_id||row.id||''; const name=row.organization_name||row.buyer_name||row.name||id;
      return `<button class="gpv2-row" data-gpv2-detail="service" data-key="${esc(id)}"><span><b>${esc(name)}</b><small>${esc(row.main_region||row.region||'Sin región')} · ${esc(row.dominant_subtitle||row.category||'')}</small></span><strong>${money(row.amount_l12??row.amount_clp)}</strong></button>`;
    }
    if(kind==='provider') {
      const id=row.provider_id||row.supplier_id||row.id||''; const name=row.provider_name||row.supplier_name||row.name||id;
      return `<button class="gpv2-row" data-gpv2-detail="provider" data-key="${esc(id)}"><span><b>${esc(name)}</b><small>${esc(row.rut||'')} ${row.variation_l12!=null?'· var. '+pct(row.variation_l12):''}</small></span><strong>${money(row.amount_l12??row.amount_clp)}</strong></button>`;
    }
    const sid=row.organization_id||row.buyer_id||'', pid=row.provider_id||row.supplier_id||'';
    return `<div class="gpv2-row"><span><b>${esc(row.organization_name||row.buyer_name||sid)}</b><small>→ ${esc(row.provider_name||row.supplier_name||pid)}</small></span><strong>${money(row.amount_l12??row.amount_clp)}</strong></div>`;
  }

  function overview() {
    const monitor=S.monitor?.data||{}, b=monitor.domains?.budget_execution||{}, p=monitor.domains?.procurement||{}, o=b.overview||{}, ps=p.summary||{};
    const cards=[
      ['Devengado visible L12',money(o.amount_l12_clp),`${NF.format(num(o.organizations_l12))} organismos`],
      ['Flujo a proveedores',money(o.provider_amount_l12_clp),`${NF.format(num(o.providers_l12))} proveedores`],
      ['Top 10 proveedores',pct(o.top10_provider_share),'concentración presupuestaria'],
      ['HHI proveedores',Number.isFinite(Number(o.provider_hhi))?Number(o.provider_hhi).toLocaleString('es-CL',{maximumFractionDigits:4}):'—','ejecución presupuestaria'],
    ];
    const services=Array.isArray(b.top_services)?b.top_services.slice(0,6):[], providers=Array.isArray(b.top_providers)?b.top_providers.slice(0,6):[];
    return `<div class="gpv2-kpis">${cards.map(x=>`<article class="gpv2-kpi"><small>${esc(x[0])}</small><b>${esc(x[1])}</b><span>${esc(x[2])}</span></article>`).join('')}</div>
      <div class="gpv2-grid"><section class="gpv2-card"><h3>Servicios con mayor ejecución</h3><div class="gpv2-list">${services.map(x=>topRow(x,'service')).join('')||'<div class="gpv2-empty">Sin ranking publicado.</div>'}</div></section>
      <section class="gpv2-card"><h3>Proveedores con mayor flujo</h3><div class="gpv2-list">${providers.map(x=>topRow(x,'provider')).join('')||'<div class="gpv2-empty">Sin ranking publicado.</div>'}</div></section></div>
      <section class="gpv2-card"><h3>Compras públicas · dominio paralelo</h3><div class="gpv2-kpis"><article class="gpv2-kpi"><small>Compradores</small><b>${NF.format(num(ps.buyer_count))}</b><span>ChileCompra</span></article><article class="gpv2-kpi"><small>Proveedores</small><b>${NF.format(num(ps.supplier_count))}</b><span>ChileCompra</span></article><article class="gpv2-kpi"><small>Pares</small><b>${NF.format(num(ps.pair_count))}</b><span>comprador–proveedor</span></article><article class="gpv2-kpi"><small>Monto</small><b>${money(ps.amount_total_clp)}</b><span>snapshot analítico</span></article></div></section>`;
  }

  async function loadTab() {
    if(S.tab==='overview'){S.result=null;return;}
    const query={search:S.search||undefined,offset:S.offset,limit:S.limit};
    const a=api();
    if(S.tab==='services')S.result=await a.publicSpend.budgetServices({query,route:'public-spend:v2-preview:services'});
    else if(S.tab==='providers')S.result=await a.publicSpend.budgetProviders({query,route:'public-spend:v2-preview:providers'});
    else S.result=await a.publicSpend.budgetFlows({query,route:'public-spend:v2-preview:flows'});
  }

  function list() {
    const kind=S.tab==='services'?'service':S.tab==='providers'?'provider':'flow', rows=S.result?.items||[], page=S.result?.page||{};
    return `<section class="gpv2-card"><h3>${S.tab==='services'?'Servicios públicos':S.tab==='providers'?'Proveedores':'Relaciones comprador–proveedor'}</h3><div class="gpv2-list">${rows.map(x=>topRow(x,kind)).join('')||'<div class="gpv2-empty">Sin resultados.</div>'}</div><div class="gpv2-pager"><button data-gpv2-page="prev" ${S.offset===0?'disabled':''}>← Anterior</button><span>${NF.format(S.offset+1)}–${NF.format(S.offset+rows.length)}</span><button data-gpv2-page="next" ${page.has_more?'':'disabled'}>Siguiente →</button></div></section>`;
  }

  function render() {
    const h=host(false); if(!h||!S.monitor)return;
    h.innerHTML=`<div class="gpv2">${header()}${S.tab==='overview'?overview():list()}${drawer()}</div>`;
    bind();
    health('ready',{detailMode:S.monitor?.data?.domains?.budget_execution?.quality?.detail_mode||null,returned:S.result?.items?.length||0});
  }

  function drawer() {
    if(!S.detail)return'';
    const d=S.detail.data||{}, entity=d.entity||{}, flows=Array.isArray(d.flows)?d.flows:[];
    const isService=S.detail.type==='service';
    const name=isService?(entity.organization_name||entity.buyer_name||entity.name||S.detail.key):(entity.provider_name||entity.supplier_name||entity.name||S.detail.key);
    return `<aside class="gpv2-drawer"><button class="gpv2-close" data-gpv2-close>×</button><span class="gpv2-eyebrow">Detalle servido por backend</span><h3>${esc(name)}</h3><p>${isService?esc(entity.main_region||entity.region||''):esc(entity.rut||'')}</p><div class="gpv2-kpi"><small>Monto L12</small><b>${money(entity.amount_l12??entity.amount_clp)}</b><span>snapshot ${esc(S.detail.snapshotId||'')}</span></div><h3 style="margin-top:18px">Relaciones visibles (${NF.format(flows.length)})</h3><div class="gpv2-detail-list">${flows.slice(0,100).map(x=>topRow(x,'flow')).join('')||'<div class="gpv2-empty">Sin relaciones visibles en este snapshot.</div>'}</div></aside>`;
  }

  async function showDetail(type,key) {
    try {
      const out=type==='service' ? await api().publicSpend.budgetServiceDetail(key,{route:'public-spend:v2-preview:service-detail'}) : await api().publicSpend.budgetProviderDetail(key,{route:'public-spend:v2-preview:provider-detail'});
      S.detail={type,key,data:out.detail||{},snapshotId:out.snapshotId}; render();
    } catch(e){console.warn('[ATLAS v2 adapter] detail failed',e);}
  }

  function bind() {
    const root=host(false); if(!root)return;
    root.querySelectorAll('[data-gpv2-tab]').forEach(b=>b.addEventListener('click',async()=>{S.tab=b.dataset.gpv2Tab;S.offset=0;S.detail=null;loading('Consultando '+S.tab+'…');try{await loadTab();render();}catch(e){errorView(e);}}));
    const q=root.querySelector('#gpv2-search'); q?.addEventListener('input',e=>{S.search=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(async()=>{S.offset=0;loading('Buscando en backend…');try{await loadTab();render();document.querySelector('#gpv2-search')?.focus();}catch(err){errorView(err);}},220);});
    root.querySelector('[data-gpv2-clear]')?.addEventListener('click',async()=>{S.search='';S.offset=0;loading();try{await loadTab();render();}catch(e){errorView(e);}});
    root.querySelectorAll('[data-gpv2-page]').forEach(b=>b.addEventListener('click',async()=>{S.offset=Math.max(0,S.offset+(b.dataset.gpv2Page==='next'?S.limit:-S.limit));loading();try{await loadTab();render();}catch(e){errorView(e);}}));
    root.querySelectorAll('[data-gpv2-detail]').forEach(b=>b.addEventListener('click',()=>showDetail(b.dataset.gpv2Detail,b.dataset.key)));
    root.querySelector('[data-gpv2-close]')?.addEventListener('click',()=>{S.detail=null;render();});
  }

  async function open(force=false) {
    if(S.loading)return false; S.loading=true; injectStyle(); loading();
    try {
      S.monitor=await api().publicSpend.monitor({force,route:'public-spend:v2-preview'});
      const q=S.monitor?.data?.domains?.budget_execution?.quality||{};
      if(q.detail_mode!=='FULL_BACKEND') throw new Error('El dominio presupuestario aún no está FULL_BACKEND. El corte v2 permanece bloqueado.');
      await loadTab(); render();
      global.dispatchEvent(new CustomEvent('atlas:v2-public-spend-adapter-ready',{detail:{snapshot:S.monitor.snapshotId,mode:'v2-preview'}}));
      return true;
    } catch(e){S.error=e;errorView(e);return false;} finally {S.loading=false;}
  }

  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if(!b)return;
    e.preventDefault(); e.stopImmediatePropagation();
    open().catch(errorView);
  },true);

  global.AtlasV2PublicSpendAdapter=Object.freeze({open,state:S,health:()=>global.__ATLAS_V2_PUBLIC_SPEND_ADAPTER__||null});
  health('installed');
})(window);
