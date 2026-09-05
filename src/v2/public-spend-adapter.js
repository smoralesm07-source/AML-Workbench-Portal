'use strict';

(function installAtlasV2PublicSpendAdapter(global) {
  const ACTIVE = global.__ATLAS_V2_PREVIEW_MODE__ === 'public-spend' || new URLSearchParams(location.search).get('atlasv2') === 'public-spend';
  if (!ACTIVE) return;

  const EMPTY_FILTERS = () => ({ region: '', category: '', month: '', serviceId: '', providerId: '' });
  const S = {
    tab: 'overview',
    monitor: null,
    context: null,
    filters: EMPTY_FILTERS(),
    search: '',
    offset: 0,
    limit: 40,
    result: null,
    detail: null,
    loading: false,
    error: null,
  };

  let client = null;
  let searchTimer = null;
  let contextSerial = 0;
  const NF = new Intl.NumberFormat('es-CL');
  const REGION_LABELS = Object.freeze({
    '01': 'Tarapacá', '1': 'Tarapacá',
    '02': 'Antofagasta', '2': 'Antofagasta',
    '03': 'Atacama', '3': 'Atacama',
    '04': 'Coquimbo', '4': 'Coquimbo',
    '05': 'Valparaíso', '5': 'Valparaíso',
    '06': "O'Higgins", '6': "O'Higgins",
    '07': 'Maule', '7': 'Maule',
    '08': 'Biobío', '8': 'Biobío',
    '09': 'La Araucanía', '9': 'La Araucanía',
    '10': 'Los Lagos', '11': 'Aysén', '12': 'Magallanes',
    '13': 'Metropolitana', '14': 'Los Ríos', '15': 'Arica y Parinacota', '16': 'Ñuble',
  });

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = value => {
    const n = num(value), a = Math.abs(n);
    if (a >= 1e12) return '$' + (n / 1e12).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + ' bill.';
    if (a >= 1e9) return '$' + (n / 1e9).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' mil M';
    if (a >= 1e6) return '$' + (n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' M';
    return '$' + NF.format(Math.round(n));
  };
  const pct = value => Number.isFinite(Number(value)) ? (100 * Number(value)).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + '%' : '—';
  const regionLabel = value => REGION_LABELS[String(value || '')] || String(value || 'Sin región');
  const activeFilterCount = () => Object.values(S.filters).filter(Boolean).length;

  function injectStyle() {
    if (document.getElementById('atlas-v2-public-spend-adapter-style')) return;
    const style = document.createElement('style');
    style.id = 'atlas-v2-public-spend-adapter-style';
    style.textContent = `
      .gpv2{display:grid;gap:14px;color:var(--text,#18222b)}
      .gpv2 *{box-sizing:border-box}.gpv2 button,.gpv2 input,.gpv2 select{font:inherit}
      .gpv2-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:22px;border:1px solid #dfe5e9;border-radius:16px;background:linear-gradient(135deg,#fff,#f7f9fa)}
      .gpv2-eyebrow{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#a44a0b}.gpv2 h2{margin:5px 0 7px;font-size:25px}.gpv2 p{margin:0;color:#5c6872}
      .gpv2-health{min-width:220px;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid #dfe5e9}.gpv2-health b,.gpv2-health span{display:block}.gpv2-health b{font-size:13px}.gpv2-health span{font-size:11px;color:#68747d;margin-top:3px}
      .gpv2-nav{display:flex;gap:8px;flex-wrap:wrap}.gpv2-nav button{border:1px solid #d7dfe4;background:#fff;border-radius:999px;padding:8px 13px;cursor:pointer}.gpv2-nav button.active{background:#1d2b34;color:#fff;border-color:#1d2b34}
      .gpv2-filters{display:grid;grid-template-columns:1fr 1.35fr 1fr auto;gap:10px;align-items:end;padding:14px;border:1px solid #dfe5e9;border-radius:14px;background:#fff}
      .gpv2-filter label{display:block;font-size:11px;font-weight:750;color:#65717a;margin:0 0 5px}.gpv2-filter select{width:100%;border:1px solid #ccd5db;border-radius:10px;padding:9px 10px;background:#fff;color:#26343d}
      .gpv2-filter-actions{display:flex;gap:7px;align-items:center}.gpv2-filter-actions button,.gpv2-toolbar button,.gpv2-mini{border:1px solid #ccd5db;background:#fff;border-radius:9px;padding:8px 10px;cursor:pointer}.gpv2-filter-actions button:disabled{opacity:.45;cursor:default}
      .gpv2-focus{display:flex;gap:8px;flex-wrap:wrap}.gpv2-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #ead5c4;background:#fff8f2;border-radius:999px;padding:6px 9px;font-size:11px}.gpv2-chip button{border:0;background:transparent;cursor:pointer;font-weight:800}
      .gpv2-toolbar{display:flex;gap:8px;align-items:center}.gpv2-toolbar input{width:min(420px,100%);border:1px solid #ccd5db;border-radius:10px;padding:10px 12px;background:#fff}
      .gpv2-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.gpv2-kpi,.gpv2-card{background:#fff;border:1px solid #dfe5e9;border-radius:14px;padding:15px}.gpv2-kpi small,.gpv2-row small{display:block;color:#68747d}.gpv2-kpi b{display:block;font-size:22px;margin:5px 0}.gpv2-kpi span{font-size:11px;color:#68747d}
      .gpv2-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.gpv2-card h3{margin:0 0 10px;font-size:15px}.gpv2-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}.gpv2-card-head small{color:#68747d}
      .gpv2-list{display:grid;gap:7px}.gpv2-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;width:100%;text-align:left;border:0;border-top:1px solid #eef1f3;background:transparent;padding:10px 2px;color:inherit}.gpv2-row:first-child{border-top:0}.gpv2-row b{font-size:13px}.gpv2-row strong{font-size:13px;white-space:nowrap}.gpv2-row-actions{display:flex;gap:5px;justify-content:flex-start;margin-top:5px}.gpv2-row-actions button{border:1px solid #d9e0e4;background:#fff;border-radius:8px;padding:4px 7px;font-size:10px;cursor:pointer}
      .gpv2-domain{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;border-radius:999px;padding:5px 8px;background:#f0f3f5;color:#45535d}.gpv2-domain.live{background:#eef7f0;color:#2e6b3d}.gpv2-note{padding:11px 13px;border-left:3px solid #c76b26;background:#fff8f2;font-size:12px;color:#5f5147}.gpv2-note strong{color:#2c3941}
      .gpv2-empty,.gpv2-loading,.gpv2-error{padding:26px;text-align:center;border:1px dashed #ccd5db;border-radius:14px;background:#fff}.gpv2-error{color:#8a2f2f}
      .gpv2-pager{display:flex;justify-content:space-between;align-items:center;margin-top:10px}.gpv2-pager button{border:1px solid #ccd5db;background:#fff;border-radius:9px;padding:7px 10px;cursor:pointer}.gpv2-pager button:disabled{opacity:.45;cursor:default}
      .gpv2-trend{height:190px;display:flex;align-items:flex-end;gap:8px;padding:12px 4px 0;border-top:1px solid #eef1f3}.gpv2-trend-col{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:5px}.gpv2-barbox{height:145px;width:100%;display:flex;align-items:flex-end;justify-content:center}.gpv2-bar{width:min(24px,72%);min-height:2px;border-radius:7px 7px 2px 2px;background:#c76b26}.gpv2-trend-col span{font-size:9px;color:#73808a;white-space:nowrap}.gpv2-trend-col b{font-size:9px;font-weight:650;color:#45535d;white-space:nowrap}
      .gpv2-relation{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;border-top:1px solid #eef1f3;padding:9px 2px}.gpv2-relation:first-child{border-top:0}.gpv2-relation small{display:block;color:#68747d}.gpv2-relation strong{white-space:nowrap;font-size:12px}
      .gpv2-drawer{position:fixed;z-index:9999;right:18px;top:18px;bottom:18px;width:min(520px,calc(100vw - 36px));overflow:auto;background:#fff;border:1px solid #d7dfe4;border-radius:16px;box-shadow:0 18px 55px rgba(0,0,0,.18);padding:20px}.gpv2-close{float:right;border:0;background:#eef1f3;border-radius:999px;width:34px;height:34px;cursor:pointer}.gpv2-detail-list{margin-top:12px;display:grid;gap:7px}.gpv2-detail-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.gpv2-detail-actions button{border:1px solid #ccd5db;background:#fff;border-radius:9px;padding:8px 10px;cursor:pointer}
      .gpv2-method{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.gpv2-method code{display:block;margin-top:9px;padding:9px 10px;border-radius:9px;background:#f4f6f7;color:#394750;font-size:11px;white-space:normal}.gpv2-method p{font-size:12px;line-height:1.55}
      @media(max-width:1000px){.gpv2-filters{grid-template-columns:1fr 1fr}.gpv2-filter-actions{align-self:end}}
      @media(max-width:900px){.gpv2-kpis{grid-template-columns:1fr 1fr}.gpv2-grid,.gpv2-method{grid-template-columns:1fr}.gpv2-hero{display:block}.gpv2-health{margin-top:12px}.gpv2-toolbar{align-items:stretch}.gpv2-toolbar input{flex:1}}
      @media(max-width:620px){.gpv2-filters{grid-template-columns:1fr}.gpv2-kpis{grid-template-columns:1fr}.gpv2-trend{gap:3px}.gpv2-trend-col b{display:none}}
    `;
    document.head.appendChild(style);
  }

  async function token() {
    if (typeof sb === 'undefined' || !sb?.auth?.getSession) return null;
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data?.session?.access_token || null;
  }

  function api() {
    if (client) return client;
    if (!global.AtlasV2Data?.create) throw new Error('ATLAS v2 data client is unavailable');
    client = global.AtlasV2Data.create({ getAccessToken: token });
    return client;
  }

  function host(reset = false) {
    let content = document.querySelector('#content');
    if (!content && typeof global.shell === 'function') {
      global.shell('Gasto Público', 'Architecture v2 preview');
      content = document.querySelector('#content');
    }
    if (!content) return null;
    let h = content.querySelector('[data-gpv2-host]');
    if (!h || reset) {
      content.innerHTML = '<section data-gpv2-host></section>';
      h = content.querySelector('[data-gpv2-host]');
    }
    return h;
  }

  function health(status, extra = {}) {
    global.__ATLAS_V2_PUBLIC_SPEND_ADAPTER__ = {
      status,
      mode: 'v2-preview',
      tab: S.tab,
      snapshot: S.monitor?.snapshotId || null,
      budgetSnapshot: S.context?.snapshotId || null,
      filters: { ...S.filters },
      checkedAt: new Date().toISOString(),
      ...extra,
    };
  }

  function loading(message = 'Consultando read models v2…') {
    const h = host(true);
    if (h) h.innerHTML = `<div class="gpv2"><div class="gpv2-loading">${esc(message)}</div></div>`;
    health('loading');
  }

  function errorView(error) {
    const h = host(true), msg = String(error?.message || error);
    if (h) h.innerHTML = `<div class="gpv2"><div class="gpv2-error"><b>No fue posible abrir el preview v2</b><p>${esc(msg)}</p><button data-gpv2-retry>Reintentar</button></div></div>`;
    h?.querySelector('[data-gpv2-retry]')?.addEventListener('click', () => open(true));
    health('error', { error: msg, traceId: error?.traceId || null });
  }

  function facetOptions(values, selected) {
    const out = Array.isArray(values) ? values.slice() : [];
    if (selected && !out.some(value => String(value) === String(selected))) out.unshift(selected);
    return out;
  }

  function selectOptions(values, selected, formatter = value => value) {
    return facetOptions(values, selected).map(value => `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(formatter(value))}</option>`).join('');
  }

  function filterPanel() {
    const options = S.context?.data?.options || {};
    const count = activeFilterCount();
    const focus = [];
    if (S.filters.serviceId) focus.push(`<span class="gpv2-chip">Servicio: ${esc(S.filters.serviceId)} <button data-gpv2-clear-focus="serviceId" aria-label="Quitar servicio">×</button></span>`);
    if (S.filters.providerId) focus.push(`<span class="gpv2-chip">Proveedor: ${esc(S.filters.providerId)} <button data-gpv2-clear-focus="providerId" aria-label="Quitar proveedor">×</button></span>`);
    return `<div class="gpv2-filters" data-gpv2-context-filters>
      <div class="gpv2-filter"><label>Región</label><select data-gpv2-filter="region"><option value="">Todas</option>${selectOptions(options.regions, S.filters.region, regionLabel)}</select></div>
      <div class="gpv2-filter"><label>Clasificador</label><select data-gpv2-filter="category"><option value="">Todos</option>${selectOptions(options.categories, S.filters.category)}</select></div>
      <div class="gpv2-filter"><label>Período</label><select data-gpv2-filter="month"><option value="">Últimos 12 meses</option>${selectOptions(options.months, S.filters.month)}</select></div>
      <div class="gpv2-filter-actions"><button data-gpv2-reset-filters ${count ? '' : 'disabled'}>Limpiar ${count ? '(' + count + ')' : ''}</button></div>
    </div>${focus.length ? `<div class="gpv2-focus">${focus.join('')}</div>` : ''}`;
  }

  function header() {
    const b = S.monitor?.data?.domains?.budget_execution || {};
    const q = b.quality || {};
    const availability = S.monitor?.data?.availability || {};
    const contextTiming = S.context?.meta?.serverTiming || '';
    const tabs = [['overview', 'Resumen'], ['services', 'Servicios'], ['providers', 'Proveedores'], ['relations', 'Relaciones'], ['method', 'Metodología']];
    return `<div class="gpv2-hero"><div><span class="gpv2-eyebrow">ATLAS · Architecture v2 preview</span><h2>Gasto Público</h2><p>Contexto analítico preparado en backend · filtros sincronizados · sin reconstrucción masiva en el navegador</p></div><div class="gpv2-health"><b>${q.detail_mode === 'FULL_BACKEND' ? 'Backend listo' : 'Backend parcial'}</b><span>Monitor ${esc(S.monitor?.snapshotId || 'sin snapshot')}</span><span>Presupuesto ${esc(S.context?.snapshotId || 'sin snapshot')}</span><span>${esc(contextTiming)}</span></div></div>
      <div class="gpv2-nav">${tabs.map(([k, l]) => `<button data-gpv2-tab="${k}" class="${S.tab === k ? 'active' : ''}">${l}</button>`).join('')}</div>
      ${filterPanel()}
      ${S.tab === 'overview' || S.tab === 'method' ? '' : `<div class="gpv2-toolbar"><input id="gpv2-search" type="search" value="${esc(S.search)}" placeholder="Buscar dentro del contexto activo…"><button data-gpv2-clear>Limpiar búsqueda</button></div>`}
      <div class="gpv2-note"><strong>Contexto único:</strong> <span class="gpv2-domain ${availability.budget_execution === 'READY' ? 'live' : ''}">Ejecución presupuestaria</span> <span class="gpv2-domain ${availability.procurement === 'READY' ? 'live' : ''}">Compras públicas</span>. Región, clasificador, período, servicio y proveedor gobiernan Resumen y exploración. ChileCompra se mantiene como dominio paralelo para evitar mezclar definiciones.</div>`;
  }

  function rowAmount(row) {
    return row?._context_amount ?? row?.context_amount ?? row?.amount_l12 ?? row?.amount_clp ?? 0;
  }

  function topRow(row, kind, contextual = false) {
    if (kind === 'service') {
      const id = row.organization_id || row.buyer_id || row.id || '';
      const name = row.organization_name || row.buyer_name || row.name || id;
      const relations = row._context_provider_count ?? row.provider_count;
      return `<div class="gpv2-row"><span><b>${esc(name)}</b><small>${esc(regionLabel(row.main_region || row.region))} · ${esc(row.dominant_subtitle || row.category || '')}${relations != null ? ' · ' + NF.format(num(relations)) + ' proveedores' : ''}</small>${contextual ? `<div class="gpv2-row-actions"><button data-gpv2-focus-service="${esc(id)}">Fijar contexto</button><button data-gpv2-detail="service" data-key="${esc(id)}">Detalle</button></div>` : `<div class="gpv2-row-actions"><button data-gpv2-detail="service" data-key="${esc(id)}">Detalle</button></div>`}</span><strong>${money(rowAmount(row))}</strong></div>`;
    }
    if (kind === 'provider') {
      const id = row.provider_id || row.supplier_id || row.id || '';
      const name = row.provider_name || row.supplier_name || row.name || id;
      const relations = row._context_service_count ?? row.service_count;
      return `<div class="gpv2-row"><span><b>${esc(name)}</b><small>${esc(row.rut || '')}${relations != null ? ' · ' + NF.format(num(relations)) + ' servicios' : ''}</small>${contextual ? `<div class="gpv2-row-actions"><button data-gpv2-focus-provider="${esc(id)}">Fijar contexto</button><button data-gpv2-detail="provider" data-key="${esc(id)}">Detalle</button></div>` : `<div class="gpv2-row-actions"><button data-gpv2-detail="provider" data-key="${esc(id)}">Detalle</button></div>`}</span><strong>${money(rowAmount(row))}</strong></div>`;
    }
    const sid = row.organization_id || row.buyer_id || '';
    const pid = row.provider_id || row.supplier_id || '';
    return `<div class="gpv2-relation"><span><b>${esc(row.organization_name || row.buyer_name || sid)}</b><small>→ ${esc(row.provider_name || row.supplier_name || pid)}</small></span><strong>${money(rowAmount(row))}</strong></div>`;
  }

  function trendChart(rows) {
    const data = Array.isArray(rows) ? rows : [];
    if (!data.length) return '<div class="gpv2-empty">Sin serie temporal para el contexto.</div>';
    const max = Math.max(...data.map(row => num(row.amount_clp)), 1);
    return `<div class="gpv2-trend">${data.map(row => {
      const value = num(row.amount_clp);
      const height = Math.max(2, Math.round((value / max) * 100));
      const shortMonth = String(row.period || '').slice(5);
      return `<div class="gpv2-trend-col" title="${esc(row.period)} · ${esc(money(value))}"><div class="gpv2-barbox"><div class="gpv2-bar" style="height:${height}%"></div></div><b>${esc(money(value))}</b><span>${esc(shortMonth)}</span></div>`;
    }).join('')}</div>`;
  }

  function contextSummary() {
    const ctx = S.context?.data || {};
    const m = ctx.metrics || {};
    const cards = [
      ['Ejecución visible', money(m.service_amount_total), `${NF.format(num(m.service_count))} servicios`],
      ['Flujo a proveedores', money(m.provider_flow_total), `${NF.format(num(m.provider_count))} proveedores materializados`],
      ['Relaciones', NF.format(num(m.relation_count)), 'servicio–proveedor'],
      ['Top 10 proveedores', pct(m.top10_provider_share), 'concentración del contexto'],
      ['HHI proveedores', Number.isFinite(Number(m.provider_hhi)) ? Number(m.provider_hhi).toLocaleString('es-CL', { maximumFractionDigits: 4 }) : '—', 'concentración del contexto'],
      ['Filtros activos', NF.format(activeFilterCount()), S.filters.month || 'L12 completo'],
    ];
    const services = Array.isArray(ctx.top_services) ? ctx.top_services : [];
    const providers = Array.isArray(ctx.top_providers) ? ctx.top_providers : [];
    const relations = Array.isArray(ctx.top_relations) ? ctx.top_relations : [];
    return `<div class="gpv2-kpis">${cards.map(x => `<article class="gpv2-kpi"><small>${esc(x[0])}</small><b>${esc(x[1])}</b><span>${esc(x[2])}</span></article>`).join('')}</div>
      <section class="gpv2-card"><div class="gpv2-card-head"><div><h3>Tendencia sincronizada</h3><small>La serie, KPIs y rankings provienen del mismo budget_context.</small></div><span class="gpv2-domain live">${esc(ctx.filters?.month || 'L12')}</span></div>${trendChart(ctx.trend)}</section>
      <div class="gpv2-grid"><section class="gpv2-card"><div class="gpv2-card-head"><div><h3>Servicios con mayor ejecución</h3><small>Top contextual · ${NF.format(services.length)} visibles</small></div></div><div class="gpv2-list">${services.map(x => topRow(x, 'service', true)).join('') || '<div class="gpv2-empty">Sin servicios para este contexto.</div>'}</div></section>
      <section class="gpv2-card"><div class="gpv2-card-head"><div><h3>Proveedores con mayor flujo</h3><small>Top contextual · ${NF.format(providers.length)} visibles</small></div></div><div class="gpv2-list">${providers.map(x => topRow(x, 'provider', true)).join('') || '<div class="gpv2-empty">Sin proveedores para este contexto.</div>'}</div></section></div>
      <section class="gpv2-card"><div class="gpv2-card-head"><div><h3>Relaciones dominantes del contexto</h3><small>Top ${NF.format(relations.length)} · backend</small></div></div><div class="gpv2-list">${relations.map(x => topRow(x, 'flow', true)).join('') || '<div class="gpv2-empty">Sin relaciones visibles para este contexto.</div>'}</div></section>`;
  }

  function procurementParallel() {
    const p = S.monitor?.data?.domains?.procurement || {};
    const ps = p.summary || {};
    return `<section class="gpv2-card"><div class="gpv2-card-head"><div><h3>Compras públicas · dominio paralelo</h3><small>ChileCompra permanece separado de Presupuesto Abierto.</small></div></div><div class="gpv2-kpis"><article class="gpv2-kpi"><small>Compradores</small><b>${NF.format(num(ps.buyer_count))}</b><span>ChileCompra</span></article><article class="gpv2-kpi"><small>Proveedores</small><b>${NF.format(num(ps.supplier_count))}</b><span>ChileCompra</span></article><article class="gpv2-kpi"><small>Pares</small><b>${NF.format(num(ps.pair_count))}</b><span>comprador–proveedor</span></article><article class="gpv2-kpi"><small>Monto</small><b>${money(ps.amount_total_clp)}</b><span>snapshot analítico</span></article></div></section>`;
  }

  function overview() {
    return `${contextSummary()}${procurementParallel()}`;
  }

  function methodology() {
    return `<div class="gpv2-method" data-gpv2-methodology>
      <section class="gpv2-card"><h3>Contexto analítico único</h3><p>Todos los KPIs, la serie temporal, rankings y pestañas de exploración usan el mismo foco activo: período, región, clasificador, servicio y proveedor.</p><code>Contexto = período × región × clasificador × servicio × proveedor</code></section>
      <section class="gpv2-card"><h3>Ejecución vs. flujo</h3><p>La ejecución visible de servicios y el flujo materializado a proveedores son medidas distintas. ATLAS no rellena diferencias ni atribuye a proveedores montos que no estén presentes en las relaciones publicadas.</p><code>Ejecución servicio ≠ necesariamente Σ flujo proveedor</code></section>
      <section class="gpv2-card"><h3>Top 10 proveedores</h3><p>Participación de los diez proveedores de mayor monto dentro del flujo a proveedores del contexto activo. Describe concentración agregada, no riesgo individual.</p><code>Top10 = Σ monto 10 mayores / flujo total</code></section>
      <section class="gpv2-card"><h3>HHI de proveedores</h3><p>Suma de cuadrados de la participación de cada proveedor sobre el flujo visible. Se acerca a 1 cuando el flujo está concentrado en pocas contrapartes.</p><code>HHI = Σ (monto proveedor / flujo total)²</code></section>
      <section class="gpv2-card"><h3>Regla temporal v2</h3><p>Sin foco proveedor, la serie sigue la ejecución mensual de los servicios seleccionados. Con foco proveedor, sigue el flujo mensual materializado hacia ese proveedor. Esto evita mezclar bases distintas dentro de un mismo gráfico.</p><code>Serie = ejecución de servicio; con proveedor = flujo relacionado</code></section>
      <section class="gpv2-card"><h3>Drill-down contextual</h3><p>Servicios, proveedores, relaciones y sus detalles heredan los filtros activos y son servidos en páginas acotadas desde backend. El navegador deja de reconstruir el universo completo.</p><code>Backend calcula → publica → navegador presenta</code></section>
      <section class="gpv2-card"><h3>Dominios de fuente</h3><p>Presupuesto Abierto alimenta ejecución presupuestaria. ChileCompra alimenta compras públicas. Se presentan juntos en el monitor, pero no se fusionan métricas con definiciones incompatibles.</p></section>
      <section class="gpv2-card"><h3>Regla de interpretación</h3><p>Concentración, materialidad y variación son señales de priorización analítica. No constituyen por sí solas evidencia de irregularidad, fraude, conflicto de interés ni LA/FT.</p></section>
    </div>`;
  }

  async function loadContext() {
    const serial = ++contextSerial;
    const out = await api().publicSpend.budgetContext(S.filters, { route: 'public-spend:v2-preview:budget-context' });
    if (serial !== contextSerial) return false;
    S.context = out;
    return true;
  }

  async function loadTab() {
    if (S.tab === 'overview' || S.tab === 'method') {
      S.result = null;
      return;
    }
    const query = { search: S.search || undefined, offset: S.offset, limit: S.limit };
    const options = { filters: S.filters, query };
    const a = api();
    if (S.tab === 'services') S.result = await a.publicSpend.budgetServices({ ...options, route: 'public-spend:v2-preview:services' });
    else if (S.tab === 'providers') S.result = await a.publicSpend.budgetProviders({ ...options, route: 'public-spend:v2-preview:providers' });
    else S.result = await a.publicSpend.budgetFlows({ ...options, route: 'public-spend:v2-preview:flows' });
  }

  function list() {
    const kind = S.tab === 'services' ? 'service' : S.tab === 'providers' ? 'provider' : 'flow';
    const rows = S.result?.items || [];
    const page = S.result?.page || {};
    const title = S.tab === 'services' ? 'Servicios públicos' : S.tab === 'providers' ? 'Proveedores' : 'Relaciones servicio–proveedor';
    return `<section class="gpv2-card"><div class="gpv2-card-head"><div><h3>${title}</h3><small>Exploración contextual servida por backend · ${NF.format(activeFilterCount())} filtros activos.</small></div></div><div class="gpv2-list">${rows.map(x => topRow(x, kind, false)).join('') || '<div class="gpv2-empty">Sin resultados.</div>'}</div><div class="gpv2-pager"><button data-gpv2-page="prev" ${S.offset === 0 ? 'disabled' : ''}>← Anterior</button><span>${rows.length ? NF.format(S.offset + 1) + '–' + NF.format(S.offset + rows.length) : '0'}</span><button data-gpv2-page="next" ${page.has_more ? '' : 'disabled'}>Siguiente →</button></div></section>`;
  }

  function drawer() {
    if (!S.detail) return '';
    const d = S.detail.data || {}, entity = d.entity || {}, flows = Array.isArray(d.flows) ? d.flows : [];
    const isService = S.detail.type === 'service';
    const name = isService ? (entity.organization_name || entity.buyer_name || entity.name || S.detail.key) : (entity.provider_name || entity.supplier_name || entity.name || S.detail.key);
    const focusButton = isService ? `<button data-gpv2-focus-service="${esc(S.detail.key)}">Usar servicio como filtro</button>` : `<button data-gpv2-focus-provider="${esc(S.detail.key)}">Usar proveedor como filtro</button>`;
    return `<aside class="gpv2-drawer"><button class="gpv2-close" data-gpv2-close>×</button><span class="gpv2-eyebrow">Detalle contextual servido por backend</span><h3>${esc(name)}</h3><p>${isService ? esc(regionLabel(entity.main_region || entity.region)) : esc(entity.rut || '')}</p><div class="gpv2-detail-actions">${focusButton}</div><div class="gpv2-kpi"><small>Monto del contexto</small><b>${money(rowAmount(entity))}</b><span>snapshot ${esc(S.detail.snapshotId || '')}</span></div><h3 style="margin-top:18px">Relaciones visibles (${NF.format(flows.length)})</h3><div class="gpv2-detail-list">${flows.slice(0, 100).map(x => topRow(x, 'flow')).join('') || '<div class="gpv2-empty">Sin relaciones visibles en este contexto.</div>'}</div></aside>`;
  }

  function body() {
    if (S.tab === 'overview') return overview();
    if (S.tab === 'method') return methodology();
    return list();
  }

  function render() {
    const h = host(false);
    if (!h || !S.monitor || !S.context) return;
    h.innerHTML = `<div class="gpv2">${header()}${body()}${drawer()}</div>`;
    bind();
    health('ready', {
      detailMode: S.monitor?.data?.domains?.budget_execution?.quality?.detail_mode || null,
      returned: S.result?.items?.length || 0,
      contextMs: S.context?.meta?.clientMs || null,
      traceId: S.context?.meta?.traceId || null,
    });
  }

  async function showDetail(type, key) {
    try {
      const options = { filters: S.filters, route: `public-spend:v2-preview:${type}-detail` };
      const out = type === 'service'
        ? await api().publicSpend.budgetServiceDetail(key, options)
        : await api().publicSpend.budgetProviderDetail(key, options);
      S.detail = { type, key, data: out.detail || {}, snapshotId: out.snapshotId };
      render();
    } catch (e) {
      console.warn('[ATLAS v2 adapter] detail failed', e);
    }
  }

  async function refreshContext(message = 'Actualizando contexto en backend…') {
    loading(message);
    try {
      await loadContext();
      render();
    } catch (e) {
      errorView(e);
    }
  }

  async function setFocus(kind, key) {
    if (kind === 'service') S.filters.serviceId = key;
    else S.filters.providerId = key;
    S.detail = null;
    S.tab = 'overview';
    await refreshContext('Aplicando foco analítico…');
  }

  function bind() {
    const root = host(false);
    if (!root) return;

    root.querySelectorAll('[data-gpv2-tab]').forEach(button => button.addEventListener('click', async () => {
      S.tab = button.dataset.gpv2Tab;
      S.offset = 0;
      S.detail = null;
      loading('Consultando ' + S.tab + '…');
      try {
        await loadTab();
        render();
      } catch (e) {
        errorView(e);
      }
    }));

    root.querySelectorAll('[data-gpv2-filter]').forEach(select => select.addEventListener('change', async event => {
      const key = event.target.dataset.gpv2Filter;
      S.filters[key] = event.target.value;
      if (key === 'region' || key === 'category') {
        S.filters.serviceId = '';
        S.filters.providerId = '';
      }
      S.tab = 'overview';
      S.offset = 0;
      S.detail = null;
      await refreshContext('Recalculando contexto filtrado…');
    }));

    root.querySelector('[data-gpv2-reset-filters]')?.addEventListener('click', async () => {
      S.filters = EMPTY_FILTERS();
      S.search = '';
      S.offset = 0;
      S.detail = null;
      S.tab = 'overview';
      await refreshContext('Restableciendo contexto…');
    });

    root.querySelectorAll('[data-gpv2-clear-focus]').forEach(button => button.addEventListener('click', async () => {
      S.filters[button.dataset.gpv2ClearFocus] = '';
      S.offset = 0;
      await refreshContext('Quitando foco analítico…');
    }));

    root.querySelectorAll('[data-gpv2-focus-service]').forEach(button => button.addEventListener('click', () => setFocus('service', button.dataset.gpv2FocusService)));
    root.querySelectorAll('[data-gpv2-focus-provider]').forEach(button => button.addEventListener('click', () => setFocus('provider', button.dataset.gpv2FocusProvider)));

    const q = root.querySelector('#gpv2-search');
    q?.addEventListener('input', event => {
      S.search = event.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        S.offset = 0;
        loading('Buscando en el contexto…');
        try {
          await loadTab();
          render();
          document.querySelector('#gpv2-search')?.focus();
        } catch (err) {
          errorView(err);
        }
      }, 220);
    });

    root.querySelector('[data-gpv2-clear]')?.addEventListener('click', async () => {
      S.search = '';
      S.offset = 0;
      loading();
      try {
        await loadTab();
        render();
      } catch (e) {
        errorView(e);
      }
    });

    root.querySelectorAll('[data-gpv2-page]').forEach(button => button.addEventListener('click', async () => {
      S.offset = Math.max(0, S.offset + (button.dataset.gpv2Page === 'next' ? S.limit : -S.limit));
      loading();
      try {
        await loadTab();
        render();
      } catch (e) {
        errorView(e);
      }
    }));

    root.querySelectorAll('[data-gpv2-detail]').forEach(button => button.addEventListener('click', () => showDetail(button.dataset.gpv2Detail, button.dataset.key)));
    root.querySelector('[data-gpv2-close]')?.addEventListener('click', () => {
      S.detail = null;
      render();
    });
  }

  async function open(force = false) {
    if (S.loading) return false;
    S.loading = true;
    injectStyle();
    loading();
    try {
      S.monitor = await api().publicSpend.monitor({ force, route: 'public-spend:v2-preview' });
      const q = S.monitor?.data?.domains?.budget_execution?.quality || {};
      if (q.detail_mode !== 'FULL_BACKEND') throw new Error('El dominio presupuestario aún no está FULL_BACKEND. El corte v2 permanece bloqueado.');
      await loadContext();
      await loadTab();
      render();
      global.dispatchEvent(new CustomEvent('atlas:v2-public-spend-adapter-ready', { detail: { snapshot: S.monitor.snapshotId, budgetSnapshot: S.context?.snapshotId || null, mode: 'v2-preview' } }));
      return true;
    } catch (e) {
      S.error = e;
      errorView(e);
      return false;
    } finally {
      S.loading = false;
    }
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open().catch(errorView);
  }, true);

  global.AtlasV2PublicSpendAdapter = Object.freeze({
    open,
    refreshContext: () => refreshContext(),
    state: S,
    health: () => global.__ATLAS_V2_PUBLIC_SPEND_ADAPTER__ || null,
  });
  health('installed');
})(window);
