'use strict';

(function installAtlasV2Viz(global) {
  if (global.AtlasV2Viz?.installed) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';

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

  function svgNode(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value != null) el.setAttribute(key, String(value));
    });
    return el;
  }

  function numeric(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function label(value) {
    return String(value ?? '').trim() || 'Sin etiqueta';
  }

  function horizontalBars(items = [], options = {}) {
    const rows = (Array.isArray(items) ? items : [])
      .map((item, index) => ({ ...item, value: numeric(item?.value), _index: index }))
      .filter(item => item.value >= 0)
      .slice(0, Math.max(1, Math.min(Number(options.limit || 8), 16)));
    const max = Math.max(1, ...rows.map(item => item.value));
    const root = node('div', { class: `atlas-v2-viz atlas-v2-viz-bars ${options.className || ''}`.trim(), role: 'list' });

    if (!rows.length) {
      root.append(node('div', { class: 'atlas-v2-viz-empty', text: options.emptyText || 'Sin datos comparables en esta lectura.' }));
      return root;
    }

    rows.forEach(item => {
      const ratio = Math.max(0.015, item.value / max);
      const widthPct = Math.max(1.5, Math.min(100, ratio * 100));
      const interactive = typeof options.onSelect === 'function';
      const row = node(interactive ? 'button' : 'div', {
        class: 'atlas-v2-viz-bar-row',
        ...(interactive ? { type: 'button', onclick: () => options.onSelect(item) } : {}),
        role: interactive ? undefined : 'listitem',
        title: item.title || label(item.label),
      });
      row.append(
        node('div', { class: 'atlas-v2-viz-bar-label' }, [
          node('strong', { text: label(item.label) }),
          item.detail ? node('span', { text: item.detail }) : null,
        ]),
        node('div', { class: 'atlas-v2-viz-bar-track' }, [
          node('span', { class: `atlas-v2-viz-bar-fill ${item.tone || ''}`.trim(), style: `width:${widthPct.toFixed(2)}%` }),
        ]),
        node('b', { class: 'atlas-v2-viz-bar-value', text: item.display ?? String(item.value) }),
      );
      root.append(row);
    });
    return root;
  }

  function lineChart(items = [], options = {}) {
    const rows = (Array.isArray(items) ? items : [])
      .map((item, index) => ({ ...item, value: numeric(item?.value), _index: index }))
      .filter(item => item.label != null)
      .slice(-Math.max(2, Math.min(Number(options.limit || 12), 24)));
    const root = node('div', { class: `atlas-v2-viz atlas-v2-viz-line ${options.className || ''}`.trim() });
    if (!rows.length) {
      root.append(node('div', { class: 'atlas-v2-viz-empty', text: options.emptyText || 'Sin serie disponible.' }));
      return root;
    }

    const width = 760;
    const height = 230;
    const pad = { left: 42, right: 18, top: 18, bottom: 38 };
    const values = rows.map(row => row.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    const x = index => pad.left + (rows.length === 1 ? 0 : index * ((width - pad.left - pad.right) / (rows.length - 1)));
    const y = value => pad.top + (max - value) * ((height - pad.top - pad.bottom) / range);
    const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': options.ariaLabel || 'Serie temporal interactiva' });

    [0, .5, 1].forEach(frac => {
      const gy = pad.top + frac * (height - pad.top - pad.bottom);
      svg.append(svgNode('line', { x1: pad.left, y1: gy, x2: width - pad.right, y2: gy, class: 'atlas-v2-viz-gridline' }));
    });

    const points = rows.map((row, index) => `${x(index)},${y(row.value)}`).join(' ');
    svg.append(svgNode('polyline', { points, class: 'atlas-v2-viz-line-path', fill: 'none' }));

    rows.forEach((row, index) => {
      const cx = x(index);
      const cy = y(row.value);
      const interactive = typeof options.onSelect === 'function';
      const group = svgNode('g', {
        class: 'atlas-v2-viz-line-point',
        tabindex: interactive ? '0' : '-1',
        role: interactive ? 'button' : 'img',
        'aria-label': `${label(row.label)}: ${row.display ?? row.value}`,
      });
      if (interactive) group.append(svgNode('circle', { cx, cy, r: 14, class: 'atlas-v2-viz-line-hit', 'aria-hidden': 'true' }));
      group.append(svgNode('circle', { cx, cy, r: 6, class: 'atlas-v2-viz-line-dot', 'aria-hidden': 'true' }));
      if (interactive) {
        const activate = () => options.onSelect(row);
        group.addEventListener('click', activate);
        group.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
        });
      }
      const title = svgNode('title');
      title.textContent = `${label(row.label)} · ${row.display ?? row.value}`;
      group.append(title);
      svg.append(group);
      if (index === 0 || index === rows.length - 1 || rows.length <= 7) {
        const tx = svgNode('text', { x: cx, y: height - 14, class: 'atlas-v2-viz-axis-label', 'text-anchor': 'middle', 'aria-hidden': 'true' });
        tx.textContent = label(row.label);
        svg.append(tx);
      }
    });

    root.append(svg);
    if (options.caption) root.append(node('div', { class: 'atlas-v2-viz-caption', text: options.caption }));
    return root;
  }

  function segmented(items = [], options = {}) {
    const rows = (Array.isArray(items) ? items : []).map(item => ({ ...item, value: Math.max(0, numeric(item?.value)) }));
    const total = rows.reduce((sum, item) => sum + item.value, 0);
    const root = node('div', { class: `atlas-v2-viz atlas-v2-viz-segmented ${options.className || ''}`.trim() });
    const track = node('div', { class: 'atlas-v2-viz-segment-track', role: 'list' });
    if (!total) {
      root.append(node('div', { class: 'atlas-v2-viz-empty', text: options.emptyText || 'Sin distribución disponible.' }));
      return root;
    }
    rows.filter(item => item.value > 0).forEach((item, index) => {
      const widthPct = Math.max(.5, Math.min(100, 100 * item.value / total));
      const interactive = typeof options.onSelect === 'function';
      track.append(node(interactive ? 'button' : 'span', {
        class: `atlas-v2-viz-segment tone-${index % 4}`,
        ...(interactive ? { type: 'button', onclick: () => options.onSelect(item) } : {}),
        style: `width:${widthPct.toFixed(3)}%`,
        title: `${label(item.label)} · ${item.display ?? item.value}`,
        'aria-label': `${label(item.label)}: ${item.display ?? item.value}`,
      }));
    });
    const legend = node('div', { class: 'atlas-v2-viz-legend' });
    rows.filter(item => item.value > 0).forEach((item, index) => {
      const interactive = typeof options.onSelect === 'function';
      legend.append(node(interactive ? 'button' : 'span', {
        class: 'atlas-v2-viz-legend-item',
        ...(interactive ? { type: 'button', onclick: () => options.onSelect(item) } : {}),
      }, [
        node('i', { class: `tone-${index % 4}` }),
        node('span', { text: label(item.label) }),
        node('b', { text: item.display ?? String(item.value) }),
      ]));
    });
    root.append(track, legend);
    return root;
  }

  global.AtlasV2Viz = Object.freeze({ installed: true, horizontalBars, lineChart, segmented });
})(window);
