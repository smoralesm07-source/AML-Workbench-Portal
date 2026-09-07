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
const CONTRACT_BUDGET_MS = 15000;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const consoleErrors = [];
const gatewayResponses = [];
let resilienceProbe = false;

page.on('pageerror', error => pageErrors.push(String(error?.message || error)));
page.on('console', message => {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (/frame-ancestors.*ignored.*meta/i.test(text)) return;
  if (resilienceProbe && /ERR_FAILED|Failed to fetch/i.test(text)) return;
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
  contracts: [],
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
function sanitizeText(value) {
  return String(value || '')
    .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-?[0-9Kk]\b/g, '[RUT]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/\s+/g, ' ')
    .slice(0, 180);
}

async function waitForAnalyticalPaint(route) {
  await page.waitForFunction(expected => {
    const api = window.AtlasV2Shell;
    const content = document.querySelector('.atlas-v2-content');
    if (!api?.currentRoute || api.currentRoute().id !== expected || !content) return false;
    const text = (content.innerText || '').trim();
    return text.length >= 20;
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

  // Prove the real governed contracts independently of rendering speed. Only
  // contract/schema/status/trace metadata leaves the browser; no entity payloads.
  const probes = await page.evaluate(async budgetMs => {
    const timed = async (name, fn) => {
      const started = performance.now();
      try {
        const out = await Promise.race([
          fn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('E2E_CONTRACT_TIMEOUT')), budgetMs)),
        ]);
        return {
          name,
          ok: true,
          ms: Math.round(performance.now() - started),
          contract: out?.contract || out?.schema || out?.model || null,
          kind: out?.kind || null,
          traceId: out?.meta?.traceId || out?.traceId || null,
        };
      } catch (error) {
        return { name, ok: false, ms: Math.round(performance.now() - started), code: error?.code || error?.message || 'ERROR' };
      }
    };

    const results = [];
    results.push(await timed('universos', () => window.AtlasV2Universes.overview({ route: 'e2e:universos' })));
    results.push(await timed('territorio', () => window.AtlasV2Territory.overview({ route: 'e2e:territorio' })));
    results.push(await timed('vigilancia', () => window.AtlasV2Watch.overview({ route: 'e2e:vigilancia' })));
    results.push(await timed('gasto-publico', () => window.AtlasV2Access.data().publicSpend.monitor({ force: true, route: 'e2e:gasto-publico' })));
    results.push(await timed('relaciones', () => window.AtlasV2Access.data().relations.hypotheses({ query: { limit: 5 }, route: 'e2e:relaciones' })));

    let sampleRut = '';
    try {
      const seed = await window.AtlasV2Universes.entities('SII', '', { limit: 12, route: 'e2e:entity-seed' });
      sampleRut = (seed.items || []).map(item => item?.rut || item?.entity_rut || item?.tax_id || '').find(value => window.AtlasV2Entity360.validRutShape(value)) || '';
      results.push({ name: 'entity-seed', ok: !!sampleRut, ms: 0, contract: seed.contract || null, kind: seed.kind || null, traceId: seed.meta?.traceId || null });
    } catch (error) {
      results.push({ name: 'entity-seed', ok: false, ms: 0, code: error?.code || error?.message || 'ERROR' });
    }

    if (sampleRut) {
      results.push(await timed('entidad-public-spend', async () => {
        const out = await window.AtlasV2Entity360.readPublicSpend(sampleRut, { limit: 3 });
        const ready = [out?.budget, out?.procurement].filter(item => item?.status === 'ready');
        if (!ready.length) throw new Error('ENTITY360_LENSES_NOT_READY');
        return { contract: 'ENTITY360_PUBLIC_SPEND_V2', traceId: ready.map(item => item.traceId).find(Boolean) || null };
      }));
    }
    return { results, sampleRut };
  }, CONTRACT_BUDGET_MS);

  report.contracts = probes.results;
  const contractFailures = probes.results.filter(item => !item.ok);
  assert.equal(contractFailures.length, 0, `governed contract failures: ${contractFailures.map(item => `${item.name}:${item.code || 'failed'}`).join(' | ')}`);
  assert.ok(probes.sampleRut, 'no valid entity seed available for Entity 360 E2E');

  for (const route of ROUTES) {
    const started = Date.now();
    const beforePageErrors = pageErrors.length;
    const beforeConsoleErrors = consoleErrors.length;
    let outcome = 'ok';
    let detail = '';
    try {
      const params = route === 'entidad' ? { rut: probes.sampleRut } : {};
      await page.evaluate(({ id, params }) => window.AtlasV2Shell.navigate(id, params), { id: route, params });
      await waitForAnalyticalPaint(route);
      if (route === 'entidad') {
        await page.waitForFunction(() => !document.querySelector('.atlas-v2-e360-loading'), null, { timeout: ROUTE_BUDGET_MS });
      }
      const snap = await page.evaluate(() => ({
        route: window.AtlasV2Shell.currentRoute().id,
        text: (document.querySelector('.atlas-v2-content')?.innerText || '').slice(0, 1400),
        auth: window.AtlasCoreSession.state().status,
      }));
      assert.equal(snap.route, route);
      assert.equal(snap.auth, 'ready');
      assert.ok(snap.text.trim().length >= 20, `${route} rendered no useful content`);
      assert.ok(!visibleError(snap.text), `${route} rendered an analytical error state: ${sanitizeText(snap.text)}`);
      detail = sanitizeText(snap.text);
    } catch (error) {
      outcome = 'error';
      detail = sanitizeText(error?.message || error);
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
  assert.ok(successfulGateway.length >= 7, `expected >=7 successful governed reads, got ${successfulGateway.length}`);
  assert.ok(successfulGateway.filter(item => item.traceId).length >= 5, 'insufficient governed reads with trace ids');

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
    report.responsive.push({ ...viewport, overflowPx, text: sanitizeText(snap.text) });
    assert.ok(overflowPx <= 2, `${viewport.name} horizontal overflow ${overflowPx}px`);
    assert.ok(snap.text.trim().length >= 20, `${viewport.name} rendered no content`);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  resilienceProbe = true;
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
  resilienceProbe = false;
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
    contracts: report.contracts.map(({ name, ok, ms, contract, kind, traceId }) => ({ name, ok, ms, contract, kind, traced: !!traceId })),
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
