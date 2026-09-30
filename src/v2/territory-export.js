'use strict';

(function installAtlasV2TerritoryExport(global) {
  if (global.__ATLAS_V2_TERRITORY_EXPORT__) return;
  global.__ATLAS_V2_TERRITORY_EXPORT__ = Object.freeze({ installed: true, version: '1.0.0' });

  const STYLE_ID = 'atlas-v2-territory-export-style';
  const ROW_CLASS = 'atlas-v2-territory-method-export-row';
  const ACTION_CLASS = 'atlas-v2-territory-export-action';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${ROW_CLASS}{display:grid;grid-template-columns:minmax(0,1fr) 176px;gap:12px;align-items:stretch;margin-top:0}
      .${ROW_CLASS}>.atlas-v2-territory-footnote{margin:0;padding:11px 13px;border:1px solid var(--atlas-border);border-radius:12px;background:linear-gradient(180deg,rgba(15,29,44,.82),rgba(11,23,36,.82));min-width:0}
      .${ACTION_CLASS}{display:flex;align-items:center;justify-content:center;min-width:0}
      .atlas-v2-territory-export-button{width:100%;height:100%;min-height:44px;border:1px solid rgba(128,151,174,.22);border-radius:12px;background:linear-gradient(180deg,rgba(18,32,48,.78),rgba(12,24,38,.78));color:var(--atlas-text-2);font:inherit;font-size:.72rem;font-weight:700;letter-spacing:.01em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;transition:border-color .16s ease,background .16s ease,color .16s ease,transform .16s ease}
      .atlas-v2-territory-export-button:hover{border-color:rgba(240,122,63,.48);background:rgba(240,122,63,.07);color:var(--atlas-text);transform:translateY(-1px)}
      .atlas-v2-territory-export-button:focus-visible{outline:2px solid rgba(240,122,63,.72);outline-offset:2px}
      .atlas-v2-territory-export-button:disabled{opacity:.58;cursor:wait;transform:none}
      .atlas-v2-territory-export-button svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}
      @media(max-width:820px){.${ROW_CLASS}{grid-template-columns:1fr}.${ACTION_CLASS}{min-height:46px}.atlas-v2-territory-export-button{height:46px}}
    `;
    document.head.appendChild(style);
  }

  function csvValue(value) {
    if (value == null) return '';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value).replace('.', ',') : '';
    const text = String(value).replace(/\r?\n/g, ' ').trim();
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function scoreBand(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Sin cálculo';
    if (n >= 80) return 'Muy alto';
    if (n >= 60) return 'Alto';
    if (n >= 40) return 'Medio';
    if (n >= 20) return 'Bajo';
    return 'Muy bajo';
  }

  function primitiveKeys(rows) {
    const keys = new Set();
    rows.forEach(row => Object.entries(row || {}).forEach(([key, value]) => {
      if (value == null || ['string','number','boolean'].includes(typeof value)) keys.add(key);
    }));
    return [...keys];
  }

  async function readAllCommunes() {
    if (!global.AtlasV2Territory?.communes) throw new Error('El contrato territorial no está disponible');
    const pages = await Promise.all([
      global.AtlasV2Territory.communes({ limit: 200, offset: 0, route: 'territorio:export:0' }),
      global.AtlasV2Territory.communes({ limit: 200, offset: 200, route: 'territorio:export:200' })
    ]);
    const map = new Map();
    pages.flatMap(page => page.items || []).forEach(item => {
      const key = String(item.commune_code || `${item.region || ''}|${item.commune || ''}`);
      map.set(key, item);
    });
    return {
      rows: [...map.values()],
      generatedAt: pages.map(page => page.generatedAt || page.meta?.snapshot).find(Boolean) || new Date().toISOString()
    };
  }

  function analyticalRows(rows, generatedAt) {
    const ranked = rows
      .filter(row => Number.isFinite(Number(row.igr)))
      .slice()
      .sort((a,b) => Number(b.igr) - Number(a.igr));
    const rankMap = new Map(ranked.map((row, index) => [String(row.commune_code || `${row.region}|${row.commune}`), index + 1]));
    const total = ranked.length;
    return rows.map(row => {
      const key = String(row.commune_code || `${row.region}|${row.commune}`);
      const rank = rankMap.get(key) || null;
      const percentile = rank && total > 1 ? Math.round(100 * (1 - (rank - 1) / (total - 1))) : null;
      return {
        commune_code: row.commune_code ?? '',
        commune: row.commune ?? '',
        region: row.region ?? '',
        igr: row.igr ?? '',
        igr_band: scoreBand(row.igr),
        national_rank: rank ?? '',
        national_rank_total: total,
        national_percentile: percentile ?? '',
        threat: row.threat ?? '',
        vulnerability: row.vulnerability ?? '',
        mapping_quality: row.mapping_quality ?? '',
        uaf_observed: row.uaf_observed ?? '',
        snapshot_at: generatedAt || '',
        ...row
      };
    });
  }

  function buildCsv(rows, generatedAt) {
    const data = analyticalRows(rows, generatedAt);
    const preferred = [
      'commune_code','commune','region','igr','igr_band','national_rank','national_rank_total','national_percentile',
      'threat','vulnerability','mapping_quality','uaf_observed','snapshot_at'
    ];
    const extras = primitiveKeys(data).filter(key => !preferred.includes(key)).sort((a,b) => a.localeCompare(b, 'es'));
    const columns = [...preferred, ...extras];
    const header = columns.join(';');
    const body = data
      .sort((a,b) => String(a.region).localeCompare(String(b.region),'es') || String(a.commune).localeCompare(String(b.commune),'es'))
      .map(row => columns.map(column => csvValue(row[column])).join(';'))
      .join('\r\n');
    return `\uFEFF${header}\r\n${body}`;
  }

  function downloadCsv(csv) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0,10);
    link.href = url;
    link.download = `atlas_territorio_riesgo_comunal_${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function icon() {
    const wrap = document.createElement('span');
    wrap.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11"></path><path d="m8 10 4 4 4-4"></path><path d="M5 18v2h14v-2"></path></svg>';
    return wrap.firstChild;
  }

  function installButton() {
    const footnote = document.querySelector('.atlas-v2-territory-workbench > .atlas-v2-territory-footnote');
    if (!footnote || footnote.closest(`.${ROW_CLASS}`)) return;

    const row = document.createElement('div');
    row.className = ROW_CLASS;
    footnote.parentNode.insertBefore(row, footnote);
    row.appendChild(footnote);

    const action = document.createElement('div');
    action.className = ACTION_CLASS;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'atlas-v2-territory-export-button';
    button.title = 'Descargar riesgo comunal y variables territoriales para análisis en Excel o modelos externos';
    button.setAttribute('aria-label', 'Exportar riesgo comunal a CSV');
    const label = document.createElement('span');
    label.textContent = 'Exportar CSV';
    button.append(icon(), label);
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      label.textContent = 'Generando…';
      try {
        const { rows, generatedAt } = await readAllCommunes();
        if (!rows.length) throw new Error('No hay comunas disponibles para exportar');
        downloadCsv(buildCsv(rows, generatedAt));
        label.textContent = `${rows.length} comunas`;
        setTimeout(() => { if (button.isConnected) label.textContent = 'Exportar CSV'; }, 1800);
      } catch (error) {
        console.error('[ATLAS Territorio] CSV export failed', error);
        label.textContent = 'Error al exportar';
        setTimeout(() => { if (button.isConnected) label.textContent = 'Exportar CSV'; }, 2200);
      } finally {
        button.disabled = false;
      }
    });
    action.appendChild(button);
    row.appendChild(action);
  }

  ensureStyles();
  installButton();
  const observer = new MutationObserver(() => installButton());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})(window);
