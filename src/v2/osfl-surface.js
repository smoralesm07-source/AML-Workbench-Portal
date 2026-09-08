'use strict';

(function installAtlasV2OsflSurface(global) {
  if (global.__ATLAS_V2_OSFL_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  const MONEY = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  let renderSerial = 0;

  function node(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = String(value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else el.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).forEach(child => {
      if (child == null) return;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return el;
  }
  function clear(el) { while (el?.firstChild) el.removeChild(el.firstChild); }
  function injectStyle() {
    if (document.getElementById('atlas-v2-osfl-style')) return;
    const link = document.createElement('link');
    link.id = 'atlas-v2-osfl-style'; link.rel = 'stylesheet'; link.href = new URL('osfl-surface.css?v=2', scriptBase).href;
    document.head.appendChild(link);
  }
  function count(v) { const n = Number(v); return Number.isFinite(n) ? NF.format(n) : '—'; }
  function pct(v) { const n = Number(v); return Number.isFinite(n) ? `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%` : '—'; }
  function money(v) { const n = Number(v); return Number.isFinite(n) ? MONEY.format(n) : '—'; }
  function date(v) { if (!v) return 'Sin fecha'; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }); }
  function stateFrom(route) {
    return {
      q: route.params.get('q') || '', region: route.params.get('region') || '', signal: (route.params.get('signal') || '').toUpperCase(),
      status: route.params.get('status') || '', offset: Math.max(0, Number(route.params.get('offset') || 0) || 0),
    };
  }
  function nav(api, state, patch = {}) { api.navigate('osfl', { ...state, ...patch }); }
  function loading(text = 'Consultando OSFL…') { return node('div', { class: 'osfl-loading', text }); }
  function errorBox(error) { return node('div', { class: 'osfl-error' }, [node('strong', { text: 'No fue posible leer OSFL. ' }), node('span', { text: String(error?.message || error || 'Error') }), error?.traceId ? node('small', { text: ` · trace ${error.traceId}` }) : null]); }

  function kpi(label, value, detail) { return node('article', { class: 'osfl-kpi' }, [node('small', { text: label }), node('strong', { text: value }), node('span', { text: detail })]); }

  function signalCard(api, state, item) {
    const materialized = item.status === 'MATERIALIZED';
    const definition = item.definition || {};
    const formula = item.mark_id === 'M19' ? '55% crecimiento · 25% juventud · 20% atipicidad' : item.mark_id === 'M20' ? '70% materialidad vs pares · 30% concentración/velocidad' : '50% grado · 30% diversidad de roles · 20% dispersión';
    return node('button', {
      class: 'osfl-signal', type: 'button', 'aria-pressed': state.signal === item.mark_id ? 'true' : 'false',
      onclick: () => nav(api, state, { signal: state.signal === item.mark_id ? '' : item.mark_id, offset: 0 }),
    }, [
      node('div', { class: 'sid', text: item.mark_id }),
      node('strong', { text: item.label }),
      node('div', { class: 'score', text: materialized ? count(item.entity_count) : '—' }),
      node('div', { class: 'state', text: materialized ? `${count(item.entity_count)} entidades · tope aislado ${definition.standalone_cap ?? '—'}` : 'Sin cobertura materializada en este corte' }),
      node('div', { class: 'state', text: formula }),
    ]);
  }

  function regionPanel(regions) {
    const rows = (regions || []).filter(r => r.region).slice(0, 10);
    const max = Math.max(1, ...rows.map(r => Number(r.map_primary_count || r.atlas_observed || 0)));
    return node('section', { class: 'osfl-panel' }, [
      node('h2', { text: 'Distribución territorial' }),
      node('p', { text: 'OSFL observadas por Atlas; la cobertura legal regional se conserva separada cuando está disponible.' }),
      node('div', { class: 'osfl-bars' }, rows.map(r => {
        const n = Number(r.map_primary_count || r.atlas_observed || 0);
        return node('div', { class: 'osfl-bar' }, [node('span', { text: r.region }), node('div', { class: 'osfl-track' }, node('div', { class: 'osfl-fill', style: `width:${Math.max(1, n / max * 100)}%` })), node('strong', { text: count(n) })]);
      })),
    ]);
  }

  function fundsPanel(funds) {
    const pending = String(funds?.transfer_source_status || '').includes('PENDING');
    return node('section', { class: 'osfl-panel' }, [
      node('h2', { text: 'Fondos públicos' }),
      node('p', { text: 'Separa registro habilitante de evidencia efectiva de transferencias.' }),
      node('div', { class: 'osfl-funds' }, [
        node('div', { class: 'osfl-funds-row' }, [node('span', { text: 'Registro 19.862 observado' }), node('strong', { text: count(funds?.registro19862_observed) })]),
        node('div', { class: 'osfl-funds-row' }, [node('span', { text: 'Receptores confirmados' }), node('strong', { text: count(funds?.confirmed_transfer_recipients) })]),
        node('div', { class: 'osfl-funds-row' }, [node('span', { text: 'Eventos confirmados' }), node('strong', { text: count(funds?.confirmed_transfer_events) })]),
        node('div', { class: 'osfl-funds-row' }, [node('span', { text: 'Monto confirmado' }), node('strong', { text: money(funds?.confirmed_transfer_amount_clp) })]),
      ]),
      node('div', { class: 'osfl-callout', text: pending ? 'La capa fila-a-fila de transferencias aún está pendiente de ingesta. Atlas no interpreta la pertenencia al Registro 19.862 como recepción de fondos.' : 'Los montos mostrados provienen de evidencia transaccional confirmada, no de la sola pertenencia al registro.' }),
    ]);
  }

  function filters(api, state, regions) {
    const search = node('input', { type: 'search', value: state.q, placeholder: 'RUT, nombre o actividad', 'aria-label': 'Buscar OSFL' });
    const region = node('select', { 'aria-label': 'Región' }, [node('option', { value: '', text: 'Todas las regiones' }), ...(regions || []).filter(r => r.region).map(r => node('option', { value: r.region, text: r.region }))]);
    region.value = state.region;
    const signal = node('select', { 'aria-label': 'Señal' }, [node('option', { value: '', text: 'Todas las señales' }), node('option', { value: 'M19', text: 'M19 · crecimiento acelerado' }), node('option', { value: 'M20', text: 'M20 · contratación pública' }), node('option', { value: 'M21', text: 'M21 · complejidad relacional' })]);
    signal.value = state.signal;
    const submit = () => nav(api, state, { q: search.value.trim(), region: region.value, signal: signal.value, offset: 0 });
    search.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    return node('div', { class: 'osfl-filters' }, [search, region, signal, node('button', { class: 'osfl-action', type: 'button', text: 'Aplicar', onclick: submit })]);
  }

  async function renderEntities(host, api, state, overview, serial) {
    const explorer = node('section', { class: 'osfl-panel osfl-explorer' }, [node('h2', { text: 'Explorador OSFL' }), node('p', { text: 'Filtra el snapshot gobernado. La ficha de Entidad 360 conserva el detalle tributario, UAF, sanciones, RES, compras y evidencia disponible.' }), filters(api, state, overview.regions)]);
    const live = node('div', {}, loading('Cargando entidades…')); explorer.append(live); host.append(explorer);
    try {
      const out = await global.AtlasV2Osfl.entities({ search: state.q, region: state.region, signal: state.signal, limit: 30, offset: state.offset }, { route: 'osfl:entities' });
      if (serial !== renderSerial || !live.isConnected) return;
      clear(live);
      if (!out.items?.length) { live.append(node('div', { class: 'osfl-empty', text: 'Sin entidades para los filtros seleccionados. Ausencia de cobertura no equivale a ausencia del fenómeno.' })); return; }
      const list = node('div', { class: 'osfl-list' });
      out.items.forEach(item => {
        const badges = [];
        if (item.is_uaf_observed) badges.push('UAF observado');
        if (item.fatf_r8_candidate) badges.push('Contexto R.8');
        if (Number(item.sanction_count || 0) > 0) badges.push(`${count(item.sanction_count)} sanción/evento`);
        (item.marks || []).forEach(mark => badges.push(mark.mark_id));
        list.append(node('article', { class: 'osfl-entity' }, [
          node('div', {}, [node('h3', { text: item.name || 'Entidad sin nombre' }), node('p', { text: item.rut || 'RUT no observado' }), node('div', { class: 'osfl-badges' }, badges.map(b => node('span', { class: 'osfl-badge', text: b })))]),
          node('div', {}, [node('strong', { text: item.region || 'Sin región' }), node('p', { text: item.commune || 'Comuna no observada' })]),
          node('div', {}, [node('strong', { text: item.main_activity || item.activity_group || 'Actividad no observada' }), node('p', { text: [item.sales_band, item.workers_numeric != null ? `${count(item.workers_numeric)} trabajadores` : ''].filter(Boolean).join(' · ') || 'Perfil económico parcial' })]),
          item.rut ? node('button', { class: 'osfl-action', type: 'button', text: 'Entidad 360', onclick: () => api.navigate('entidad', { rut: item.rut }) }) : node('span', { text: 'Sin RUT' }),
        ]));
      });
      const total = Number(out.page?.total || 0), limit = Number(out.page?.limit || 30), offset = Number(out.page?.offset || 0);
      live.append(list, node('div', { class: 'osfl-pager' }, [
        node('span', { text: `${count(offset + 1)}–${count(Math.min(total, offset + limit))} de ${count(total)}` }),
        node('div', {}, [node('button', { type: 'button', text: 'Anterior', disabled: offset <= 0 ? 'disabled' : null, onclick: () => nav(api, state, { offset: Math.max(0, offset - limit) }) }), ' ', node('button', { type: 'button', text: 'Siguiente', disabled: offset + limit >= total ? 'disabled' : null, onclick: () => nav(api, state, { offset: offset + limit }) })]),
      ]));
    } catch (error) { if (serial === renderSerial && live.isConnected) { clear(live); live.append(errorBox(error)); } }
  }

  async function render(root, route, api) {
    injectStyle(); const serial = ++renderSerial; const state = stateFrom(route); clear(root);
    const page = node('div', { class: 'atlas-v2-osfl' }); root.append(page);
    page.append(node('header', { class: 'osfl-head' }, [node('div', {}, [node('div', { class: 'atlas-v2-eyebrow', text: 'UNIVERSO · OSFL V2' }), node('h1', { text: 'Organizaciones sin fines de lucro' }), node('p', { text: 'Monitor poblacional y analítico con trazabilidad de cobertura, señales explicables y acceso directo a la evidencia por entidad.' })])]), loading('Cargando panorama OSFL…'));
    try {
      const out = await global.AtlasV2Osfl.overview({ route: 'osfl:overview' });
      if (serial !== renderSerial || !page.isConnected) return;
      page.lastChild?.remove();
      const monitor = out.monitor || {}, runtime = out.runtime || {}, funds = out.public_funds || {};
      page.append(node('div', { class: 'osfl-kpis' }, [
        kpi('OSFL observadas', count(runtime.entity_count || monitor.atlas_observed), `Actualizado ${date(out.snapshot_id)}`),
        kpi('Cobertura legal Atlas', pct(monitor.atlas_legal_coverage_pct), `${count(monitor.legal_universe_count || monitor.official_active_total)} universo legal informado`),
        kpi('Contexto FATF R.8', count(runtime.r8_count || monitor.fatf_r8_context), 'Contexto analítico; no implica condición de riesgo'),
        kpi('Señales IPA3', count(runtime.ipa3_positive_count || monitor.aml_analytic_signal), 'Priorización explicable; no probabilidad LA/FT'),
      ]));
      page.append(node('section', { class: 'osfl-panel' }, [node('h2', { text: 'Señales OSFL recuperadas' }), node('p', { text: 'M19, M20 y M21 conservan metodología y guardrails. Si el corte no materializa una señal, Atlas lo declara explícitamente.' }), node('div', { class: 'osfl-signals' }, (out.signals || []).map(item => signalCard(api, state, item)))]));
      page.append(node('div', { class: 'osfl-grid' }, [regionPanel(out.regions), fundsPanel(funds)]));
      await renderEntities(page, api, state, out, serial);
      page.append(node('div', { class: 'osfl-callout', text: out.semantics?.signals || 'Las señales ordenan revisión analítica y no constituyen imputación de irregularidad.' }));
    } catch (error) { if (serial === renderSerial && page.isConnected) { clear(page); page.append(errorBox(error)); } }
  }

  function install() {
    if (!global.AtlasV2Shell?.registerSurface || !global.AtlasV2Osfl) return false;
    global.AtlasV2Shell.registerSurface('osfl', render);
    global.__ATLAS_V2_OSFL_SURFACE__ = true;
    return true;
  }
  if (!install()) global.addEventListener('atlas:v2:ready', install, { once: true });
})(window);
