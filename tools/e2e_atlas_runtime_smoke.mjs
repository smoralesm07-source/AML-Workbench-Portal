import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const baseURL = process.env.ATLAS_E2E_URL || 'http://127.0.0.1:4173/';
const accessToken = process.env.ATLAS_E2E_ACCESS_TOKEN || '';
const refreshToken = process.env.ATLAS_E2E_REFRESH_TOKEN || '';
const expectedEmail = process.env.ATLAS_E2E_EMAIL || '';
if (!accessToken || !refreshToken || !expectedEmail) throw new Error('E2E session inputs are missing');

const ROUTES = ['explorar','universos','entidad','gasto-publico','territorio','relaciones','vigilancia','guardados','metodo'];
const STARTUP_BUDGET_MS = 15000;
const ROUTE_BUDGET_MS = 12000;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const consoleErrors = [];
const gatewayResponses = [];

page.on('pageerror', error => pageErrors.push(String(error?.message || error)));
page.on('console', message => {
  if (message.type() !== 'error') return;
  const text = message.text();
  // The resilience probe intentionally creates one network failure; it is
  // recorded separately and should not poison the browser-console gate.
  if (/ERR_FAILED|Failed to fetch/i.test(text) && globalThis.__atlasResilienceProbe) return;
  consoleErrors.push({ text: text.slice(0, 500), location: message.location() || null });
});
page.on('response', response => {
  const url = response.url();
  if (!url.includes('/__atlas_v2/functions/v1/atlas-v2-read')) return;
  gatewayResponses.push({
    status: response.status(),
    traceId: response.headers()['x-atlas-trace-id'] || null,
    snapshot: response.headers()['x-atlas-snapshot'] || null,
    serverTiming: response.headers()['server-timing'] || null,
  });
});

const report = {
  schema: 'ATLAS_V2_PRIMARY_E2E_V1',
  startedAt: new Date().toISOString(),
  routes: [],
  responsive: [],
  resilience: null,
  gatewayResponses,
  pageErrors,
  consoleErrors,
};

function visibleError(text) {
  return /INICIO BLOQUEADO|No fue posible leer|No fue posible iniciar ATLAS v2|No fue posible cargar|Error de lectura|STRUCTURAL_SURFACE_LOAD_FAILED/i.test(text || '');
}

async function waitForAnalyticalPaint(route) {
  await page.waitForFunction(expected => {
    const api = window.AtlasV2Shell;
    const content = document.querySelector('.atlas-v2-content');
    if (!api?.currentRoute || api.currentRoute().id !== expected || !content) return false;
    const text = (content.innerText || '').trim();
    if (text.length < 20) return false;
    return !/Consultando read model gobernado|Consultando Atlas|Cargando…|Cargando\.\.\./i.test(text);
  }, route, { timeout: ROUTE_BUDGET_MS });
}

try {
  const firstNavStarted = Date.now();
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.sb !== 'undefined' && !!window.sb?.auth?.setSession, null, { timeout: 15000 });

  const set = await page.evaluate(async ({ accessToken, refreshToken }) => {
    const { data, error } = await window.sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    const verified = await window.sb.auth.getUser();
    return {
      sessionEmail: data?.session?.user?.email || null,
      verifiedEmail: verified?.data?.user?.email || null,
      error: error?.message || verified?.error?.message || null,
    };
  }, { accessToken, refreshToken });
  assert.equal(set.error, null);
  assert.equal(set.sessionEmail, expectedEmail);
  assert.equal(set.verifiedEmail, expectedEmail);

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => {
    return window.AtlasCoreSession?.state?.().status === 'ready' &&
      window.AtlasV2Shell?.installed === true &&
      !!document.querySelector('.atlas-v2-app');
  }, null, { timeout: STARTUP_BUDGET_MS });
  const startupMs = Date.now() - firstNavStarted;
  report.startupMs = startupMs;
  assert.ok(startupMs <= STARTUP_BUDGET_MS, `startup exceeded ${STARTUP_BUDGET_MS}ms: ${startupMs}`);

  const runtime = await page.evaluate(() => ({
    auth: window.AtlasCoreSession?.state?.() || null,
    routes: window.AtlasV2Shell?.routes?.map(item => item.id) || [],
    scripts: [...document.scripts].map(script => script.src).filter(Boolean),
    health: window.AtlasV2Health?.snapshot?.() || null,
  }));
  assert.equal(runtime.auth?.status, 'ready');
  assert.deepEqual(runtime.routes, ROUTES);
  assert.ok(runtime.scripts.some(src => /atlas-v2-health\.js/.test(src)), 'health boundary not loaded');
  assert.ok(runtime.scripts.some(src => /atlas-v2-core-auth\.js/.test(src)), 'core auth boundary not loaded');
  assert.ok(!runtime.scripts.some(src => /atlas-runtime-current-|atlas-module-current-|atlas-gasto-publico-1000|route-authority-0578/.test(src)), 'legacy runtime leaked into v2 primary');
  assert.equal(runtime.health?.schema, 'ATLAS_V2_RUNTIME_HEALTH_V1');

  for (const route of ROUTES) {
    const started = Date.now();
    const beforePageErrors = pageErrors.length;
    const beforeConsoleErrors = consoleErrors.length;
    let outcome = 'ok';
    let detail = '';
    try {
      await page.evaluate(id => window.AtlasV2Shell.navigate(id), route);
      await waitForAnalyticalPaint(route);
      const snap = await page.evaluate(() => ({
        route: window.AtlasV2Shell.currentRoute().id,
        hash: location.hash,
        text: (document.querySelector('.atlas-v2-content')?.innerText || '').slice(0, 1200),
        auth: window.AtlasCoreSession.state().status,
      }));
      assert.equal(snap.route, route);
      assert.equal(snap.auth, 'ready');
      assert.ok(snap.text.trim().length >= 20, `${route} rendered no useful content`);
      assert.ok(!visibleError(snap.text), `${route} rendered an analytical error state: ${snap.text.slice(0, 180)}`);
      detail = snap.text.slice(0, 150).replace(/\s+/g, ' ');
    } catch (error) {
      outcome = 'error';
      detail = String(error?.message || error);
    }
    const durationMs = Date.now() - started;
    if (durationMs > ROUTE_BUDGET_MS) outcome = 'error';
    const newPageErrors = pageErrors.slice(beforePageErrors);
    const newConsoleErrors = consoleErrors.slice(beforeConsoleErrors);
    if (newPageErrors.length || newConsoleErrors.some(item => /Maximum call stack|RangeError|ReferenceError|TypeError/i.test(item.text || ''))) outcome = 'error';
    report.routes.push({ route, outcome, durationMs, detail, newPageErrors, newConsoleErrors });
  }

  const routeFailures = report.routes.filter(item => item.outcome !== 'ok');
  assert.equal(routeFailures.length, 0, `route failures: ${routeFailures.map(item => `${item.route}:${item.detail}`).join(' | ')}`);

  const successfulGateway = gatewayResponses.filter(item => item.status >= 200 && item.status < 300);
  assert.ok(successfulGateway.length >= 3, `expected >=3 successful governed reads, got ${successfulGateway.length}`);
  assert.ok(successfulGateway.some(item => item.traceId), 'governed reads did not expose any trace id');

  for (const viewport of [{ width: 390, height: 844, name: 'mobile' }, { width: 1024, height: 768, name: 'tablet' }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate(() => window.AtlasV2Shell.navigate('explorar'));
    await waitForAnalyticalPaint('explorar');
    const snap = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      text: (document.querySelector('.atlas-v2-content')?.innerText || '').slice(0, 200),
    }));
    const overflowPx = Math.max(0, snap.scrollWidth - snap.innerWidth);
    report.responsive.push({ ...viewport, overflowPx, text: snap.text.replace(/\s+/g, ' ') });
    assert.ok(overflowPx <= 2, `${viewport.name} horizontal overflow ${overflowPx}px`);
    assert.ok(snap.text.trim().length >= 20, `${viewport.name} rendered no content`);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  globalThis.__atlasResilienceProbe = true;
  await page.route('**/__atlas_v2/functions/v1/atlas-v2-read', route => route.abort('failed'));
  const resilience = await page.evaluate(async () => {
    try {
      await window.AtlasV2Access.data().readModel('public_spend_monitor', {
        force: true,
        timeoutMs: 1200,
        route: 'e2e:network-failure',
      });
      return { caught: false, code: null, shellAlive: !!document.querySelector('.atlas-v2-app') };
    } catch (error) {
      return {
        caught: true,
        code: error?.code || error?.name || 'UNKNOWN',
        traceId: error?.traceId || null,
        shellAlive: !!document.querySelector('.atlas-v2-app'),
      };
    }
  });
  await page.unroute('**/__atlas_v2/functions/v1/atlas-v2-read');
  globalThis.__atlasResilienceProbe = false;
  report.resilience = resilience;
  assert.equal(resilience.caught, true, 'network failure was not surfaced to the data boundary');
  assert.ok(['NETWORK_ERROR','TIMEOUT_OR_CANCELLED'].includes(resilience.code), `unexpected resilience error code ${resilience.code}`);
  assert.equal(resilience.shellAlive, true, 'shell did not survive governed-read network failure');

  const finalState = await page.evaluate(() => ({
    auth: window.AtlasCoreSession?.state?.().status || null,
    health: window.AtlasV2Health?.snapshot?.() || null,
    rootText: (document.getElementById('atlas-v2-root')?.innerText || '').slice(0, 500),
  }));
  report.finalState = finalState;
  assert.equal(finalState.auth, 'ready');
  assert.ok(!visibleError(finalState.rootText), 'fatal application error visible after resilience probe');
  assert.equal(finalState.health?.counters?.boot_error || 0, 0);
  assert.equal(finalState.health?.counters?.runtime_error || 0, 0);

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync('e2e-atlas-runtime-smoke.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    schema: report.schema,
    startupMs: report.startupMs,
    routes: report.routes.map(({ route, outcome, durationMs }) => ({ route, outcome, durationMs })),
    responsive: report.responsive.map(({ name, overflowPx }) => ({ name, overflowPx })),
    governedReads: { total: gatewayResponses.length, successful: successfulGateway.length, traced: successfulGateway.filter(item => item.traceId).length },
    resilience: report.resilience,
    health: finalState.health?.counters || null,
  }, null, 2));
} finally {
  if (!fs.existsSync('e2e-atlas-runtime-smoke.json')) {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync('e2e-atlas-runtime-smoke.json', JSON.stringify(report, null, 2));
  }
  await browser.close();
}
