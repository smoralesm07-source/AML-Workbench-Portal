(function(){
  'use strict';

  const VIEW = 'pep-discovery';
  const TABLE = 'aml_pep_discovery_snapshot';
  const VERSION = '0501';
  const state = { checkedAt: null, status: 'idle', detail: null };
  let wrappedNavigate = null;

  function dbClient(){
    try { return typeof sb !== 'undefined' ? sb : (window.sb || null); }
    catch (_error) { return window.sb || null; }
  }

  function setView(){
    try { if (window.state && typeof window.state === 'object') window.state.view = VIEW; }
    catch (_error) {}
  }

  function setNavActive(){
    document.querySelectorAll('.v019-nav-btn').forEach((button) => {
      const active = button.dataset.atlasPepView === '1';
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current','page');
      else if (button.getAttribute('aria-current') === 'page') button.removeAttribute('aria-current');
    });
    try { window.AtlasPepDiscovery?.ensureNav?.(); } catch (_error) {}
  }

  function renderShell(){
    try {
      if (typeof window.shell === 'function') {
        window.shell('Personas y control','PEP, beneficiario final y compras públicas con trazabilidad y cobertura explícita.');
      }
    } catch (_error) {}
    setNavActive();
  }

  function renderLoading(){
    const host = document.querySelector('#content');
    if (!host) return;
    host.innerHTML = '<div class="atlas-pep atlas-pep-loading">Comprobando disponibilidad del snapshot privado…</div>';
  }

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function operationalCard(kind, title, value, note){
    return `<article class="atlas-pep-kpi ${kind || ''}"><span class="lab">${escapeHtml(title)}</span><b>${escapeHtml(value)}</b><small>${escapeHtml(note)}</small></article>`;
  }

  function renderPending(reason, technical){
    const host = document.querySelector('#content');
    if (!host) return;
    const isAuth = reason === 'AUTH';
    const isError = reason === 'ERROR';
    const title = isAuth ? 'Sesión de datos no disponible' : isError ? 'No fue posible comprobar el snapshot' : 'Fuente preparada · snapshot pendiente';
    const text = isAuth
      ? 'La vista está instalada, pero no puede leer el canal privado de datos en esta sesión. El resto de ATLAS permanece operativo.'
      : isError
        ? 'La vista permanece disponible, pero la comprobación del canal RLS no terminó correctamente. No se muestran ceros ni datos de demostración.'
        : 'Personas y control está operativa. Aún no existe un corte materializado en el canal privado; por eso no se muestran KPIs ni casos hasta recibir evidencia real.';
    const sourceValue = isAuth ? 'No disponible' : isError ? 'Con incidencia' : 'RLS listo';
    const snapshotValue = reason === 'EMPTY' ? 'Pendiente' : '—';
    const checked = state.checkedAt ? new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'medium'}).format(state.checkedAt) : '—';
    host.innerHTML = `<section class="atlas-pep" data-atlas-pep-availability="${VERSION}">
      <div class="atlas-pep-hero">
        <div class="atlas-pep-hero-row">
          <div>
            <div class="atlas-pep-kicker">Análisis · Personas, propiedad y Estado</div>
            <h2>Personas y control</h2>
            <p>${escapeHtml(text)}</p>
          </div>
          <div class="atlas-pep-status">
            <span class="atlas-pep-pill ${reason === 'EMPTY' ? 'partial' : 'review'}">${escapeHtml(title)}</span>
            <span class="atlas-pep-pill">${escapeHtml(checked)}</span>
          </div>
        </div>
        <div class="atlas-pep-flow" aria-label="Cadena analítica pendiente de materialización">
          <div class="atlas-pep-flow-step"><small>1 · Resolver PEP</small><b>—</b><span>esperando corte gobernado</span></div>
          <div class="atlas-pep-flow-step"><small>2 · Propiedad</small><b>—</b><span>sin inferir ausencia</span></div>
          <div class="atlas-pep-flow-step"><small>3 · Compras</small><b>—</b><span>sin asumir cero compras</span></div>
          <div class="atlas-pep-flow-step"><small>4 · Lectura</small><b>—</b><span>sin casos sintéticos</span></div>
        </div>
      </div>

      <div class="atlas-pep-kpis">
        ${operationalCard('', 'Canal privado', sourceValue, 'Supabase con RLS; anon sin acceso')}
        ${operationalCard('', 'Snapshot latest', snapshotValue, 'ATLAS_PEP_DISCOVERY_LATEST_V1')}
        ${operationalCard('', 'Datos persona–empresa', 'Privados', 'no se publican en GitHub Pages')}
        ${operationalCard('', 'PEP', 'No adversa', 'aporta cero por sí misma al score AML')}
        ${operationalCard('', 'Resultados', 'Sin inventar', 'missing no equivale a cero')}
        ${operationalCard('', 'ATLAS', 'Operativo', 'esta fuente no bloquea otros módulos')}
      </div>

      <div class="atlas-pep-grid">
        <article class="atlas-pep-panel">
          <div class="atlas-pep-panel-head"><div><h3>Estado operativo</h3><p>La vista separa disponibilidad de aplicación y disponibilidad de datos.</p></div></div>
          <div class="atlas-pep-bars">
            <div class="atlas-pep-bar"><span class="atlas-pep-bar-label">Interfaz Personas y control</span><div class="atlas-pep-track"><div class="atlas-pep-fill" style="--w:100%"></div></div><span class="atlas-pep-bar-value">Disponible</span></div>
            <div class="atlas-pep-bar"><span class="atlas-pep-bar-label">Canal RLS</span><div class="atlas-pep-track"><div class="atlas-pep-fill" style="--w:${reason === 'EMPTY' ? '100' : '12'}%"></div></div><span class="atlas-pep-bar-value">${escapeHtml(sourceValue)}</span></div>
            <div class="atlas-pep-bar"><span class="atlas-pep-bar-label">Snapshot analítico</span><div class="atlas-pep-track"><div class="atlas-pep-fill" style="--w:0%"></div></div><span class="atlas-pep-bar-value">${escapeHtml(snapshotValue)}</span></div>
          </div>
        </article>
        <article class="atlas-pep-panel">
          <div class="atlas-pep-panel-head"><div><h3>Qué ocurrirá al recibir datos</h3><p>No requiere una nueva versión de ATLAS.</p></div></div>
          <div class="atlas-pep-note"><strong>Activación automática.</strong> Cuando exista la fila privada <code>latest</code>, esta misma ruta abrirá la vista completa con PEP, BF, cobertura ChileCompra, materialidad, filtros y caminos de propiedad.</div>
        </article>
      </div>

      <div class="atlas-pep-empty">
        <div class="ico">↻</div>
        <h3>${escapeHtml(title)}</h3>
        <p>No interpretamos la ausencia del snapshot como ausencia de PEP, beneficiarios finales, proveedores o contratación pública.</p>
        <button type="button" id="atlas-pep-availability-retry">Comprobar nuevamente</button>
      </div>
      ${technical ? `<div class="atlas-pep-note"><strong>Diagnóstico:</strong> ${escapeHtml(technical)}</div>` : ''}
    </section>`;
    document.querySelector('#atlas-pep-availability-retry')?.addEventListener('click', () => open(true));
    setNavActive();
  }

  async function inspectSnapshot(){
    const db = dbClient();
    state.checkedAt = new Date();
    if (!db) return { status:'AUTH', detail:'Cliente Supabase no disponible en la sesión actual.' };
    try {
      const { data, error } = await db.from(TABLE).select('snapshot_key,schema_version,source_generated_at,ingested_at').eq('snapshot_key','latest').maybeSingle();
      if (error) return { status:'ERROR', detail:error.message || String(error) };
      if (!data) return { status:'EMPTY', detail:'La tabla privada no contiene todavía la fila latest.' };
      return { status:'READY', data };
    } catch (error) {
      return { status:'ERROR', detail:error?.message || String(error) };
    }
  }

  async function open(force){
    setView();
    renderShell();
    renderLoading();
    const availability = await inspectSnapshot();
    state.status = availability.status;
    state.detail = availability.detail || null;
    if (availability.status === 'READY') {
      try {
        if (window.AtlasPepDiscovery?.open) return await window.AtlasPepDiscovery.open(Boolean(force));
      } catch (error) {
        state.status = 'ERROR';
        state.detail = error?.message || String(error);
        return renderPending('ERROR', state.detail);
      }
    }
    return renderPending(availability.status, availability.detail);
  }

  function install(){
    if (typeof window.navigate !== 'function') return false;
    if (window.navigate.__atlasPepAvailability0501) return true;
    const base = window.navigate;
    const wrapped = async function(view, ...rest){
      if (view === VIEW) return open(false);
      return base.call(this, view, ...rest);
    };
    wrapped.__atlasPepAvailability0501 = true;
    wrapped.__atlasPepAvailabilityBase = base;
    window.navigate = wrapped;
    wrappedNavigate = wrapped;
    try { window.AtlasPepDiscovery?.ensureNav?.(); } catch (_error) {}
    return true;
  }

  function boot(){
    install();
    window.addEventListener('atlas:nav-refresh', () => {
      install();
      try { window.AtlasPepDiscovery?.ensureNav?.(); } catch (_error) {}
    });
  }

  window.AtlasPepAvailability0501 = {
    open,
    inspectSnapshot,
    install,
    status: () => ({...state, wrapped: window.navigate === wrappedNavigate})
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
