'use strict';

(function installAtlasV2AnalyticsShell(global) {
  if (global.AtlasV2Shell?.installed) return;

  const STORAGE_SAVED = 'atlas-v2-saved-views';
  const STORAGE_THEME = 'atlas-v2-theme';
  const ROUTES = Object.freeze([
    { id: 'explorar', label: 'Explorar', icon: '01', group: 'analysis', description: 'Qué está pasando' },
    { id: 'universos', label: 'Universos', icon: '02', group: 'analysis', description: 'Poblaciones y lentes' },
    { id: 'entidad', label: 'Entidad 360', icon: '03', group: 'analysis', description: 'Evidencia de una entidad' },
    { id: 'gasto-publico', label: 'Gasto público', icon: '04', group: 'analysis', description: 'Compras y presupuesto' },
    { id: 'territorio', label: 'Territorio', icon: '05', group: 'analysis', description: 'Contexto geográfico' },
    { id: 'relaciones', label: 'Relaciones', icon: '06', group: 'analysis', description: 'Redes y convergencias' },
    { id: 'vigilancia', label: 'Vigilancia', icon: '07', group: 'analysis', description: 'Reglas guardadas' },
    { id: 'guardados', label: 'Guardados', icon: '08', group: 'utility', description: 'Continuidad opcional' },
    { id: 'metodo', label: 'Método y datos', icon: '09', group: 'utility', description: 'Fuentes y explicabilidad' },
  ]);

  const routeMap = new Map(ROUTES.map(route => [route.id, route]));
  const state = { route: null, commandOpen: false, commandIndex: 0, commandItems: [] };
  const surfaces = new Map();
  let refs = {};
  let toastTimer = null;

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
    const entries = Array.isArray(children) ? children : [children];
    entries.forEach(child => {
      if (child == null) return;
      element.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return element;
  }

  function clear(element) {
    while (element?.firstChild) element.removeChild(element.firstChild);
  }

  function routeFromHash() {
    const raw = String(location.hash || '#/explorar').replace(/^#\/?/, '');
    const [path, queryString = ''] = raw.split('?');
    const segments = path.split('/').filter(Boolean);
    const id = routeMap.has(segments[0]) ? segments[0] : 'explorar';
    return { id, segments, params: new URLSearchParams(queryString), raw };
  }

  function routeUrl(id, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      const text = String(value ?? '').trim();
      if (text) query.set(key, text);
    });
    return `#/${id}${query.size ? `?${query.toString()}` : ''}`;
  }

  function navigate(id, params = {}) {
    location.hash = routeUrl(routeMap.has(id) ? id : 'explorar', params);
  }

  function sectionHeading(title, subtitle) {
    return node('div', { class: 'atlas-v2-section-head' }, [
      node('div', {}, [node('h2', { text: title }), node('p', { text: subtitle })]),
    ]);
  }

  function card(tag, title, description, foot, onClick) {
    return node(onClick ? 'button' : 'article', {
      class: 'atlas-v2-card',
      type: onClick ? 'button' : null,
      onclick: onClick || null,
    }, [
      node('span', { class: 'atlas-v2-card-tag', text: tag }),
      node('h3', { text: title }),
      node('p', { text: description }),
      node('div', { class: 'atlas-v2-card-foot', text: foot }),
    ]);
  }

  function pageHead(eyebrow, title, description) {
    return node('header', { class: 'atlas-v2-pagehead' }, [
      node('div', { class: 'atlas-v2-eyebrow', text: eyebrow }),
      node('h1', { text: title }),
      node('p', { text: description }),
    ]);
  }

  function queryBox() {
    const input = node('input', {
      type: 'search',
      placeholder: 'Buscar RUT, entidad, sector, señal, territorio o pregunta…',
      'aria-label': 'Búsqueda analítica universal',
    });
    const submit = () => handleUniversalQuery(input.value);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
    return node('div', { class: 'atlas-v2-querybox' }, [
      input,
      node('button', { class: 'atlas-v2-button primary', type: 'button', text: 'Explorar', onclick: submit }),
    ]);
  }

  function looksLikeRut(value) {
    return /^\d{1,2}\.?\d{3}\.?\d{3}-?[0-9kK]$/.test(String(value || '').replace(/\s/g, ''));
  }

  function handleUniversalQuery(value) {
    const query = String(value || '').trim();
    if (!query) return openCommand();
    if (looksLikeRut(query)) return navigate('entidad', { rut: query });

    const normalized = query.toLocaleLowerCase('es-CL');
    if (/compra|proveedor|licit|gasto|presupuesto/.test(normalized)) return navigate('gasto-publico', { q: query });
    if (/comuna|region|territor|geograf/.test(normalized)) return navigate('territorio', { q: query });
    if (/relaci|red|vincul|representante|socio/.test(normalized)) return navigate('relaciones', { q: query });
    if (/osfl|sii|uaf|res|sancion|sector|universo/.test(normalized)) return navigate('universos', { q: query });
    navigate('universos', { q: query });
  }

  function renderExplore(container) {
    container.append(
      pageHead('ATLAS · EXPLORACIÓN', '¿Qué está pasando?', 'Empieza por una pregunta, una entidad o un universo. Atlas debe permitir descubrir anomalías y convergencias sin abrir, tomar ni administrar un caso.'),
      queryBox(),
    );

    const questions = node('section', { class: 'atlas-v2-section' }, [
      sectionHeading('Entrar por una pregunta', 'Atajos hacia capacidades analíticas, no hacia productores de datos.'),
      node('div', { class: 'atlas-v2-grid' }, [
        card('CONCENTRACIÓN', '¿Dónde se concentra algo inusual?', 'Busca concentración por proveedor, comprador, sector, territorio o relaciones.', 'Abrir análisis poblacional →', () => navigate('universos', { lens: 'concentracion' })),
        card('CAMBIO', '¿Qué cambió recientemente?', 'Contrasta snapshots publicados y prioriza movimientos materiales, no simples novedades.', 'Abrir vigilancia analítica →', () => navigate('vigilancia', { lens: 'cambios' })),
        card('CONVERGENCIA', '¿Dónde coinciden señales independientes?', 'Cruza evidencia de distintas fuentes sin confundir contexto con riesgo ni duplicar el mismo hecho.', 'Abrir relaciones →', () => navigate('relaciones', { lens: 'convergencia' })),
        card('ENTIDAD', '¿Qué sabemos de esta entidad?', 'Reúne identidad, situación tributaria, UAF, RES, sanciones, compras públicas y relaciones.', 'Abrir Entidad 360 →', () => navigate('entidad')),
      ]),
    ]);

    const workspaces = node('section', { class: 'atlas-v2-section' }, [
      sectionHeading('Espacios analíticos', 'Profundiza sin perder el contexto de la pregunta original.'),
      node('div', { class: 'atlas-v2-grid three' }, [
        card('UNIVERSOS', 'Analítica poblacional', 'Filtra y compara universos SII, UAF, OSFL y RES usando fuentes como lentes explícitos.', 'Universos →', () => navigate('universos')),
        card('GASTO PÚBLICO', 'Compras y presupuesto', 'Explora proveedores, compradores, pares, hallazgos, materialidad y contexto presupuestario.', 'Gasto público →', () => navigate('gasto-publico')),
        card('TERRITORIO', 'Contexto geográfico', 'Busca patrones regionales y comunales sin heredar automáticamente el contexto como riesgo de una entidad.', 'Territorio →', () => navigate('territorio')),
      ]),
    ]);

    const guardrail = node('div', { class: 'atlas-v2-notice' }, [
      node('strong', { text: 'Principio de producto. ' }),
      'Explorar es libre; seguir es opcional. Guardar una vista, seguir una entidad o registrar un resultado nunca será requisito para acceder al análisis.',
    ]);

    container.append(questions, workspaces, guardrail);
  }

  function renderUniverses(container, route) {
    const query = route.params.get('q') || '';
    container.append(pageHead('ANÁLISIS POBLACIONAL', 'Universos', 'Analiza poblaciones completas y cambia de lente sin saltar entre aplicaciones independientes. SII, UAF, OSFL, RES y sanciones conservan su semántica propia.'));
    container.append(node('div', { class: 'atlas-v2-lensbar' }, [
      node('span', { class: 'atlas-v2-chip' }, [node('strong', { text: 'SII' }), ' · tributario']),
      node('span', { class: 'atlas-v2-chip' }, [node('strong', { text: 'UAF' }), ' · registro SO']),
      node('span', { class: 'atlas-v2-chip' }, [node('strong', { text: 'OSFL' }), ' · universo observado']),
      node('span', { class: 'atlas-v2-chip' }, [node('strong', { text: 'RES' }), ' · sociedades']),
      node('span', { class: 'atlas-v2-chip' }, [node('strong', { text: 'Sanciones' }), ' · eventos administrativos']),
    ]));
    container.append(node('section', { class: 'atlas-v2-section' }, [
      sectionHeading('Formas de interrogar el universo', query ? `Consulta recibida: “${query}”` : 'La futura vista conectará filtros y agregados a read models gobernados.'),
      node('div', { class: 'atlas-v2-grid' }, [
        card('DISTRIBUCIÓN', 'Caracterizar', 'Composición sectorial, territorial, tributaria y temporal del universo seleccionado.', 'Sin gestión de casos'),
        card('OUTLIERS', 'Detectar inusualidades', 'Extremos, concentraciones, crecimientos abruptos y combinaciones poco frecuentes.', 'Hipótesis, no conclusiones'),
        card('COMPARACIÓN', 'Comparar pares', 'Benchmark de entidades contra grupos comparables y universos de referencia.', 'Grano explícito'),
        card('DRILL-DOWN', 'Profundizar', 'Desde un agregado hacia entidades y evidencia, manteniendo filtros y ruta en la URL.', 'Estado compartible'),
      ]),
    ]));
  }

  function renderEntity(container, route) {
    const rut = route.params.get('rut');
    container.append(pageHead('EXPEDIENTE ANALÍTICO', 'Entidad 360', rut ? `Preparado para consultar el RUT ${rut} mediante el contrato v2 de Entidad 360.` : 'Busca una entidad para reunir evidencia de múltiples fuentes sin convertir la ficha en una tarea.'));
    if (!rut) container.append(queryBox());
    container.append(node('div', { class: 'atlas-v2-lensbar' }, [
      node('span', { class: 'atlas-v2-chip', text: 'Identidad' }), node('span', { class: 'atlas-v2-chip', text: 'Tributario' }),
      node('span', { class: 'atlas-v2-chip', text: 'UAF' }), node('span', { class: 'atlas-v2-chip', text: 'RES' }),
      node('span', { class: 'atlas-v2-chip', text: 'Sanciones' }), node('span', { class: 'atlas-v2-chip', text: 'Gasto público' }),
      node('span', { class: 'atlas-v2-chip', text: 'Relaciones' }), node('span', { class: 'atlas-v2-chip', text: 'Cronología' }),
    ]));
    if (rut) container.append(node('div', { class: 'atlas-v2-empty' }, [node('strong', { text: 'Punto de montaje listo para SINGLE_READ_V2' }), node('span', { text: 'La Foundation no inventa datos: el siguiente corte conecta este contenedor al contrato ejecutivo existente y deja los drill-downs como lecturas acotadas.' })]));
  }

  function renderPublicSpend(container) {
    container.append(pageHead('WORKSPACE ESPECIALIZADO', 'Gasto público', 'El primer vertical con frontera v2 real. Compras públicas y ejecución presupuestaria permanecen como dominios distintos y sólo convergen cuando el grano está documentado.'));
    container.append(node('section', { class: 'atlas-v2-section' }, [
      sectionHeading('Capacidades', 'La nueva shell consumirá el data-client v2 existente; no habrá URLs raw ni tablas operacionales como API de navegador.'),
      node('div', { class: 'atlas-v2-grid' }, [
        card('PROVEEDORES', 'Concentración y comportamiento', 'Ranking, concentración, hallazgos y comparación de proveedores.', 'Drill-down acotado'),
        card('COMPRADORES', 'Patrones del comprador', 'Distribución, recurrencia, concentración y pares comprador-proveedor.', 'Drill-down acotado'),
        card('HALLAZGOS', 'Señales explicables', 'Familias de hallazgos con severidad, evidencia y trazabilidad metodológica.', 'No equivale a irregularidad'),
        card('PRESUPUESTO', 'Contexto de ejecución', 'Ejecución presupuestaria como dominio propio, sin sumar montos incompatibles con compras.', 'Comparabilidad explícita'),
      ]),
    ]));
  }

  function renderTerritory(container) {
    container.append(pageHead('CONTEXTO', 'Territorio', 'Explora patrones regionales y comunales como contexto analítico. Una característica territorial nunca se hereda automáticamente como riesgo individual.'));
    container.append(node('div', { class: 'atlas-v2-empty' }, [node('strong', { text: 'Superficie v2 reservada' }), node('span', { text: 'Se migrará sobre agregados precomputados y filtros persistentes, retirando la reconstrucción client-side del universo.' })]));
  }

  function renderRelations(container) {
    container.append(pageHead('CONVERGENCIA', 'Relaciones', 'Busca conexiones entre entidades, representantes, domicilios, proveedores, compradores y otras evidencias sin convertir coincidencias débiles en identidad.'));
    container.append(node('section', { class: 'atlas-v2-section' }, [
      sectionHeading('Tres niveles de lectura', 'La relación debe conservar fuente, tipo, evidencia y confianza.'),
      node('div', { class: 'atlas-v2-grid three' }, [
        card('DIRECTA', 'Relación documentada', 'Vínculo explícito observado en una fuente con identidad suficientemente resuelta.', 'Evidencia primaria'),
        card('CONVERGENCIA', 'Múltiples señales', 'Fuentes independientes coinciden sobre una entidad o grupo sin sumar señales redundantes.', 'Explicabilidad'),
        card('HIPÓTESIS', 'Relación por revisar', 'Coincidencia útil para explorar, pero insuficiente para afirmar identidad, control o conducta.', 'No inferir de más'),
      ]),
    ]));
  }

  function renderWatch(container) {
    container.append(pageHead('VIGILANCIA OPCIONAL', 'Vigilancia', 'Guarda reglas o preguntas analíticas y vuelve cuando algo material cambie. No existe obligación de transformar una alerta en caso.'));
    container.append(node('div', { class: 'atlas-v2-empty' }, [node('strong', { text: 'Sin cola obligatoria' }), node('span', { text: 'Las alertas futuras serán entradas de exploración. El analista podrá abrirlas, ignorarlas, guardarlas o registrar un resultado, sin workflow impuesto.' })]));
  }

  function savedViews() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_SAVED) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function persistSaved(items) {
    localStorage.setItem(STORAGE_SAVED, JSON.stringify(items.slice(0, 50)));
  }

  function saveCurrentView() {
    const current = routeFromHash();
    const route = routeMap.get(current.id);
    const items = savedViews();
    const url = location.hash || '#/explorar';
    const next = [{ id: `${Date.now()}`, title: route?.label || 'Vista Atlas', url, savedAt: new Date().toISOString() }, ...items.filter(item => item.url !== url)];
    persistSaved(next);
    toast('Vista guardada. No se creó ningún caso ni tarea.');
    if (state.route?.id === 'guardados') render();
  }

  function renderSaved(container) {
    const items = savedViews();
    container.append(pageHead('CONTINUIDAD OPCIONAL', 'Guardados', 'Vistas e hipótesis a las que quieres volver. Guardar algo no crea propietario, estado, tarea, plazo ni SLA.'));
    if (!items.length) {
      container.append(node('div', { class: 'atlas-v2-empty' }, [node('strong', { text: 'Todavía no guardaste vistas' }), node('span', { text: 'Puedes usar “Guardar vista” desde cualquier análisis. Es sólo un marcador personal de continuidad.' })]));
      return;
    }
    const grid = node('div', { class: 'atlas-v2-grid three' });
    items.forEach(item => grid.append(card('VISTA GUARDADA', item.title, item.url, new Date(item.savedAt).toLocaleString('es-CL'), () => { location.hash = item.url; })));
    container.append(node('section', { class: 'atlas-v2-section' }, [sectionHeading('Vistas guardadas', `${items.length} elementos locales en esta Foundation.`), grid]));
  }

  function renderMethod(container) {
    container.append(pageHead('EXPLICABILIDAD', 'Método y datos', 'La metodología deja de estar dispersa bajo cada tarjeta. Esta superficie concentrará contratos, cobertura, frescura, fórmulas, guardarraíles y versiones.'));
    container.append(node('section', { class: 'atlas-v2-section' }, [
      sectionHeading('Principios que no se negocian', 'Reglas que deben acompañar cualquier nueva señal o visualización.'),
      node('div', { class: 'atlas-v2-grid' }, [
        card('GUARDARRAÍL', 'Prioridad ≠ probabilidad', 'Los scores ordenan revisión o atención; no estiman automáticamente probabilidad de LA/FT.', 'Metodología'),
        card('GUARDARRAÍL', 'Ausencia de dato ≠ cero', 'No observar una fuente o un atributo no equivale a confirmar su inexistencia.', 'Calidad'),
        card('GUARDARRAÍL', 'Contexto no se hereda', 'Una señal sectorial o territorial no se transfiere automáticamente a una entidad.', 'Inferencia'),
        card('GUARDARRAÍL', 'Sanción ≠ LA/FT', 'Un evento administrativo es evidencia contextual y no prueba actividad de lavado o financiamiento.', 'Semántica'),
      ]),
    ]));
    container.append(node('div', { class: 'atlas-v2-statusline' }, [
      node('span', { text: 'Arquitectura: ATLAS v2' }),
      node('span', { text: 'Navegador: delgado' }),
      node('span', { text: 'Estado: URL' }),
      node('span', { text: 'Seguimiento: opcional' }),
    ]));
  }

  const defaultRenderers = Object.freeze({
    explorar: renderExplore,
    universos: renderUniverses,
    entidad: renderEntity,
    'gasto-publico': renderPublicSpend,
    territorio: renderTerritory,
    relaciones: renderRelations,
    vigilancia: renderWatch,
    guardados: renderSaved,
    metodo: renderMethod,
  });

  function render() {
    state.route = routeFromHash();
    const route = routeMap.get(state.route.id);
    refs.title.textContent = route.label;
    refs.navButtons.forEach((button, id) => {
      if (id === route.id) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    clear(refs.content);
    const custom = surfaces.get(route.id);
    const renderer = custom || defaultRenderers[route.id] || renderExplore;
    renderer(refs.content, state.route, api);
    refs.content.focus({ preventScroll: true });
  }

  function commandCatalog(query = '') {
    const q = String(query || '').trim().toLocaleLowerCase('es-CL');
    const items = ROUTES.map(route => ({ label: route.label, detail: route.description, route: route.id, keywords: `${route.label} ${route.description}`.toLocaleLowerCase('es-CL') }));
    if (looksLikeRut(query)) items.unshift({ label: `Abrir ${query} en Entidad 360`, detail: 'Buscar por RUT', route: 'entidad', params: { rut: query }, keywords: query.toLocaleLowerCase('es-CL') });
    return q ? items.filter(item => item.keywords.includes(q) || item.label.toLocaleLowerCase('es-CL').includes(q)).slice(0, 12) : items.slice(0, 12);
  }

  function paintCommands(query = '') {
    state.commandItems = commandCatalog(query);
    state.commandIndex = Math.min(state.commandIndex, Math.max(0, state.commandItems.length - 1));
    clear(refs.commandList);
    state.commandItems.forEach((item, index) => {
      refs.commandList.append(node('button', {
        type: 'button',
        class: 'atlas-v2-command-item',
        dataset: { active: index === state.commandIndex ? 'true' : 'false' },
        onclick: () => chooseCommand(index),
      }, [
        node('span', {}, [node('b', { text: item.label }), node('small', { text: item.detail })]),
        node('span', { class: 'atlas-v2-command-key', text: '↵' }),
      ]));
    });
  }

  function openCommand() {
    state.commandOpen = true;
    state.commandIndex = 0;
    refs.commandBackdrop.dataset.open = 'true';
    refs.commandInput.value = '';
    paintCommands();
    refs.commandInput.focus();
  }

  function closeCommand() {
    state.commandOpen = false;
    refs.commandBackdrop.dataset.open = 'false';
  }

  function chooseCommand(index) {
    const item = state.commandItems[index];
    if (!item) return;
    closeCommand();
    navigate(item.route, item.params || {});
  }

  function commandKeydown(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); state.commandIndex = Math.min(state.commandIndex + 1, state.commandItems.length - 1); paintCommands(refs.commandInput.value); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); state.commandIndex = Math.max(0, state.commandIndex - 1); paintCommands(refs.commandInput.value); }
    else if (event.key === 'Enter') { event.preventDefault(); chooseCommand(state.commandIndex); }
    else if (event.key === 'Escape') { event.preventDefault(); closeCommand(); }
  }

  function applyTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(STORAGE_THEME, next);
    if (refs.themeButton) refs.themeButton.textContent = next === 'dark' ? 'Claro' : 'Oscuro';
  }

  function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  }

  function toast(message) {
    refs.toast.textContent = message;
    refs.toast.dataset.show = 'true';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { refs.toast.dataset.show = 'false'; }, 2600);
  }

  function buildNav() {
    const nav = node('nav', { class: 'atlas-v2-nav', 'aria-label': 'Navegación principal de Atlas v2' });
    const buttons = new Map();
    const groups = [
      { id: 'analysis', label: 'Analizar' },
      { id: 'utility', label: 'Continuidad y método' },
    ];
    groups.forEach((group, groupIndex) => {
      if (groupIndex) nav.append(node('div', { class: 'atlas-v2-nav-separator' }));
      nav.append(node('div', { class: 'atlas-v2-nav-label', text: group.label }));
      ROUTES.filter(route => route.group === group.id).forEach(route => {
        const button = node('button', { type: 'button', onclick: () => navigate(route.id) }, [
          node('span', { class: 'atlas-v2-nav-icon', text: route.icon }),
          node('span', { text: route.label }),
        ]);
        buttons.set(route.id, button);
        nav.append(button);
      });
    });
    return { nav, buttons };
  }

  function mount(target = document.getElementById('atlas-v2-root')) {
    if (!target) throw new Error('ATLAS v2 shell root is missing');
    clear(target);
    const { nav, buttons } = buildNav();
    const title = node('div', { class: 'atlas-v2-topbar-title', text: 'Explorar' });
    const content = node('main', { class: 'atlas-v2-content', tabindex: '-1' });
    const themeButton = node('button', { class: 'atlas-v2-button', type: 'button', onclick: toggleTheme });
    const commandButton = node('button', { class: 'atlas-v2-button', type: 'button', onclick: openCommand }, [
      node('span', { text: 'Buscar Atlas' }), node('span', { class: 'atlas-v2-kbd', text: '⌘K' }),
    ]);
    const saveButton = node('button', { class: 'atlas-v2-button', type: 'button', text: 'Guardar vista', onclick: saveCurrentView });

    const sidebar = node('aside', { class: 'atlas-v2-sidebar' }, [
      node('div', { class: 'atlas-v2-brand' }, [node('strong', { text: 'ATLAS' }), node('span', { text: 'Inteligencia analítica · v2' })]),
      nav,
      node('div', { class: 'atlas-v2-sidebar-foot', text: 'Exploración primero · seguimiento opcional' }),
    ]);
    const topbar = node('header', { class: 'atlas-v2-topbar' }, [title, node('div', { class: 'atlas-v2-topbar-spacer' }), commandButton, saveButton, themeButton]);
    const main = node('div', { class: 'atlas-v2-main' }, [topbar, content]);
    target.append(node('div', { class: 'atlas-v2-app' }, [sidebar, main]));

    const commandInput = node('input', { type: 'search', placeholder: 'Ir a una sección o escribir un RUT…', 'aria-label': 'Comandos de Atlas' });
    const commandList = node('div', { class: 'atlas-v2-command-list' });
    const commandBackdrop = node('div', { class: 'atlas-v2-command-backdrop', dataset: { open: 'false' } }, [
      node('div', { class: 'atlas-v2-command', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Buscador de comandos' }, [commandInput, commandList]),
    ]);
    const toastNode = node('div', { class: 'atlas-v2-toast', role: 'status', 'aria-live': 'polite', dataset: { show: 'false' } });
    document.body.append(commandBackdrop, toastNode);

    refs = { title, content, themeButton, commandInput, commandList, commandBackdrop, toast: toastNode, navButtons: buttons };
    commandInput.addEventListener('input', () => { state.commandIndex = 0; paintCommands(commandInput.value); });
    commandInput.addEventListener('keydown', commandKeydown);
    commandBackdrop.addEventListener('click', event => { if (event.target === commandBackdrop) closeCommand(); });

    const storedTheme = localStorage.getItem(STORAGE_THEME);
    applyTheme(storedTheme === 'light' ? 'light' : 'dark');
    if (!location.hash) history.replaceState(null, '', routeUrl('explorar'));
    global.addEventListener('hashchange', render);
    document.addEventListener('keydown', event => {
      const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k';
      if (shortcut) { event.preventDefault(); state.commandOpen ? closeCommand() : openCommand(); }
      else if (event.key === 'Escape' && state.commandOpen) closeCommand();
    });
    render();
  }

  function registerSurface(routeId, renderer) {
    if (!routeMap.has(routeId)) throw new Error(`Unknown ATLAS v2 route: ${routeId}`);
    if (typeof renderer !== 'function') throw new TypeError('Surface renderer must be a function');
    surfaces.set(routeId, renderer);
    if (state.route?.id === routeId) render();
  }

  const api = Object.freeze({
    installed: true,
    mount,
    navigate,
    routeUrl,
    currentRoute: () => ({ ...routeFromHash() }),
    registerSurface,
    saveCurrentView,
    openCommand,
    routes: ROUTES,
  });

  global.AtlasV2Shell = api;
})(window);
