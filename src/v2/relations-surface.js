'use strict';

(function installAtlasV2RelationsSurface(global) {
  if (global.__ATLAS_V2_RELATIONS_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  const VALID_TABS = new Set(['documented', 'convergences', 'hypotheses', 'method']);
  let renderSerial = 0;
  let controller = null;

  function node(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') element.className = value;
      else if (key === 'text') element.textContent = String(value);
      else if (key === 'dataset') Object.entries(value).forEach(([name, entry]) => { element.dataset[name] = entry; });
      else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
      else element.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).forEach(child => {
      if (child == null) return;
      element.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return element;
  }

  function svgNode(tag, attrs = {}, children = []) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value != null) element.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).forEach(child => { if (child) element.append(child); });
    return element;
  }

  function clear(element) {
    while (element?.firstChild) element.removeChild(element.firstChild);
  }

  function injectStyle() {
    if (document.getElementById('atlas-v2-relations-style')) return;
    const link = document.createElement('link');
    link.id = 'atlas-v2-relations-style';
    link.rel = 'stylesheet';
    link.href = new URL('relations-surface.css?v=1', scriptBase).href;
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

  function pct(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `${(n * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 })}%` : '—';
  }

  function short(value, max = 24) {
    const text = String(value || '').trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function routeState(route) {
    const params = route.params;
    const rut = params.get('rut') || '';
    const supplier = params.get('supplier') || params.get('provider') || '';
    const buyer = params.get('buyer') || '';
    const entity = params.get('entity') || '';
    return {
      tab: VALID_TABS.has(params.get('tab')) ? params.get('tab') : 'documented',
      q: params.get('q') || '',
      rut,
      supplier,
      buyer,
      entity,
      relation: params.get('relation') || '',
    };
  }

  function routePayload(state, patch = {}) {
    const next = { ...state, ...patch };
    return {
      tab: next.tab,
      q: next.q,
      rut: next.rut,
      supplier: next.supplier,
      buyer: next.buyer,
      entity: next.entity,
      relation: next.relation,
    };
  }

  function navigate(api, state, patch = {}) {
    api.navigate('relaciones', routePayload(state, patch));
  }

  function focusObject(state) {
    return {
      rut: state.rut,
      supplierId: state.supplier,
      buyerId: state.buyer,
      entityId: state.entity,
    };
  }

  function hasFocus(state) {
    return !!(state.rut || state.supplier || state.buyer || state.entity);
  }

  function pageHead(state) {
    const focus = state.rut || state.supplier || state.buyer || state.entity;
    return node('header', { class: 'atlas-v2-pagehead' }, [
      node('div', { class: 'atlas-v2-eyebrow', text: 'CONVERGENCIA · RELACIONES V2' }),
      node('h1', { text: 'Relaciones documentadas, convergencias e hipótesis' }),
      node('p', { text: focus
        ? `Contexto activo: ${focus}. Atlas conserva la procedencia de cada arista y nunca transfiere riesgo automáticamente entre nodos.`
        : 'Explora vínculos observados y señales que convergen sobre ellos. Una coincidencia útil para investigar permanece separada de una relación documentada.' }),
    ]);
  }

  function tabs(api, state) {
    const specs = [
      ['documented', 'Documentadas'],
      ['convergences', 'Convergencias'],
      ['hypotheses', 'Hipótesis'],
      ['method', 'Método'],
    ];
    return node('nav', { class: 'atlas-v2-rel-tabs', 'aria-label': 'Capas de Relaciones' }, specs.map(([id, label]) =>
      node('button', {
        type: 'button',
        class: state.tab === id ? 'active' : '',
        text: label,
        onclick: () => navigate(api, state, { tab: id, relation: '' }),
      }),
    ));
  }

  function searchBox(api, state) {
    const input = node('input', {
      type: 'search',
      value: state.q,
      placeholder: 'Buscar entidad, RUT, proveedor o comprador…',
      'aria-label': 'Buscar nodo en Relaciones',
    });
    const submit = () => navigate(api, state, { q: input.value.trim(), rut: '', supplier: '', buyer: '', entity: '', relation: '', tab: 'documented' });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    return node('div', { class: 'atlas-v2-rel-search' }, [
      input,
      node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Buscar', onclick: submit }),
      hasFocus(state) || state.q ? node('button', {
        class: 'atlas-v2-button', type: 'button', text: 'Limpiar contexto',
        onclick: () => navigate(api, state, { q: '', rut: '', supplier: '', buyer: '', entity: '', relation: '', tab: 'documented' }),
      }) : null,
    ]);
  }

  function semanticStrip() {
    return node('div', { class: 'atlas-v2-rel-semantic' }, [
      node('span', { class: 'documented', text: 'Documentada · vínculo observado' }),
      node('span', { class: 'convergence', text: 'Convergencia · señales sobre un vínculo' }),
      node('span', { class: 'hypothesis', text: 'Hipótesis · no es arista hasta corroboración' }),
    ]);
  }

  function sourceBadge(text, tone = '') {
    return node('span', { class: `atlas-v2-rel-badge ${tone}`.trim(), text });
  }

  function nodeFocusPatch(item) {
    if (item.node_type === 'SUPPLIER') return { supplier: String(item.node_id || '').replace(/^supplier:/, ''), buyer: '', entity: '', rut: item.rut || '', q: '', relation: '' };
    if (item.node_type === 'BUYER') return { buyer: String(item.node_id || '').replace(/^buyer:/, ''), supplier: '', entity: '', rut: item.rut || '', q: '', relation: '' };
    return { entity: String(item.node_id || '').replace(/^entity:/, ''), supplier: '', buyer: '', rut: item.rut || '', q: '', relation: '' };
  }

  function searchResults(api, state, result) {
    const wrap = node('section', { class: 'atlas-v2-rel-panel' }, [
      node('div', { class: 'atlas-v2-rel-panel-head' }, [
        node('div', {}, [node('h2', { text: 'Nodos encontrados' }), node('p', { text: `Resultados gobernados para “${state.q}”. No se concilian identidades por similitud de nombre.` })]),
      ]),
    ]);
    const items = Array.isArray(result.items) ? result.items : [];
    if (!items.length) {
      wrap.append(empty('Sin coincidencias', 'No observado en este snapshot no significa inexistencia.'));
      return wrap;
    }
    const grid = node('div', { class: 'atlas-v2-rel-search-grid' });
    items.forEach(item => {
      const card = node('button', { class: 'atlas-v2-rel-node-card', type: 'button', onclick: () => navigate(api, state, nodeFocusPatch(item)) }, [
        node('div', { class: 'atlas-v2-rel-node-top' }, [
          sourceBadge(item.node_type || 'NODO', item.node_type === 'ENTITY' ? 'neutral' : 'live'),
          sourceBadge(item.source_domain || 'fuente'),
        ]),
        node('strong', { text: item.label || item.rut || item.node_id || 'Nodo sin etiqueta' }),
        node('span', { text: [item.rut, item.region, item.commune].filter(Boolean).join(' · ') || item.node_id }),
        node('small', { text: item.amount_12m ? `${money(item.amount_12m)} · ${NF.format(Number(item.relation_count || 0))} relaciones` : `${NF.format(Number(item.source_count || 0))} fuentes observadas` }),
      ]);
      grid.append(card);
    });
    wrap.append(grid);
    return wrap;
  }

  function empty(title, body) {
    return node('div', { class: 'atlas-v2-empty' }, [node('strong', { text: title }), node('span', { text: body })]);
  }

  function networkGraph(api, state, result) {
    const center = result.center;
    const nodes = Array.isArray(result.nodes) ? result.nodes.slice(0, 14) : [];
    const edges = Array.isArray(result.edges) ? result.edges.slice(0, 14) : [];
    const panel = node('section', { class: 'atlas-v2-rel-panel atlas-v2-rel-network-panel' }, [
      node('div', { class: 'atlas-v2-rel-panel-head' }, [
        node('div', {}, [node('h2', { text: 'Vecindad documentada' }), node('p', { text: 'La visualización muestra sólo relaciones servidas por el contrato backend. Grosor = materialidad relativa del vínculo.' })]),
        sourceBadge(result.snapshotId ? `Snapshot ${result.snapshotId}` : 'Sin snapshot'),
      ]),
    ]);
    if (!center) {
      panel.append(empty('Sin nodo materializado', 'El identificador no tiene una vecindad publicada en las fuentes v2 disponibles.'));
      return panel;
    }
    if (!nodes.length || !edges.length) {
      panel.append(nodeSummary(api, state, center), empty('Sin aristas documentadas', 'La entidad puede tener evidencia observacional, pero no existe una relación estructurada publicada para este corte.'));
      return panel;
    }

    const width = 980;
    const height = 420;
    const cx = width / 2;
    const cy = height / 2;
    const maxAmount = Math.max(...edges.map(edge => Number(edge.amount_clp || 0)), 1);
    const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Red de relaciones documentadas' });
    const positions = new Map();
    positions.set(center.node_id, { x: cx, y: cy });
    nodes.forEach((item, index) => {
      const angle = (Math.PI * 2 * index / nodes.length) - Math.PI / 2;
      const rx = nodes.length > 8 ? 355 : 300;
      const ry = nodes.length > 8 ? 165 : 145;
      positions.set(item.node_id, { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
    });

    edges.forEach(edge => {
      const from = positions.get(edge.from_node_id) || positions.get(center.node_id);
      const to = positions.get(edge.to_node_id) || positions.get(center.node_id);
      if (!from || !to) return;
      const ratio = Math.max(0, Number(edge.amount_clp || 0)) / maxAmount;
      svg.append(svgNode('line', {
        x1: from.x, y1: from.y, x2: to.x, y2: to.y,
        class: 'atlas-v2-rel-edge', 'stroke-width': String(1.5 + 5 * Math.sqrt(ratio)),
      }));
    });

    const drawNode = (item, position, isCenter = false) => {
      const group = svgNode('g', { class: `atlas-v2-rel-svg-node${isCenter ? ' center' : ''}`, tabindex: '0', role: 'button' });
      const circle = svgNode('circle', { cx: position.x, cy: position.y, r: isCenter ? 38 : 27 });
      const label = svgNode('text', { x: position.x, y: position.y + (isCenter ? 56 : 44), 'text-anchor': 'middle' });
      label.textContent = short(item.label || item.rut || item.node_id, isCenter ? 30 : 22);
      group.append(circle, label);
      if (!isCenter) {
        const action = () => navigate(api, state, nodeFocusPatch(item));
        group.addEventListener('click', action);
        group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } });
      }
      svg.append(group);
    };
    drawNode(center, positions.get(center.node_id), true);
    nodes.forEach(item => drawNode(item, positions.get(item.node_id), false));

    panel.append(node('div', { class: 'atlas-v2-rel-svg-wrap' }, [svg]));
    return panel;
  }

  function nodeSummary(api, state, center) {
    const actions = node('div', { class: 'atlas-v2-rel-actions' });
    if (center.rut) actions.append(node('button', { type: 'button', text: 'Entidad 360', onclick: () => api.navigate('entidad', { rut: center.rut }) }));
    if (center.node_type === 'SUPPLIER') actions.append(node('button', { type: 'button', text: 'Gasto público', onclick: () => api.navigate('gasto-publico', { rut: center.rut || '', provider: String(center.node_id || '').replace(/^supplier:/, ''), tab: 'providers' }) }));
    if (center.node_type === 'BUYER') actions.append(node('button', { type: 'button', text: 'Gasto público', onclick: () => api.navigate('gasto-publico', { service: String(center.node_id || '').replace(/^buyer:/, ''), tab: 'buyers' }) }));
    return node('div', { class: 'atlas-v2-rel-center' }, [
      node('div', {}, [
        node('span', { text: center.node_type || 'NODO' }),
        node('strong', { text: center.label || center.rut || center.node_id || 'Nodo activo' }),
        node('small', { text: [center.rut, center.region, center.commune].filter(Boolean).join(' · ') || center.source_domain || 'fuente gobernada' }),
      ]),
      actions,
    ]);
  }

  function edgeList(api, state, result) {
    const edges = Array.isArray(result.edges) ? result.edges : [];
    const panel = node('section', { class: 'atlas-v2-rel-panel' }, [
      node('div', { class: 'atlas-v2-rel-panel-head' }, [node('div', {}, [node('h2', { text: 'Relaciones observadas' }), node('p', { text: 'Cada fila conserva fuente, período, materialidad y señales asociadas.' })])]),
    ]);
    if (!edges.length) {
      panel.append(empty('Sin relaciones para listar', 'No hay aristas estructuradas en el contexto activo.'));
      return panel;
    }
    const list = node('div', { class: 'atlas-v2-rel-list' });
    edges.forEach(edge => {
      const actions = node('div', { class: 'atlas-v2-rel-actions' }, [
        node('button', { type: 'button', text: 'Detalle', onclick: () => navigate(api, state, { relation: edge.relation_id }) }),
      ]);
      const supplierRut = String(edge.to_node_id || '').replace(/^supplier:/, '');
      if (/^[0-9]+-[0-9Kk]$/.test(supplierRut)) actions.append(node('button', { type: 'button', text: 'Proveedor 360', onclick: () => api.navigate('entidad', { rut: supplierRut }) }));
      list.append(node('article', { class: 'atlas-v2-rel-row' }, [
        node('div', { class: 'atlas-v2-rel-row-main' }, [
          node('div', { class: 'atlas-v2-rel-row-tags' }, [sourceBadge('DOCUMENTADA', 'documented'), sourceBadge(edge.source_code || 'fuente')]),
          node('strong', { text: `${edge.from_label || edge.from_node_id} → ${edge.to_label || edge.to_node_id}` }),
          node('span', { text: `${NF.format(Number(edge.event_count || 0))} órdenes · ${edge.first_seen || '—'} a ${edge.last_seen || '—'} · convergencias ${NF.format(Number(edge.convergence_count || 0))}` }),
          actions,
        ]),
        node('div', { class: 'atlas-v2-rel-row-value' }, [node('b', { text: money(edge.amount_clp) }), node('small', { text: `prioridad ${Number(edge.review_priority || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 })}` })]),
      ]));
    });
    panel.append(list);
    return panel;
  }

  function evidencePanel(result) {
    const evidence = Array.isArray(result.evidence) ? result.evidence : [];
    const panel = node('section', { class: 'atlas-v2-rel-panel' }, [
      node('div', { class: 'atlas-v2-rel-panel-head' }, [node('div', {}, [node('h2', { text: 'Evidencia asociada' }), node('p', { text: 'Hallazgos o fuentes del nodo activo. La evidencia no crea por sí sola nuevas aristas.' })])]),
    ]);
    if (!evidence.length) {
      panel.append(empty('Sin evidencia adicional', 'La vecindad puede estar documentada aun cuando no existan hallazgos publicados para el vínculo.'));
      return panel;
    }
    const list = node('div', { class: 'atlas-v2-rel-evidence' });
    evidence.slice(0, 20).forEach(item => {
      list.append(node('article', {}, [
        node('div', {}, [sourceBadge(item.evidence_type || item.family || item.finding_type || 'EVIDENCIA'), node('strong', { text: item.title || item.evidence_id || item.finding_id || 'Evidencia' })]),
        node('p', { text: item.summary || item.status || item.source_status || 'Registro asociado al nodo o relación.' }),
        item.materiality_clp ? node('b', { text: money(item.materiality_clp) }) : null,
      ]));
    });
    panel.append(list);
    return panel;
  }

  function relationDetail(api, state, result) {
    const relation = result?.detail?.relation;
    if (!relation) return empty('Detalle no disponible', 'La relación seleccionada no está materializada en el snapshot activo.');
    const findings = Array.isArray(result.detail.findings) ? result.detail.findings : [];
    const panel = node('section', { class: 'atlas-v2-rel-panel atlas-v2-rel-detail' }, [
      node('div', { class: 'atlas-v2-rel-panel-head' }, [
        node('div', {}, [node('h2', { text: 'Detalle de la relación' }), node('p', { text: relation.relation_id })]),
        node('button', { class: 'atlas-v2-button', type: 'button', text: 'Cerrar detalle', onclick: () => navigate(api, state, { relation: '' }) }),
      ]),
      node('div', { class: 'atlas-v2-rel-detail-grid' }, [
        metric('Comprador', relation.buyer_label || relation.buyer_id),
        metric('Proveedor', relation.supplier_label || relation.supplier_id),
        metric('Monto 12m', money(relation.amount_clp)),
        metric('Órdenes', NF.format(Number(relation.event_count || 0))),
        metric('Participación comprador', pct(relation.buyer_share)),
        metric('Participación proveedor', pct(relation.supplier_share)),
        metric('Convergencias', NF.format(Number(relation.convergence_count || 0))),
        metric('Señales de precio', NF.format(Number(relation.price_signal_count || 0))),
      ]),
      node('div', { class: 'atlas-v2-rel-rule' }, [node('strong', { text: 'Interpretación. ' }), 'Una relación económica documentada y sus señales asociadas priorizan exploración; no transfieren riesgo ni prueban irregularidad o LA/FT.']),
    ]);
    if (findings.length) {
      const list = node('div', { class: 'atlas-v2-rel-evidence' });
      findings.forEach(item => list.append(node('article', {}, [
        node('div', {}, [sourceBadge(item.severity_band || item.family || 'HALLAZGO', 'convergence'), node('strong', { text: item.title || item.finding_id })]),
        node('p', { text: item.summary || 'Hallazgo asociado a la relación.' }),
        item.materiality_clp ? node('b', { text: money(item.materiality_clp) }) : null,
      ])));
      panel.append(node('h3', { text: 'Hallazgos vinculados' }), list);
    }
    return panel;
  }

  function metric(label, value) {
    return node('div', {}, [node('span', { text: label }), node('strong', { text: value || '—' })]);
  }

  function convergenceView(api, state, result) {
    const items = Array.isArray(result.items) ? result.items : [];
    const panel = node('section', { class: 'atlas-v2-rel-panel' }, [
      node('div', { class: 'atlas-v2-rel-panel-head' }, [
        node('div', {}, [node('h2', { text: 'Convergencias sobre relaciones observadas' }), node('p', { text: 'Por ahora provienen del dominio ChileCompra: son múltiples dimensiones analíticas sobre la misma relación, no múltiples fuentes independientes.' })]),
        sourceBadge('FUENTE ÚNICA · CHILECOMPRA', 'convergence'),
      ]),
    ]);
    if (!items.length) {
      panel.append(empty('Sin convergencias en el filtro activo', 'No se fuerza una convergencia cuando el backend no la publica.'));
      return panel;
    }
    const list = node('div', { class: 'atlas-v2-rel-list' });
    items.forEach(item => {
      const supplierRut = item.supplier_id || '';
      const actions = node('div', { class: 'atlas-v2-rel-actions' }, [
        node('button', { type: 'button', text: 'Detalle', onclick: () => navigate(api, state, { tab: 'documented', relation: item.relation_id }) }),
        node('button', { type: 'button', text: 'Refocar proveedor', onclick: () => navigate(api, state, { tab: 'documented', supplier: item.supplier_id, buyer: '', rut: /^[0-9]+-[0-9Kk]$/.test(supplierRut) ? supplierRut : '', relation: '' }) }),
      ]);
      list.append(node('article', { class: 'atlas-v2-rel-row' }, [
        node('div', { class: 'atlas-v2-rel-row-main' }, [
          node('div', { class: 'atlas-v2-rel-row-tags' }, [sourceBadge('CONVERGENCIA', 'convergence'), sourceBadge('no independiente', 'neutral')]),
          node('strong', { text: `${item.buyer_label || item.buyer_id} → ${item.supplier_label || item.supplier_id}` }),
          node('span', { text: `${NF.format(Number(item.convergence_count || 0))} dimensiones · ${NF.format(Number(item.price_signal_count || 0))} señales de precio · aceleración ${Number(item.acceleration_ratio || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 })}` }),
          actions,
        ]),
        node('div', { class: 'atlas-v2-rel-row-value' }, [node('b', { text: money(item.amount_clp) }), node('small', { text: `prioridad ${Number(item.review_priority || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 })}` })]),
      ]));
    });
    panel.append(list, node('div', { class: 'atlas-v2-rel-rule' }, [node('strong', { text: 'Guardarraíl. ' }), 'Convergencia de señales no equivale a convergencia de fuentes ni prueba irregularidad.']));
    return panel;
  }

  function hypothesesView(result) {
    const availability = result.availability || {};
    const pending = Array.isArray(availability.pending_relation_families) ? availability.pending_relation_families : [];
    const panel = node('section', { class: 'atlas-v2-rel-panel' }, [
      node('div', { class: 'atlas-v2-rel-panel-head' }, [node('div', {}, [node('h2', { text: 'Hipótesis de relación' }), node('p', { text: 'ATLAS v2 no dibuja un vínculo inferido hasta que exista un modelo gobernado de identidad/relación.' })]), sourceBadge('INFERENCIA DESACTIVADA', 'hypothesis')]),
      node('div', { class: 'atlas-v2-rel-rule' }, [node('strong', { text: 'Decisión del corte. ' }), 'Compartir región, sanción, score o similitud nominal no crea una arista entre entidades.']),
    ]);
    const grid = node('div', { class: 'atlas-v2-rel-hyp-grid' });
    (pending.length ? pending : ['REPRESENTATIVE', 'DOMICILE', 'SHAREHOLDING', 'SOCIETY_CONTROL']).forEach(family => {
      const labels = {
        REPRESENTATIVE: ['Representante', 'Vínculos por representación legal con identidad validada.'],
        DOMICILE: ['Domicilio', 'Coincidencias de dirección sólo después de normalización y evidencia suficiente.'],
        SHAREHOLDING: ['Participación', 'Socios/accionistas con fuente y porcentaje cuando estén materializados.'],
        SOCIETY_CONTROL: ['Control societario', 'Relaciones de control explícitas; nunca inferidas sólo por proximidad.'],
      };
      const [title, body] = labels[family] || [family, 'Familia de relación pendiente de contrato gobernado.'];
      grid.append(node('article', { class: 'atlas-v2-rel-hyp-card' }, [sourceBadge('PENDIENTE'), node('strong', { text: title }), node('p', { text: body })]));
    });
    panel.append(grid);
    return panel;
  }

  function methodView() {
    const rules = [
      ['Relación documentada', 'Existe una arista sólo cuando una fuente publicada contiene un vínculo observable entre dos nodos.'],
      ['Convergencia', 'Varias dimensiones pueden reforzar la prioridad de revisar una relación, pero no se confunden con fuentes independientes.'],
      ['Hipótesis', 'Una coincidencia o similitud es una pista para investigar y no una arista hasta corroboración.'],
      ['Identidad', 'Los cruces automáticos sólo usan identificadores exactos. La similitud nominal no consolida personas o empresas.'],
      ['Riesgo', 'Ninguna arista transmite automáticamente score, sanción, contexto territorial o condición AML/FT a su contraparte.'],
      ['Trazabilidad', 'Fuente, snapshot, fechas, monto y hallazgos deben permanecer visibles al profundizar.'],
    ];
    return node('div', { class: 'atlas-v2-rel-method' }, rules.map(([title, body]) => node('article', { class: 'atlas-v2-rel-panel' }, [node('h2', { text: title }), node('p', { text: body })])));
  }

  function loading() {
    return node('div', { class: 'atlas-v2-rel-loading', role: 'status' }, [node('strong', { text: 'Consultando relaciones gobernadas…' }), node('span', { text: 'El navegador no reconstruye el universo ni crea aristas por su cuenta.' })]);
  }

  function errorView(error, api, state) {
    const code = String(error?.code || 'READ_FAILED');
    const noSession = code === 'NO_SESSION';
    return node('div', { class: 'atlas-v2-rel-error' }, [
      node('strong', { text: noSession ? 'La sesión v2 no está disponible en este contexto.' : 'No fue posible consultar Relaciones v2.' }),
      node('p', { text: noSession ? 'La superficie está conectada al contrato gobernado, pero este contexto no entregó un token autenticado.' : String(error?.message || error) }),
      node('button', { class: 'atlas-v2-button', type: 'button', text: 'Reintentar', onclick: () => navigate(api, state, {}) }),
      error?.traceId ? node('small', { text: `Trace ${error.traceId}` }) : null,
    ]);
  }

  async function loadDocumented(api, host, state, signal) {
    const data = global.AtlasV2Access.data().relations;
    if (!hasFocus(state)) {
      if (!state.q) {
        clear(host);
        host.append(empty('Busca o abre una entidad', 'Puedes llegar desde Entidad 360 o Gasto Público conservando el RUT/proveedor/comprador en la URL.'));
        return;
      }
      const search = await data.search(state.q, { signal, route: 'relaciones:search', query: { limit: 30 } });
      clear(host); host.append(searchResults(api, state, search)); return;
    }

    const neighborhood = await data.neighborhood(focusObject(state), { signal, route: 'relaciones:neighborhood', query: { limit: 30 } });
    const detail = state.relation ? await data.detail(state.relation, { signal, route: 'relaciones:detail' }) : null;
    clear(host);
    if (neighborhood.center) host.append(nodeSummary(api, state, neighborhood.center));
    host.append(networkGraph(api, state, neighborhood), edgeList(api, state, neighborhood), evidencePanel(neighborhood));
    if (detail) host.append(relationDetail(api, state, detail));
    if (neighborhood.availability) {
      const unavailable = Object.entries(neighborhood.availability).filter(([, ready]) => ready === false).map(([key]) => key);
      if (unavailable.length) host.append(node('div', { class: 'atlas-v2-rel-rule' }, [node('strong', { text: 'Cobertura pendiente. ' }), `Aún no se publican como relaciones v2: ${unavailable.join(', ')}.`]));
    }
  }

  async function load(api, host, state, serial, signal) {
    const relations = global.AtlasV2Access?.data?.().relations;
    if (!relations) throw new Error('ATLAS v2 relations client no está disponible');
    if (state.tab === 'method') {
      clear(host); host.append(methodView()); return;
    }
    if (state.tab === 'documented') {
      await loadDocumented(api, host, state, signal); return;
    }
    if (state.tab === 'convergences') {
      const result = await relations.convergences(focusObject(state), { signal, route: 'relaciones:convergences', query: { limit: 40, min_convergence: 2 } });
      if (serial !== renderSerial || signal.aborted || !host.isConnected) return;
      clear(host); host.append(convergenceView(api, state, result)); return;
    }
    if (state.tab === 'hypotheses') {
      const result = await relations.hypotheses({ signal, route: 'relaciones:hypotheses' });
      if (serial !== renderSerial || signal.aborted || !host.isConnected) return;
      clear(host); host.append(hypothesesView(result));
    }
  }

  function render(container, route, api) {
    injectStyle();
    controller?.abort();
    controller = new AbortController();
    const serial = ++renderSerial;
    const state = routeState(route);
    container.append(pageHead(state), searchBox(api, state), semanticStrip(), tabs(api, state));
    const host = node('div', { class: 'atlas-v2-rel-host' }, [loading()]);
    container.append(host);
    const signal = controller.signal;
    void load(api, host, state, serial, signal).catch(error => {
      if (serial !== renderSerial || signal.aborted || !host.isConnected) return;
      clear(host); host.append(errorView(error, api, state));
    });
  }

  function register() {
    if (!global.AtlasV2Shell?.registerSurface) return false;
    global.AtlasV2Shell.registerSurface('relaciones', render);
    global.__ATLAS_V2_RELATIONS_SURFACE__ = Object.freeze({ installed: true, route: 'relaciones', mode: 'native-v2' });
    return true;
  }

  if (!register()) global.addEventListener('atlas:v2-shell-ready', register, { once: true });
})(window);
