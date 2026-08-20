/* ATLAS AML · Sanciones · SO classification correction
 * Distinguishes legal/statutory SO status from observed UAF registration.
 * Banks and every sector already recognized by the sanctions UAF taxonomy are
 * treated as SO, while `inscrito_uaf` remains untouched so Atlas never invents
 * an individual UAF-registration match that is not visible in the governed data.
 */
(() => {
  'use strict';

  const OFFICIAL_SO_SECTORS = new Set([
    'BANCOS',
    'COMPANIAS DE SEGURO',
    'EMPRESAS DE FACTORAJE FACTORING',
    'CASAS DE CAMBIO',
    'EMPRESAS DE LEASING',
    'CASINOS DE JUEGO',
    'CORREDORES DE SEGUROS',
    'ADMINISTRADORAS GENERALES DE FONDOS',
    'ADMINISTRADORAS DE MUTUOS HIPOTECARIOS',
    'EMPRESAS DE TRANSFERENCIA DE DINERO',
    'NOTARIOS',
    'CONSERVADORES',
    'AGENTES DE ADUANA',
    'COOPERATIVAS DE AHORRO Y CREDITO',
    'CORREDORES DE BOLSA DE VALORES',
    'ADMINISTRADORES DE FONDOS DE PENSIONES'
  ]);

  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

  const isOfficialSector = subject => OFFICIAL_SO_SECTORS.has(norm(subject?.sector_analitico));
  const band = score => score >= 70 ? 'Crítico' : score >= 50 ? 'Alto' : score >= 30 ? 'Medio' : 'Bajo';

  function correctSubject(subject) {
    if (!subject || subject.inscrito_uaf || !isOfficialSector(subject)) return false;

    subject.so_sector_normativo = true;
    subject.nivel = 'N1_SO_SANCIONADO';
    subject.hipotesis = 'NO_APLICA';
    subject.hipotesis_fuerza = 0;
    subject.screening_prioridad = '—';
    subject.hipotesis_detalle = `Sector «${subject.sector_analitico}» reconocido como sujeto obligado. La inscripción individual UAF no es visible en el cruce gobernado actual.`;

    const factors = Array.isArray(subject.ier_factores) ? subject.ier_factores : [];
    const gap = factors.find(f => f?.key === 'brecha');
    if (gap) {
      const points = Number(gap.points || 0);
      if (points > 0) subject.ier = Math.max(0, Number(subject.ier || 0) - points);
      gap.points = 0;
      gap.value = 'NO_APLICA';
      subject.ier_banda = band(Number(subject.ier || 0));
    }
    return true;
  }

  function relabel(root, bundle) {
    if (!root || !bundle) return;
    const byId = new Map((bundle.subjects || []).map(s => [String(s.subject_id), s]));

    root.querySelectorAll('.entityRow[data-id], .recent[data-id]').forEach(row => {
      const subject = byId.get(String(row.dataset.id || ''));
      if (!subject?.so_sector_normativo || subject.inscrito_uaf) return;
      row.querySelectorAll('.badge.so').forEach(b => { b.textContent = 'SO · sector obligado'; });
    });

    const kpiLabels = root.querySelectorAll('.klabel');
    kpiLabels.forEach(el => {
      if (el.textContent.trim() === 'SO inscritos sancionados') el.textContent = 'SO sancionados';
    });
    const firstKpi = root.querySelector('.kpi');
    if (firstKpi) {
      const registered = (bundle.subjects || []).filter(s => s.inscrito_uaf).length;
      const statutory = (bundle.subjects || []).filter(s => s.so_sector_normativo && !s.inscrito_uaf).length;
      const detail = firstKpi.querySelector('.kdetail');
      if (detail) detail.innerHTML = `<b>${registered.toLocaleString('es-CL')}</b> con inscripción UAF visible · <b>${statutory.toLocaleString('es-CL')}</b> reconocidos por sector obligado`;
    }

    const stats = root.querySelector('#listStats');
    if (stats) stats.innerHTML = stats.innerHTML.replace(/SO inscritos/g, 'SO');

    const tip = root.querySelector('#tip');
    if (tip && /SO inscritos/.test(tip.innerHTML)) tip.innerHTML = tip.innerHTML.replace(/SO inscritos/g, 'SO');

    const drawer = root.querySelector('#drawer');
    if (drawer?.classList.contains('on')) {
      const title = drawer.querySelector('#drawerHead h2')?.textContent?.trim();
      const subject = (bundle.subjects || []).find(s => (s.uaf_razon_social || s.nombre || '').trim() === title);
      if (subject?.so_sector_normativo && !subject.inscrito_uaf) {
        drawer.querySelectorAll('.badge.so').forEach(b => { b.textContent = 'SO · sector obligado'; });
        const status = drawer.querySelector('.statusBox p');
        if (status) status.textContent = subject.hipotesis_detalle;
      }
    }
  }

  function apply(bundle) {
    if (!bundle || !Array.isArray(bundle.subjects)) return bundle;
    let corrected = 0;
    for (const subject of bundle.subjects) if (correctSubject(subject)) corrected += 1;
    bundle.soClassificationCorrection = { corrected, policy: 'REGISTERED_OR_STATUTORY_SECTOR' };

    const root = document.querySelector('.sv12-approved');
    const activePeriod = root?.querySelector('#periodFilters [data-period].on') || root?.querySelector('#periodFilters [data-period="all"]');
    if (corrected && activePeriod) activePeriod.click();
    relabel(root, bundle);

    if (root) {
      const observer = new MutationObserver(() => relabel(root, bundle));
      observer.observe(root, { childList: true, subtree: true, characterData: true });
      window.setTimeout(() => observer.disconnect(), 120000);
    }
    return bundle;
  }

  function install() {
    const api = window.AML_SANCTIONS_V12_APPROVED;
    if (!api || typeof api.reload !== 'function' || api.__soClassificationFixed) return false;
    const original = api.reload.bind(api);
    const correctedReload = async (...args) => apply(await original(...args));
    api.reload = correctedReload;
    api.__soClassificationFixed = true;
    api.soClassificationPolicy = 'REGISTERED_OR_STATUTORY_SECTOR';
    try { window.loadSanctions = correctedReload; } catch {}
    return true;
  }

  if (!install()) {
    const timer = window.setInterval(() => {
      if (install()) window.clearInterval(timer);
    }, 50);
    window.setTimeout(() => window.clearInterval(timer), 10000);
  }
})();
