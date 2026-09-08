'use strict';

(function installAtlasV2SectorWorkspaces(global) {
  if (global.__ATLAS_V2_SECTOR_WORKSPACES_0908__) return;
  global.__ATLAS_V2_SECTOR_WORKSPACES_0908__ = Object.freeze({ installed: true, revision: '2026-09-08-1' });

  const WORKSPACES = Object.freeze([
    {
      id: 'inmobiliarias-conservadores',
      label: 'INMOBILIARIAS Y CONSERVADORES',
      icon: '↳',
      aliases: ['inmobili', 'conservador', 'corredor de propiedades', 'bienes raices'],
    },
    {
      id: 'casinos-juego',
      label: 'CASINOS DE JUEGO',
      icon: '↳',
      aliases: ['casino', 'juegos de azar', 'juego'],
    },
    {
      id: 'casas-cambio-transferencias',
      label: 'CASAS DE CAMBIO Y TRANSFERENCIAS',
      icon: '↳',
      aliases: ['casa de cambio', 'casas de cambio', 'transferencia de dinero', 'transferencias de dinero', 'remesa'],
    },
  ]);

  const resolvedKeys = new Map();

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es-CL')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function buttonLabel(button) {
    return normalize(button?.textContent || '');
  }

  function scoreItem(item, workspace) {
    const haystack = normalize(`${item?.label || ''} ${item?.key || ''}`);
    if (!haystack) return 0;
    const exact = normalize(workspace.label);
    if (haystack === exact) return 100;
    if (haystack.includes(exact) || exact.includes(haystack)) return 80;
    let score = 0;
    workspace.aliases.forEach(alias => {
      const token = normalize(alias);
      if (token && haystack.includes(token)) score += token.length >= 10 ? 18 : 10;
    });
    return score;
  }

  async function resolveSectorKey(workspace) {
    if (resolvedKeys.has(workspace.id)) return resolvedKeys.get(workspace.id);
    const api = global.AtlasV2Universes;
    if (!api?.distribution) return workspace.label;
    try {
      const response = await api.distribution('UAF', 'sector', { limit: 100, route: `sector-workspace:${workspace.id}` });
      const items = Array.isArray(response?.items) ? response.items : [];
      const ranked = items
        .map(item => ({ item, score: scoreItem(item, workspace) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score);
      const key = String(ranked[0]?.item?.key || ranked[0]?.item?.label || workspace.label).trim();
      resolvedKeys.set(workspace.id, key);
      return key;
    } catch (error) {
      console.warn('[ATLAS v2] sector shortcut resolution degraded', workspace.id, error?.code || error?.message || error);
      return workspace.label;
    }
  }

  async function openWorkspace(workspace, button) {
    if (!global.AtlasV2Shell?.navigate) return;
    const original = button.querySelector('.atlas-v2-sector-shortcut-label')?.textContent || workspace.label;
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    const label = button.querySelector('.atlas-v2-sector-shortcut-label');
    if (label) label.textContent = 'ABRIENDO SECTOR…';
    try {
      const key = await resolveSectorKey(workspace);
      global.AtlasV2Shell.navigate('universos', {
        lens: 'UAF',
        dimension: 'sector',
        key,
        workspace: workspace.id,
      });
    } finally {
      button.removeAttribute('aria-busy');
      button.disabled = false;
      if (label) label.textContent = original;
    }
  }

  function createShortcut(workspace) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'atlas-v2-sector-shortcut';
    button.dataset.atlasSectorWorkspace = workspace.id;
    button.title = `Abrir espacio analítico: ${workspace.label}`;
    button.setAttribute('aria-label', `Abrir espacio analítico ${workspace.label}`);

    const icon = document.createElement('span');
    icon.className = 'atlas-v2-sector-shortcut-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = workspace.icon;

    const label = document.createElement('span');
    label.className = 'atlas-v2-sector-shortcut-label';
    label.textContent = workspace.label;

    button.append(icon, label);
    button.addEventListener('click', () => { void openWorkspace(workspace, button); });
    return button;
  }

  function install() {
    const nav = document.querySelector('.atlas-v2-nav');
    if (!nav || nav.dataset.atlasSectorWorkspaces === 'true') return false;

    const routeButtons = Array.from(nav.querySelectorAll(':scope > button'));
    const exploreButton = routeButtons.find(button => buttonLabel(button) === 'explorar');
    if (!exploreButton) return false;

    const fragment = document.createDocumentFragment();
    WORKSPACES.forEach(workspace => fragment.append(createShortcut(workspace)));
    exploreButton.after(fragment);
    nav.dataset.atlasSectorWorkspaces = 'true';
    return true;
  }

  function installSoon() {
    if (install()) return;
    [0, 80, 240, 600, 1200].forEach(delay => setTimeout(install, delay));
  }

  global.addEventListener('atlas:v2-shell-ready', installSoon);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installSoon, { once: true });
  else installSoon();
})(window);
