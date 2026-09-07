'use strict';

(function installAtlasV2Entity360Surface(global) {
  if (global.__ATLAS_V2_ENTITY360_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  let renderSerial = 0;

  function node(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') element.className = value;
      else if (key === 'text') element.textContent = String(value);
      else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
      else element.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).forEach(child => {
      if (child == null) return;
      element.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return element;
  }

  function clear(element) {
    while (element?.firstChild) element.removeChild(element.firstChild);
  }

  function injectStyle() {
    if (document.getElementById('atlas-v2-entity360-style')) return;
    const link = document.createElement('link');
    link.id = 'atlas-v2-entity360-style';
    link.rel = 'stylesheet';
    link.href = new URL('entity360-surface.css?v=1', scriptBase).href;
    document.head.appendChild(link);
  }

  function money(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return '—';
    const a = Math.abs(n);
    if (a >= 1e12) return `$${(n / 1e12).toLocaleString('es-CL', { maximumFractionDigits: 2 })} bill.`;
    if (a >= 1e9) return `$${(n / 1e9).toLocaleString('es-CL', { maximumFractionDigits: 1 })} mil M`;
    if (a >= 1e6) return `$${(n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 })} M`;
    return `$${NF.format(Math.round(n))}`;
  }

  function pageHead(rut) {
    return node('header', { class: 'atlas-v2-pagehead' }, [
      node('div', { class: 'atlas-v2-eyebrow', text: 'EXPEDIENTE ANALÍTICO · ENTIDAD 360' }),
      node('h1', { text: 'Entidad 360' }),
      node('p', { text: rut
        ? `Exploración por RUT ${rut}. Cada lente conserva su fuente y estado; la ausencia de una fuente no se interpreta como cero.`
        : 'Busca una entidad para reunir evidencia de múltiples fuentes sin abrir, asignar ni administrar un caso.' }),
    ]);
  }

  function searchBox(api, initial = '') {
    const input = node('input', {
      type: 'search',
      value: initial,
      placeholder: 'RUT de la entidad, por ejemplo 76.123.456-7',
      'aria-label': 'Buscar entidad por RUT',
    });
    const submit = () => {
      const value = input.value.trim();
      if (!value) return;
      const rut = global.AtlasV2Entity360?.canonicalRut(value) || value;
      api.navigate('entidad', { rut });
    };
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    return node('div', { class: 'atlas-v2-querybox atlas-v2-entity-search' }, [
      input,
      node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Analizar', onclick: submit }),
    ]);
  }

  function lensBar() {
    return node('div', { class: 'atlas-v2-lensbar' }, [
      node('span', { class: 'atlas-v2-chip', text: 'Identidad' }),
      node('span', { class: 'atlas-v2-chip', text: 'Tributario' }),
      node('span', { class: 'atlas-v2-chip', text: 'UAF' }),
      node('span', { class: 'atlas-v2-chip', text: 'RES' }),
      node('span', { class: 'atlas-v2-chip', text: 'Sanciones' }),
      node('span', { class: 'atlas-v2-chip', text: 'Gasto público' }),
      node('span', { class: 'atlas-v2-chip', text: 'Relaciones' }),
      node('span', { class: 'atlas-v2-chip', text: 'Cronología' }),
    ]);
  }

  function statusBadge(status) {
    const labels = { ready: 'Conectado', unavailable: 'No publicado', error: 'Error de lectura', invalid: 'Entrada inválida' };
    return node('span', { class: `atlas-v2-e360-status ${status || 'unavailable'}`, text: labels[status] || status || 'Sin estado' });
  }

  function analyticalMoves(api, rut) {
    const wrap = node('section', { class: 'atlas-v2-section atlas-v2-e360-moves' }, [
      node('div', { class: 'atlas-v2-section-head' }, [
        node('div', {}, [
          node('h2', { text: 'Seguir investigando' }),
          node('p', { text: 'El RUT viaja con la navegación. No se crea expediente de gestión, propietario ni estado.' }),
        ]),
      ]),
    ]);
    const grid = node('div', { class: 'atlas-v2-grid three' });
    [
      ['GASTO PÚBLICO', 'Abrir comportamiento económico', 'Compras, proveedores y contexto presupuestario.', 'gasto-publico'],
      ['RELACIONES', 'Abrir red de vínculos', 'Representantes, domicilios, sociedades y contrapartes.', 'relaciones'],
      ['TERRITORIO', 'Abrir contexto territorial', 'Región, comuna y patrones geográficos comparables.', 'territorio'],
    ].forEach(([tag, title, description, route]) => {
      grid.append(node('button', { class: 'atlas-v2-card', type: 'button', onclick: () => api.navigate(route, { rut }) }, [
        node('span', { class: 'atlas-v2-card-tag', text: tag }),
        node('h3', { text: title }),
        node('p', { text: description }),
        node('div', { class: 'atlas-v2-card-foot', text: 'Conservar RUT →' }),
      ]));
    });
    wrap.append(grid);
    return wrap;
  }

  function corePanel(core, rut) {
    const panel = node('section', { class: 'atlas-v2-e360-panel' });
    const head = node('div', { class: 'atlas-v2-e360-panel-head' }, [
      node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'NÚCLEO 360' }), node('h2', { text: 'Identidad y fuentes institucionales' })]),
      statusBadge(core?.status),
    ]);
    panel.append(head);

    if (core?.status === 'ready') {
      const identity = core.identity || {};
      panel.append(node('div', { class: 'atlas-v2-e360-identity' }, [
        node('div', {}, [node('span', { text: 'Razón social' }), node('strong', { text: identity.name || 'Sin nombre publicado' })]),
        node('div', {}, [node('span', { text: 'RUT' }), node('strong', { text: identity.rut || rut })]),
        node('div', {}, [node('span', { text: 'Estado' }), node('strong', { text: identity.status || 'No informado' })]),
        node('div', {}, [node('span', { text: 'Territorio' }), node('strong', { text: [identity.commune, identity.region].filter(Boolean).join(' · ') || 'No informado' })]),
        node('div', {}, [node('span', { text: 'Actividad / giro' }), node('strong', { text: identity.activity || 'No informado' })]),
        node('div', {}, [node('span', { text: 'Snapshot' }), node('strong', { text: core.snapshotId || 'Sin identificador' })]),
      ]));
    } else {
      panel.append(node('div', { class: 'atlas-v2-notice atlas-v2-e360-notice' }, [
        node('strong', { text: 'Atlas no completa lo que aún no está gobernado. ' }),
        node('span', { text: core?.message || 'El contrato consolidado de Entidad 360 todavía no está disponible.' }),
      ]));
    }
    return panel;
  }

  function resultList(title, subtitle, state) {
    const panel = node('section', { class: 'atlas-v2-e360-panel' });
    panel.append(node('div', { class: 'atlas-v2-e360-panel-head' }, [
      node('div', {}, [node('span', { class: 'atlas-v2-card-tag', text: 'LENTE REAL' }), node('h2', { text: title }), node('p', { text: subtitle })]),
      statusBadge(state?.status),
    ]));

    if (state?.status === 'error') {
      panel.append(node('div', { class: 'atlas-v2-e360-source-error' }, [
        node('strong', { text: 'No fue posible consultar esta lente.' }),
        node('span', { text: state.message || state.code || 'Error de lectura' }),
      ]));
      return panel;
    }

    const items = Array.isArray(state?.items) ? state.items : [];
    if (!items.length) {
      panel.append(node('div', { class: 'atlas-v2-empty' }, [
        node('strong', { text: 'Sin coincidencias en este snapshot' }),
        node('span', { text: 'Esto significa “no observado en esta lectura”; no equivale a confirmar inexistencia.' }),
      ]));
      return panel;
    }

    const list = node('div', { class: 'atlas-v2-e360-results' });
    items.forEach(item => {
      list.append(node('article', { class: 'atlas-v2-e360-result' }, [
        node('div', {}, [
          node('strong', { text: item.name || item.rut || item.id || 'Proveedor sin etiqueta' }),
          node('span', { text: [item.rut, item.serviceCount ? `${NF.format(item.serviceCount)} relaciones/servicios` : ''].filter(Boolean).join(' · ') || 'Identificador de fuente disponible' }),
        ]),
        node('b', { text: money(item.amount) }),
      ]));
    });
    panel.append(list, node('div', { class: 'atlas-v2-e360-provenance', text: `Snapshot: ${state.snapshotId || 'no informado'} · Contrato: ${state.contract || 'ATLAS v2'}` }));
    return panel;
  }

  function loadingPanel() {
    return node('div', { class: 'atlas-v2-e360-loading', role: 'status' }, [
      node('strong', { text: 'Consultando lentes gobernadas…' }),
      node('span', { text: 'Atlas mantiene separadas identidad, compras y presupuesto para no mezclar definiciones.' }),
    ]);
  }

  function renderInvalid(container, api, value) {
    container.append(pageHead(''), searchBox(api, value), lensBar(), node('div', { class: 'atlas-v2-notice' }, [
      node('strong', { text: 'RUT no válido. ' }),
      'Revisa el formato e inténtalo nuevamente.',
    ]));
  }

  async function resolve(container, api, rut, serial) {
    const host = node('div', { class: 'atlas-v2-e360-live' }, [loadingPanel()]);
    container.append(host, analyticalMoves(api, rut));
    let result;
    try {
      result = await global.AtlasV2Entity360.read(rut);
    } catch (error) {
      result = { status: 'unavailable', rut, core: { status: 'error', message: String(error?.message || error) }, publicSpend: {} };
    }
    if (serial !== renderSerial || !host.isConnected) return;
    clear(host);
    if (result.status === 'invalid') {
      host.append(node('div', { class: 'atlas-v2-notice' }, [node('strong', { text: result.message })]));
      return;
    }
    host.append(
      corePanel(result.core, rut),
      node('div', { class: 'atlas-v2-e360-grid' }, [
        resultList('Compras públicas', 'Coincidencias de proveedor consultadas en el dominio ChileCompra v2.', result.publicSpend?.procurement),
        resultList('Ejecución / flujo a proveedores', 'Coincidencias consultadas en el dominio Presupuesto Abierto v2.', result.publicSpend?.budget),
      ]),
      node('div', { class: 'atlas-v2-e360-rule' }, [
        node('strong', { text: 'Regla de interpretación. ' }),
        'Aparecer como proveedor, concentrar montos o registrar una relación económica es evidencia contextual para explorar; no constituye por sí sola irregularidad ni señal LA/FT.',
      ]),
    );
  }

  function render(container, route, api) {
    injectStyle();
    const serial = ++renderSerial;
    const raw = route.params.get('rut') || route.params.get('q') || '';
    const rut = global.AtlasV2Entity360?.canonicalRut(raw) || raw;

    if (!raw) {
      container.append(pageHead(''), searchBox(api), lensBar(), node('div', { class: 'atlas-v2-empty' }, [
        node('strong', { text: 'Empieza por una entidad' }),
        node('span', { text: 'La ficha se arma por lentes. Puedes explorar y salir de ella sin crear un caso ni registrar una gestión.' }),
      ]));
      return;
    }

    if (!global.AtlasV2Entity360?.validRutShape(rut)) {
      renderInvalid(container, api, raw);
      return;
    }

    container.append(pageHead(rut), searchBox(api, rut), lensBar());
    void resolve(container, api, rut, serial);
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('entidad', render);
    global.__ATLAS_V2_ENTITY360_SURFACE__ = Object.freeze({ installed: true, route: 'entidad', mode: 'analysis-first' });
    return true;
  }

  if (!register()) {
    global.addEventListener('atlas:v2-shell-ready', register, { once: true });
  }
})(window);
