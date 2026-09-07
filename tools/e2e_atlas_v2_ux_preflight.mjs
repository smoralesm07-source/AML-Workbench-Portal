import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const baseURL = process.env.ATLAS_E2E_URL || 'http://127.0.0.1:4173/';
const accessToken = process.env.ATLAS_E2E_ACCESS_TOKEN || '';
const refreshToken = process.env.ATLAS_E2E_REFRESH_TOKEN || '';
const expectedEmail = process.env.ATLAS_E2E_EMAIL || '';
if (!accessToken || !refreshToken || !expectedEmail) throw new Error('UX preflight session inputs are missing');

const PULSE_BUDGET_MS = 12000;
const CACHE_BUDGET_MS = 250;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = {
  schema: 'ATLAS_V2_UX_PREFLIGHT_V1',
  release: '2.0.1',
  build: '2001',
  startedAt: new Date().toISOString(),
  pulse: null,
  cache: null,
  responsive: [],
};

try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.sb !== 'undefined' && !!window.sb?.auth?.setSession, null, { timeout: 15000 });
  const set = await page.evaluate(async ({ accessToken, refreshToken }) => {
    const { data, error } = await window.sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return { email: data?.session?.user?.email || null, error: error?.message || null };
  }, { accessToken, refreshToken });
  assert.equal(set.error, null);
  assert.equal(set.email, expectedEmail);

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.AtlasCoreSession?.state?.().status === 'ready' && !!document.querySelector('.atlas-v2-app'), null, { timeout: 15000 });
  await page.evaluate(() => window.AtlasV2Shell.navigate('explorar'));

  const pulseStarted = Date.now();
  await page.waitForFunction(() => {
    const panels = [...document.querySelectorAll('.atlas-v2-explore-grid .atlas-v2-explore-panel')];
    return panels.length === 4 && panels.every(panel => !panel.classList.contains('is-loading'));
  }, null, { timeout: PULSE_BUDGET_MS });
  const pulseMs = Date.now() - pulseStarted;
  const pulse = await page.evaluate(() => ({
    errors: document.querySelectorAll('.atlas-v2-explore-panel.is-error').length,
    panels: document.querySelectorAll('.atlas-v2-explore-panel').length,
    questions: document.querySelectorAll('.atlas-v2-explore-question').length,
    queryPresent: !!document.querySelector('.atlas-v2-explore-query input'),
    diagnostics: window.__ATLAS_V2_EXPLORE_DIAGNOSTICS__ || null,
    federation: window.AtlasV2Session?.state?.() || null,
    text: (document.querySelector('.atlas-v2-content')?.innerText || '').slice(0, 1200),
  }));
  assert.equal(pulse.errors, 0, 'Explore live pulse contains unavailable panels');
  assert.equal(pulse.panels, 4, 'Explore live pulse must render four independent readings');
  assert.equal(pulse.questions, 4, 'Explore should expose four analytical continuation questions');
  assert.equal(pulse.queryPresent, true, 'Explore analytical query box missing');
  assert.equal(pulse.federation?.status, 'ready', 'Federated v2 session was not warmed');
  assert.ok(pulseMs <= PULSE_BUDGET_MS, `live pulse exceeded ${PULSE_BUDGET_MS}ms: ${pulseMs}`);
  assert.match(pulse.text, /Pulso vivo/);
  assert.match(pulse.text, /Cobertura observada/);
  assert.match(pulse.text, /Señales que cambiaron la atención/);
  assert.match(pulse.text, /Contexto geográfico/);
  assert.match(pulse.text, /Compras y ejecución/);
  report.pulse = { ms: pulseMs, diagnostics: pulse.diagnostics, federationStatus: pulse.federation?.status || null };

  const cache = await page.evaluate(async () => {
    const timed = async fn => {
      const start = performance.now();
      const out = await fn();
      return { ms: Math.round(performance.now() - start), cacheStatus: out?.meta?.cacheStatus || null };
    };
    return {
      universes: await timed(() => window.AtlasV2Universes.overview({ route: 'ux-preflight:cache:universes' })),
      territory: await timed(() => window.AtlasV2Territory.overview({ route: 'ux-preflight:cache:territory' })),
      watch: await timed(() => window.AtlasV2Watch.overview({ route: 'ux-preflight:cache:watch' })),
    };
  });
  for (const [name, sample] of Object.entries(cache)) {
    assert.equal(sample.cacheStatus, 'memory', `${name} overview was not reused from live Explore`);
    assert.ok(sample.ms <= CACHE_BUDGET_MS, `${name} memory overview exceeded ${CACHE_BUDGET_MS}ms: ${sample.ms}`);
  }
  report.cache = cache;

  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 1024, height: 768 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const snap = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      panels: document.querySelectorAll('.atlas-v2-explore-panel').length,
      errors: document.querySelectorAll('.atlas-v2-explore-panel.is-error').length,
    }));
    const overflowPx = Math.max(0, snap.scrollWidth - snap.width);
    assert.ok(overflowPx <= 2, `${viewport.name} Explore horizontal overflow ${overflowPx}px`);
    assert.equal(snap.panels, 4, `${viewport.name} lost live pulse panels`);
    assert.equal(snap.errors, 0, `${viewport.name} shows unavailable pulse panel`);
    report.responsive.push({ ...viewport, overflowPx });
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync('e2e-atlas-v2-ux-preflight.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
