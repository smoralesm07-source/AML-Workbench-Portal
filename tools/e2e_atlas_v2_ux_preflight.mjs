import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const baseURL = process.env.ATLAS_E2E_URL || 'http://127.0.0.1:4173/';
const accessToken = process.env.ATLAS_E2E_ACCESS_TOKEN || '';
const refreshToken = process.env.ATLAS_E2E_REFRESH_TOKEN || '';
const expectedEmail = process.env.ATLAS_E2E_EMAIL || '';
if (!accessToken || !refreshToken || !expectedEmail) throw new Error('UX preflight session inputs are missing');

const EXPLORE_BUDGET_MS = 12000;
const CACHE_BUDGET_MS = 250;
const SEARCH_BUDGET_MS = 10000;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = {
  schema: 'ATLAS_V2_UX_PREFLIGHT_V3',
  release: '2.0.2',
  build: '2002',
  startedAt: new Date().toISOString(),
  explore: null,
  visualNavigation: null,
  entitySearch: null,
  trajectory: null,
  cache: null,
  responsive: [],
};

async function navigate(route, params = {}) {
  await page.evaluate(({ route, params }) => window.AtlasV2Shell.navigate(route, params), { route, params });
}

async function waitForCurrentExplore() {
  await page.waitForFunction(() => {
    const root = document.querySelector('.atlas-v2-studio-home');
    const panels = document.querySelectorAll('.atlas-v2-studio-panel');
    const recon = document.querySelector('.atlas-v2-studio-recon-panel');
    const watch = document.querySelector('.atlas-v2-uaf-watch');
    const cards = document.querySelectorAll('.atlas-v2-uaf-watch-card');
    return !!root && panels.length === 4 && !!recon && !!watch && cards.length === 3;
  }, null, { timeout: EXPLORE_BUDGET_MS });
}

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
  await page.waitForFunction(() => window.AtlasV2Viz?.installed && window.AtlasV2EntitySearch?.installed, null, { timeout: 10000 });
  await navigate('explorar');

  const exploreStarted = Date.now();
  await waitForCurrentExplore();
  const exploreMs = Date.now() - exploreStarted;
  const explore = await page.evaluate(() => ({
    panels: document.querySelectorAll('.atlas-v2-studio-panel').length,
    panelTitles: [...document.querySelectorAll('.atlas-v2-studio-panel-head h2')].map(node => node.textContent?.trim() || ''),
    queryPresent: !!document.querySelector('.atlas-v2-studio-search input'),
    rosChartPresent: !!document.querySelector('.atlas-v2-studio-ros-chart'),
    reconciliationPresent: !!document.querySelector('.atlas-v2-studio-recon-panel'),
    sectorBars: document.querySelectorAll('.atlas-v2-studio-sector-body button.atlas-v2-studio-bar-row').length,
    watchCards: document.querySelectorAll('.atlas-v2-uaf-watch-card').length,
    watchCtas: document.querySelectorAll('.atlas-v2-uaf-watch-cta').length,
    watchTrend: !!document.querySelector('.atlas-v2-uaf-watch-trend-svg'),
    watchDenseKpiRows: document.querySelectorAll('.atlas-v2-uaf-watch-card .atlas-v2-uaf-watch-metrics').length,
    federation: window.AtlasV2Session?.state?.() || null,
  }));
  assert.equal(explore.panels, 4, 'Explore must render the four current studio panels');
  assert.deepEqual(explore.panelTitles, [
    'ROS recibidos por año',
    'Estado de conciliación UAF ↔ SII',
    'Sujetos obligados que requieren gestión',
    'Distribución por sector económico',
  ], 'Explore studio panel titles do not match the current governed surface');
  assert.equal(explore.queryPresent, true, 'Explore compact analytical query box missing');
  assert.equal(explore.rosChartPresent, true, 'Explore ROS chart missing');
  assert.equal(explore.reconciliationPresent, true, 'Explore UAF↔SII reconciliation panel missing');
  assert.ok(explore.sectorBars >= 1, 'Explore sector distribution must expose at least one navigable bar');
  assert.equal(explore.watchCards, 3, 'UAF sector watch must render exactly three compact analytical cards');
  assert.equal(explore.watchCtas, 3, 'Each UAF sector watch card must expose one detail control');
  assert.equal(explore.watchTrend, true, 'Low-reportability card must expose the 2021–2025 trend');
  assert.equal(explore.watchDenseKpiRows, 0, 'Dense KPI strips must not return inside the compact sector cards');
  assert.equal(explore.federation?.status, 'ready', 'Federated v2 session was not warmed');
  assert.ok(exploreMs <= EXPLORE_BUDGET_MS, `Explore exceeded ${EXPLORE_BUDGET_MS}ms: ${exploreMs}`);
  report.explore = {
    ms: exploreMs,
    panelTitles: explore.panelTitles,
    watchCards: explore.watchCards,
    watchCtas: explore.watchCtas,
    sectorBars: explore.sectorBars,
    federationStatus: explore.federation?.status || null,
  };

  // Current Explore visuals must remain navigation controls, not decoration.
  const firstUniverseBar = page.locator('.atlas-v2-studio-sector-body button.atlas-v2-studio-bar-row').first();
  assert.ok(await firstUniverseBar.count(), 'Current sector visual navigation control missing');
  const clickedLabel = (await firstUniverseBar.locator('.atlas-v2-studio-bar-copy strong').textContent())?.trim() || null;
  await firstUniverseBar.click();
  await page.waitForFunction(() => window.AtlasV2Shell?.currentRoute?.().id === 'universos', null, { timeout: 5000 });
  const visualRoute = await page.evaluate(() => ({ id: window.AtlasV2Shell.currentRoute().id, hash: location.hash }));
  assert.equal(visualRoute.id, 'universos');
  assert.match(visualRoute.hash, /lens=UAF/, 'Sector bar did not preserve the UAF lens in URL state');
  report.visualNavigation = { clickedLabel, route: visualRoute.hash };

  await navigate('explorar');
  await waitForCurrentExplore();
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
    assert.equal(sample.cacheStatus, 'memory', `${name} overview was not reused from current Explore`);
    assert.ok(sample.ms <= CACHE_BUDGET_MS, `${name} memory overview exceeded ${CACHE_BUDGET_MS}ms: ${sample.ms}`);
  }
  report.cache = cache;

  // Cross-source search must recover a press-only entity and open it without a RUT.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await navigate('entidad');
  await page.waitForSelector('.atlas-v2-entity-search input', { timeout: 5000 });
  const entityInput = page.locator('.atlas-v2-entity-search input');
  const searchStarted = Date.now();
  await entityInput.fill('Corte Superior Nacional');
  await page.waitForSelector('.atlas-v2-e360-search-result', { timeout: SEARCH_BUDGET_MS });
  const searchMs = Date.now() - searchStarted;
  const pressResult = page.locator('.atlas-v2-e360-search-result.is-press').filter({ hasText: 'Corte Superior Nacional' }).first();
  assert.ok(await pressResult.count(), 'Press-only entity was not returned by cross-source search');
  const pressText = (await pressResult.innerText()).trim();
  assert.match(pressText, /Radar Prensa/i);
  assert.doesNotMatch(pressText, /\b\d{7,8}-[0-9K]\b/i, 'Press-only entity unexpectedly exposes a resolved RUT');
  assert.ok(searchMs <= SEARCH_BUDGET_MS, `entity search exceeded ${SEARCH_BUDGET_MS}ms: ${searchMs}`);
  await pressResult.click();
  await page.waitForFunction(() => window.AtlasV2Shell?.currentRoute?.().id === 'entidad' && window.AtlasV2Shell.currentRoute().params.get('entity_id')?.startsWith('entity:press:'), null, { timeout: 5000 });
  await page.waitForSelector('.atlas-v2-e360-hero', { timeout: 10000 });
  const pressEntity = await page.evaluate(() => ({
    route: location.hash,
    text: (document.querySelector('.atlas-v2-content')?.innerText || '').slice(0, 1800),
    invalidRut: /RUT no válido|RUT inválido/i.test(document.querySelector('.atlas-v2-content')?.innerText || ''),
  }));
  assert.equal(pressEntity.invalidRut, false, 'Press-only entity incorrectly failed RUT validation');
  assert.match(pressEntity.text, /ENTIDAD OBSERVADA · PRENSA/);
  assert.match(pressEntity.text, /Corte Superior Nacional/);
  assert.match(pressEntity.route, /entity_id=entity%3Apress%3A/);
  report.entitySearch = { ms: searchMs, pressResult: 'Corte Superior Nacional', route: pressEntity.route };

  // A RUT-resolved entity with history must expose interactive SII trajectory.
  await navigate('entidad', { rut: '50010300-0' });
  await page.waitForSelector('.atlas-v2-e360-trajectory', { timeout: 12000 });
  await page.waitForFunction(() => document.querySelectorAll('.atlas-v2-e360-trajectory .atlas-v2-viz-line-point').length >= 3, null, { timeout: 12000 });
  const trajectory = await page.evaluate(() => ({
    points: document.querySelectorAll('.atlas-v2-e360-trajectory .atlas-v2-viz-line-point').length,
    charts: document.querySelectorAll('.atlas-v2-e360-trajectory .atlas-v2-viz-line').length,
  }));
  assert.ok(trajectory.points >= 3, 'SII trajectory lacks interactive year points');
  assert.equal(trajectory.charts, 2, 'SII trajectory must show sales and workers series');
  const lastPoint = page.locator('.atlas-v2-e360-trajectory .atlas-v2-viz-line-point').last();
  await lastPoint.click();
  await page.waitForTimeout(100);
  const detailAfterClick = (await page.locator('.atlas-v2-e360-year-detail').innerText()).trim();
  assert.ok(detailAfterClick.length > 0, 'Selecting a trajectory year did not refresh detail');
  report.trajectory = { charts: trajectory.charts, points: trajectory.points };

  // Return to the current Explore surface for responsive checks.
  await navigate('explorar');
  await waitForCurrentExplore();
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 1024, height: 768 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(150);
    const snap = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      panels: document.querySelectorAll('.atlas-v2-studio-panel').length,
      watchCards: document.querySelectorAll('.atlas-v2-uaf-watch-card').length,
      watchCtas: document.querySelectorAll('.atlas-v2-uaf-watch-cta').length,
      rosChart: !!document.querySelector('.atlas-v2-studio-ros-chart'),
    }));
    const overflowPx = Math.max(0, snap.scrollWidth - snap.width);
    assert.ok(overflowPx <= 2, `${viewport.name} Explore horizontal overflow ${overflowPx}px`);
    assert.equal(snap.panels, 4, `${viewport.name} lost current Explore studio panels`);
    assert.equal(snap.watchCards, 3, `${viewport.name} lost compact sector watch cards`);
    assert.equal(snap.watchCtas, 3, `${viewport.name} lost sector detail controls`);
    assert.equal(snap.rosChart, true, `${viewport.name} lost ROS analytical chart`);
    report.responsive.push({ ...viewport, overflowPx, panels: snap.panels, watchCards: snap.watchCards });
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync('e2e-atlas-v2-ux-preflight.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
