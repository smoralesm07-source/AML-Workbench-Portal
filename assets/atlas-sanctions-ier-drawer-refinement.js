/* ATLAS AML · Sanciones · IER drawer refinement
 * Enforces proportional factor bars from the displayed points/max values and
 * removes the redundant identity-evidence block from the sanctions drawer.
 */
(() => {
  'use strict';

  const ROOT_SELECTOR = '.sv12-approved';

  function parseScore(text) {
    const m = String(text || '').replace(',', '.').match(/(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const points = Number(m[1]);
    const max = Number(m[2]);
    if (!Number.isFinite(points) || !Number.isFinite(max) || max <= 0) return null;
    return Math.max(0, Math.min(100, points / max * 100));
  }

  function removeIdentityEvidence(root) {
    root.querySelectorAll('.drawer .dsection').forEach(section => {
      const title = section.querySelector(':scope > .dtitle');
      const label = title?.textContent?.trim().toLowerCase() || '';
      if (label === 'evidencia de identidad') section.remove();
    });
  }

  function fixFactorBars(root) {
    root.querySelectorAll('.drawer .factor').forEach(factor => {
      const value = factor.querySelector('b');
      const fill = factor.querySelector('.factorTrack i');
      if (!value || !fill) return;
      const pct = parseScore(value.textContent);
      if (pct == null) return;
      fill.style.setProperty('width', `${pct.toFixed(2)}%`, 'important');
      fill.dataset.ierPct = pct.toFixed(2);
      const track = fill.closest('.factorTrack');
      if (track) {
        track.setAttribute('role', 'progressbar');
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', '100');
        track.setAttribute('aria-valuenow', String(Math.round(pct)));
      }
    });
  }

  function apply(root = document.querySelector(ROOT_SELECTOR)) {
    if (!root) return;
    removeIdentityEvidence(root);
    fixFactorBars(root);
  }

  const observer = new MutationObserver(mutations => {
    let relevant = false;
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('.drawer, .dsection, .factor') || node.querySelector?.('.drawer, .dsection, .factor')) {
          relevant = true;
          break;
        }
      }
      if (relevant) break;
    }
    if (relevant) apply();
  });

  function install() {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return false;
    apply(root);
    observer.observe(root, { childList: true, subtree: true });
    window.ATLAS_SANCTIONS_IER_REFINEMENT = {
      version: '0464',
      apply: () => apply(root),
      proportionalBars: true,
      identityEvidenceRemoved: true
    };
    return true;
  }

  if (!install()) {
    const timer = window.setInterval(() => {
      if (install()) window.clearInterval(timer);
    }, 100);
    window.setTimeout(() => window.clearInterval(timer), 15000);
  }
})();
