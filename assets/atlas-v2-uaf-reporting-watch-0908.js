'use strict';

(function installAtlasV2UafReportingWatch(global) {
  if (global.__ATLAS_V2_UAF_REPORTING_WATCH_0908__) return;
  global.__ATLAS_V2_UAF_REPORTING_WATCH_0908__ = Object.freeze({ installed: true, revision: '2026-09-08-4' });

  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const REPORTABILITY_URL = new URL('../data/uaf_reportability_sector_2025.json', scriptBase).href;
  const NO_REGISTERED = Object.freeze([
    'ADMINISTRADORAS DE FONDOS MUTUOS',
    'ARMAS: PERSONAS QUE SE DEDIQUEN A LA FABRICACIÓN DE ARMAS',
    'CLUBES DE CAZA',
    'CLUBES DE PESCA',
    'FINTEC: PRESTADORES DEL SERVICIO DE PLATAFORMA DE FINANCIAMIENTO COLECTIVO',
    'FINTEC: PROVEEDORES DEL SERVICIO DE INICIACIÓN DE PAGOS',
  ]);

  let reportabilityPromise = null;
  let observer = null;
  let installTimer = null;
  let activeDialog = null;

  function node(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = String(value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else el.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).flat().forEach(child => {
      if (child == null) return;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return el;
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function fmt(value) {
    const n = number(value);
    return n == null ? '—' : n.toLocaleString('es-CL');
  }

  function sectorName(row) {
    return String(row?.sector_name || row?.sector_official || row?.sector_canonical || row?.etiqueta || 'Sector sin nombre').trim();
  }

  async function reportability() {
    if (!reportabilityPromise) {
      reportabilityPromise = fetch(REPORTABILITY_URL, { cache: 'no-store', headers: { accept: 'application/json' } })
        .then(response => {
          if (!response.ok) throw new Error(`REPORTABILITY_${response.status}`);
          return response.json();
        })
        .catch(error => {
          reportabilityPromise = null;
          throw error;
        });
    }
    return reportabilityPromise;
  }

  function groupsFrom(data) {
    const sectors = Array.isArray(data?.sectors) ? data.sectors : [];

    const silent = sectors
      .filter(row => (number(row.registered_so_2025) || 0) > 0 && (row.silence_5y === true || number(row.ros_total_2021_2025) === 0))
      .sort((a, b) => sectorName(a).localeCompare(sectorName(b), 'es'));

    const low = sectors
      .filter(row => {
        const registered = number(row.registered_so_2025) || 0;
        const total = number(row.ros_total_2021_2025);
        const intensity = number(row.ros_per_100_so_2025);
        const ros2025 = number(row.ros_2025);
        if (!registered || total == null || row.silence_5y === true || total === 0) return false;
        return (intensity != null && intensity < 1) || (ros2025 === 0 && total > 0);
      })
      .sort((a, b) => sectorName(a).localeCompare(sectorName(b), 'es'));

    const noRegistered = NO_REGISTERED.map(name => ({ sector_name: name, registered_so_2025: 0 }));

    return [
      {
        id: 'no-registered',
        tone: 'no-registered',
        icon: '◎',
        title: 'Sectores sin inscritos',
        rows: noRegistered,
        note: 'Categorías sin sujetos inscritos observados en el padrón UAF actual.',
      },
      {
        id: 'low',
        tone: 'low',
        icon: '↘',
        title: 'Sectores con baja reportabilidad',
        rows: low,
        note: 'Sectores con baja intensidad de ROS o rezago en la serie observada.',
      },
      {
        id: 'silent',
        tone: 'silent',
        icon: '∅',
        title: 'Sectores sin ROS en la serie',
        rows: silent,
        note: 'Sectores con inscritos y 0 ROS agregados en la ventana 2021–2025.',
      },
    ];
  }

  function closeDialog() {
    if (!activeDialog) return;
    const dialog = activeDialog;
    activeDialog = null;
    document.removeEventListener('keydown', onDialogKeydown);
    dialog.remove();
  }

  function onDialogKeydown(event) {
    if (event.key === 'Escape') closeDialog();
  }

  function openSectorDialog(group) {
    closeDialog();

    const backdrop = node('div', {
      class: `atlas-v2-uaf-sector-dialog-backdrop ${group.tone}`,
      role: 'presentation',
      onclick: event => { if (event.target === backdrop) closeDialog(); },
    });

    const dialog = node('section', {
      class: 'atlas-v2-uaf-sector-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': `atlas-v2-uaf-sector-dialog-${group.id}`,
    });

    const closeButton = node('button', {
      type: 'button',
      class: 'atlas-v2-uaf-sector-dialog-close',
      'aria-label': 'Cerrar ficha de sectores',
      text: '×',
      onclick: closeDialog,
    });

    const list = node('div', { class: 'atlas-v2-uaf-sector-dialog-list' }, group.rows.map((row, index) =>
      node('div', { class: 'atlas-v2-uaf-sector-dialog-row' }, [
        node('span', { class: 'atlas-v2-uaf-sector-dialog-index', text: String(index + 1).padStart(2, '0') }),
        node('span', { class: 'atlas-v2-uaf-sector-dialog-name', text: sectorName(row), title: sectorName(row) }),
      ])
    ));

    dialog.append(
      node('header', { class: 'atlas-v2-uaf-sector-dialog-head' }, [
        node('span', { class: 'atlas-v2-uaf-sector-dialog-icon', text: group.icon, 'aria-hidden': 'true' }),
        node('div', { class: 'atlas-v2-uaf-sector-dialog-title' }, [
          node('h4', { id: `atlas-v2-uaf-sector-dialog-${group.id}`, text: group.title }),
          node('p', { text: `${fmt(group.rows.length)} sectores` }),
        ]),
        closeButton,
      ]),
      list,
      node('p', { class: 'atlas-v2-uaf-sector-dialog-note', text: group.note }),
    );

    backdrop.append(dialog);
    document.body.append(backdrop);
    activeDialog = backdrop;
    document.addEventListener('keydown', onDialogKeydown);
    requestAnimationFrame(() => closeButton.focus());
  }

  function compactCard(group) {
    return node('button', {
      type: 'button',
      class: `atlas-v2-uaf-watch-card ${group.tone}`,
      title: `Ver ${fmt(group.rows.length)} sectores`,
      'aria-label': `${group.title}: ${fmt(group.rows.length)}. Ver sectores`,
      onclick: () => openSectorDialog(group),
    }, [
      node('span', { class: 'atlas-v2-uaf-watch-icon', text: group.icon, 'aria-hidden': 'true' }),
      node('span', { class: 'atlas-v2-uaf-watch-card-title', text: group.title }),
      node('b', { class: 'atlas-v2-uaf-watch-card-count', text: fmt(group.rows.length) }),
    ]);
  }

  function buildWatch(data) {
    const groups = groupsFrom(data);
    const root = node('section', {
      class: 'atlas-v2-uaf-watch',
      'aria-label': 'Brechas de cobertura y reportabilidad sectorial UAF',
    });
    root.append(node('div', { class: 'atlas-v2-uaf-watch-grid' }, groups.map(compactCard)));
    return root;
  }

  async function attachToReconciliation(panel) {
    if (!panel || panel.dataset.uafReportingWatch === 'true' || panel.dataset.uafReportingWatch === 'loading') return;
    panel.dataset.uafReportingWatch = 'loading';
    try {
      const data = await reportability();
      if (!panel.isConnected) return;
      panel.append(buildWatch(data));
      panel.dataset.uafReportingWatch = 'true';
    } catch (error) {
      panel.dataset.uafReportingWatch = 'error';
      console.error('[ATLAS v2] UAF reporting watch failed', error);
    }
  }

  function install() {
    const route = global.AtlasV2Shell?.currentRoute?.();
    if (route?.id && route.id !== 'explorar') return;
    const panels = Array.from(document.querySelectorAll('.atlas-v2-studio-recon-panel'));
    panels.forEach(panel => { void attachToReconciliation(panel); });
  }

  function scheduleInstall() {
    clearTimeout(installTimer);
    installTimer = setTimeout(install, 30);
  }

  function startObserver() {
    scheduleInstall();
    if (observer) return;
    const root = document.getElementById('atlas-v2-root');
    if (!root) return;
    observer = new MutationObserver(scheduleInstall);
    observer.observe(root, { childList: true, subtree: true });
    global.addEventListener('hashchange', scheduleInstall);
  }

  global.addEventListener('atlas:v2-shell-ready', startObserver);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  else startObserver();
})(window);
