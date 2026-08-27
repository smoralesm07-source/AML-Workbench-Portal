/* ATLAS AML · Sanciones · IER drawer refinement
 * Enforces proportional factor bars from the displayed points/max values and
 * removes the redundant identity-evidence block from the sanctions drawer.
 * 0464.2: persistent late-mount observer + hard width/flex enforcement.
 */
(() => {
  'use strict';

  const ROOT_SELECTOR = '.sv12-approved';
  let raf = 0;

  function parseLocaleNumber(value) {
    const raw = String(value ?? '').trim().replace(/\s+/g, '');
    if (!raw) return NaN;
    if (raw.includes(',') && raw.includes('.')) {
      const decimal = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? ',' : '.';
      const thousands = decimal === ',' ? /\./g : /,/g;
      return Number(raw.replace(thousands, '').replace(decimal, '.'));
    }
    return Number(raw.replace(',', '.'));
  }

  function parseScore(text) {
    const m = String(text || '').match(/(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    const points = parseLocaleNumber(m[1]);
    const max = parseLocaleNumber(m[2]);
    if (!Number.isFinite(points) || !Number.isFinite(max) || max <= 0) return null;
    return {
      points,
      max,
      pct: Math.max(0, Math.min(100, points / max * 100))
    };
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
      const value = factor.querySelector(':scope > b') || factor.querySelector('b');
      const track = factor.querySelector('.factorTrack');
      const fill = track?.querySelector(':scope > i') || factor.querySelector('.factorTrack i');
      if (!value || !track || !fill) return;

      const score = parseScore(value.textContent);
      if (!score) return;

      const pctText = score.pct.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
      const signature = `${score.points}|${score.max}|${pctText}`;
      if (fill.dataset.ierSignature === signature) return;

      /* Width must win over legacy/global rules that previously made every bar
         visually full. Zero stays truly empty; max score reaches 100%. */
      fill.style.setProperty('width', `${pctText}%`, 'important');
      fill.style.setProperty('flex', '0 0 auto', 'important');
      fill.style.setProperty('min-width', '0', 'important');
      fill.style.setProperty('max-width', '100%', 'important');
      fill.style.setProperty('transform', 'none', 'important');
      fill.dataset.ierPct = pctText;
      fill.dataset.ierSignature = signature;

      track.style.setProperty('display', 'block', 'important');
      track.style.setProperty('overflow', 'hidden', 'important');
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', String(score.max));
      track.setAttribute('aria-valuenow', String(score.points));
      track.setAttribute('aria-valuetext', `${score.points} de ${score.max} (${score.pct.toFixed(1)}%)`);
    });
  }

  function apply() {
    raf = 0;
    document.querySelectorAll(ROOT_SELECTOR).forEach(root => {
      removeIdentityEvidence(root);
      fixFactorBars(root);
    });
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(apply);
  }

  /* The sanctions view is mounted lazily. Observe the document for the whole
     session instead of giving up after a 15 s polling window. */
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      if (mutation.addedNodes.length || mutation.removedNodes.length) {
        schedule();
        return;
      }
    }
  });

  function install() {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    schedule();
    window.addEventListener('hashchange', schedule);
    window.addEventListener('popstate', schedule);
    window.ATLAS_SANCTIONS_IER_REFINEMENT = {
      version: '0464.2',
      apply: schedule,
      proportionalBars: true,
      persistentLateMount: true,
      identityEvidenceRemoved: true
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
