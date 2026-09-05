// Gate trace: authenticated browser test of the generated Architecture v2 cutover artifact.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const baseURL = process.env.ATLAS_E2E_URL || 'http://127.0.0.1:4173/';
const accessToken = process.env.ATLAS_E2E_ACCESS_TOKEN || '';
const refreshToken = process.env.ATLAS_E2E_REFRESH_TOKEN || '';
const expectedEmail = process.env.ATLAS_E2E_EMAIL || '';
if (!accessToken || !refreshToken || !expectedEmail) throw new Error('E2E session inputs are missing');

const COMPETING_LEGACY_JS_RE = /\/assets\/(?:atlas-public-spend-v2|atlas-public-spend-mobile-route-0573|atlas-public-spend-route-authority-0578|atlas-public-spend-intelligence-0720|atlas-gasto-publico-1000|atlas-gasto-publico-1300)\.js(?:\?|$)/i;
const COMPETING_LEGACY_CSS_RE = /\/assets\/(?:atlas-public-spend-v2|atlas-public-spend-intelligence-0720|atlas-gasto-publico-1000|atlas-gasto-publico-1300)\.css(?:\?|$)/i;
const LEGACY_NAMED_ASSET_RE = /\/assets\/(?:atlas-public-spend|atlas-gasto-publico)[^/?]*(?:\.js|\.css)(?:\?|$)/i;
const isCompetingLegacyAsset = url => COMPETING_LEGACY_JS_RE.test(url) || COMPETING_LEGACY_CSS_RE.test(url);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
const pageErrors = [];
const v2Responses = [];
const v2AssetResponses = [];
const legacyNamedAssetResponses = [];
let captureConsole = false;

page.on('console', message => {
  if (captureConsole && message.type() === 'error') {
    consoleErrors.push({ text: message.text(), location: message.location() || null });
  }
});
page.on('pageerror', error => {
  if (captureConsole) pageErrors.push(error.message);
});
page.on('response', response => {
  const url = response.url();
  const normalized = url.replace(baseURL.replace(/\/$/, ''), '');
  if (url.includes('/__atlas_v2/functions/v1/')) v2Responses.push({ url: normalized, status: response.status() });
  if (url.startsWith(baseURL) && url.includes('/v2/')) v2AssetResponses.push({ url: normalized, status: response.status() });
  if (url.startsWith(baseURL) && LEGACY_NAMED_ASSET_RE.test(url)) legacyNamedAssetResponses.push({ url: normalized, status: response.status() });
});

function isV2OwnedSignal(entry) {
  const location = entry?.location?.url || '';
  const text = entry?.text || '';
  return /\/v2\/|\/__atlas_v2\/|atlas[- ]v2|gpv2/i.test(`${location} ${text}`);
}

async function runtimeDiagnostics() {
  return page.evaluate(() => {
    const competingJs = /\/assets\/(?:atlas-public-spend-v2|atlas-public-spend-mobile-route-0573|atlas-public-spend-route-authority-0578|atlas-public-spend-intelligence-0720|atlas-gasto-publico-1000|atlas-gasto-publico-1300)\.js(?:\?|$)/i;
    const competingCss = /\/assets\/(?:atlas-public-spend-v2|atlas-public-spend-intelligence-0720|atlas-gasto-publico-1000|atlas-gasto-publico-1300)\.css(?:\?|$)/i;
    const scriptSources = [...document.scripts].map(s => s.src || s.getAttribute('src') || '[inline]');
    const styleSources = [...document.querySelectorAll('link[href]')].map(link => link.href || link.getAttribute('href') || '');
    const navigateDescriptor = Object.getOwnPropertyDescriptor(window, 'navigate');
    return {
      production: window.__ATLAS_V2_PRODUCTION_CONFIG__ || null,
      cutoverEnabled: window.__ATLAS_V2_PUBLIC_SPEND_CUTOVER__ === true,
      config: window.__ATLAS_V2_CONFIG__ ? {
        supabaseUrl: window.__ATLAS_V2_CONFIG__.supabaseUrl,
        sessionExchangeUrl: window.__ATLAS_V2_CONFIG__.sessionExchangeUrl,
        publishableKeyPresent: !!window.__ATLAS_V2_CONFIG__.publishableKey,
      } : null,
      bridge: window.__ATLAS_V2_PUBLIC_SPEND_ROUTE_BRIDGE__ || null,
      adapter: window.__ATLAS_V2_PUBLIC_SPEND_ADAPTER__ || null,
      session: window.__ATLAS_V2_SESSION__ || null,
      navigateWrapped: !!window.navigate?.__atlasV2PublicSpendRouteBridge,
      navigateDescriptor: navigateDescriptor ? {
        configurable: !!navigateDescriptor.configurable,
        enumerable: !!navigateDescriptor.enumerable,
        writable: Object.prototype.hasOwnProperty.call(navigateDescriptor, 'writable') ? !!navigateDescriptor.writable : null,
        hasGetter: typeof navigateDescriptor.get === 'function',
        hasSetter: typeof navigateDescriptor.set === 'function',
      } : null,
      hostPresent: !!document.querySelector('[data-gpv2-host]'),
      styleHref: document.getElementById('atlas-v2-public-spend-adapter-style')?.href || null,
      legacyAuthority: window.__ATLAS_PUBLIC_SPEND_ROUTE_AUTHORITY_0578__ || null,
      compatibilityFacade: {
        present: !!window.AtlasPublicSpendV2,
        v2Owned: window.AtlasPublicSpendV2?.__atlasV2PublicSpendFacade === true,
        authority: window.AtlasPublicSpendV2?.authority || null,
      },
      legacyGlobals: {
        mobile0573: !!window.AtlasPublicSpendMobile0573 || !!window.__ATLAS_PUBLIC_SPEND_MOBILE_0573__,
        intel0720: !!window.AtlasPublicSpendIntelligence0720 || !!window.__ATLAS_PUBLIC_SPEND_INTEL_0720__,
        gp12: !!window.AtlasGastoPublico1000 || !!window.__ATLAS_GASTO_PUBLICO_1000__,
        gp13: !!window.AtlasGastoPublico1300,
      },
      scripts: scriptSources.filter(src => /atlas-v2|public-spend|gasto-publico/i.test(src)),
      competingLegacyScripts: scriptSources.filter(src => competingJs.test(src)),
      competingLegacyStyles: styleSources.filter(src => competingCss.test(src)),
    };
  });
}

async function adapterReady(tab) {
  await page.waitForFunction(expected => {
    const h = window.__ATLAS_V2_PUBLIC_SPEND_ADAPTER__;
    return h?.status === 'ready' && (!expected || h.tab === expected);
  }, tab || null, { timeout: 20000 });
}
async function closeDrawer() {
  const close = page.locator('[data-gpv2-close]').first();
  if (await close.count()) {
    await close.click();
    await page.locator('.gpv2-drawer').waitFor({ state: 'detached', timeout: 5000 });
  }
}
async function openFirstDetail(kind) {
  const button = page.locator(`[data-gpv2-detail="${kind}"]`).first();
  await button.waitFor({ state: 'visible', timeout: 15000 });
  await button.click();
  await page.locator('.gpv2-drawer').waitFor({ state: 'visible', timeout: 15000 });
  assert.ok((await page.locator('.gpv2-drawer').innerText()).trim().length > 40, `${kind} drawer should contain contextual detail`);
  await closeDrawer();
}
async function cspViolations() {
  return page.evaluate(() => Array.isArray(window.__ATLAS_V2_E2E_CSP__) ? window.__ATLAS_V2_E2E_CSP__.slice() : []);
}
function assertNoCompetingAuthority(diag, phase) {
  assert.equal(diag.competingLegacyScripts.length, 0, `${phase}: competing legacy Gasto Público scripts must be absent`);
  assert.equal(diag.competingLegacyStyles.length, 0, `${phase}: competing legacy Gasto Público styles must be absent`);
  assert.equal(diag.legacyAuthority, null, `${phase}: legacy public-spend route authority must be absent`);
  assert.equal(diag.compatibilityFacade.present, true, `${phase}: canonical AtlasPublicSpendV2 compatibility surface must exist`);
  assert.equal(diag.compatibilityFacade.v2Owned, true, `${phase}: AtlasPublicSpendV2 must be owned by Architecture v2`);
  assert.equal(diag.compatibilityFacade.authority, 'ATLAS_V2_PUBLIC_SPEND', `${phase}: compatibility facade authority mismatch`);
  assert.equal(diag.legacyGlobals.mobile0573, false, `${phase}: 0573 GP2 bootstrap shim must be absent`);
  assert.equal(diag.legacyGlobals.intel0720, false, `${phase}: 0720 runtime must be absent`);
  assert.equal(diag.legacyGlobals.gp12, false, `${phase}: GP12 runtime must be absent`);
  assert.equal(diag.legacyGlobals.gp13, false, `${phase}: GP13 runtime must be absent`);
  assert.equal(diag.navigateWrapped, true, `${phase}: canonical navigate must be owned by the v2 route bridge`);
  assert.notEqual(diag.bridge?.navigateInstallMode, 'failed', `${phase}: navigate takeover must not fail`);
}

const report = { authMode: 'SUPABASE_EPHEMERAL_CI_CUTOVER_ARTIFACT', startedAt: new Date().toISOString() };
try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof sb !== 'undefined' && !!sb?.auth?.setSession, null, { timeout: 15000 });
  const sessionSet = await page.evaluate(async ({ accessToken, refreshToken }) => {
    const { data, error } = await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return { email: data?.session?.user?.email || null, error: error?.message || null };
  }, { accessToken, refreshToken });
  assert.equal(sessionSet.error, null, 'core Supabase session should be accepted');
  assert.equal(sessionSet.email, expectedEmail, 'E2E identity mismatch');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => {
    try { return typeof state !== 'undefined' && state?.access?.enabled === true && state?.access?.provisional !== true; }
    catch (_) { return false; }
  }, null, { timeout: 20000 });

  const authState = await page.evaluate(async () => {
    const { data } = await sb.auth.getSession();
    let access = null;
    try { access = state?.access ? { role: state.access.role, enabled: state.access.enabled, provisional: !!state.access.provisional } : null; } catch (_) {}
    return { email: data?.session?.user?.email || null, access };
  });
  assert.equal(authState.email, expectedEmail);
  assert.equal(authState.access?.enabled, true);
  assert.notEqual(authState.access?.provisional, true, 'E2E must not pass through degraded/provisional shell access');
  report.coreAuth = authState;

  report.preRoute = await runtimeDiagnostics();
  assert.equal(report.preRoute.production?.status, 'ready', 'v2 production cutover config must execute');
  assert.match(report.preRoute.production?.mode || '', /^public-spend-cutover/, 'production cutover mode must be active');
  assert.equal(report.preRoute.cutoverEnabled, true, 'generated artifact must explicitly enable public-spend cutover');
  assert.match(report.preRoute.config?.supabaseUrl || '', /\/__atlas_v2$/, 'E2E cutover artifact must use the local v2 proxy');
  assert.match(report.preRoute.config?.sessionExchangeUrl || '', /\/__atlas_v2\/functions\/v1\/atlas-v2-session-exchange$/, 'session exchange must use the E2E proxy');
  assert.equal(report.preRoute.adapter?.status, 'installed', 'v2 adapter must be installed before route activation');
  assert.ok(report.preRoute.bridge, 'v2 route bridge must be installed before route activation');
  assert.match(report.preRoute.styleHref || '', /\/v2\/public-spend-adapter\.css(?:\?|$)/, 'v2 stylesheet must resolve from the cutover v2 directory');
  assertNoCompetingAuthority(report.preRoute, 'pre-route');

  await page.evaluate(() => {
    window.__ATLAS_V2_E2E_CSP__ = [];
    document.addEventListener('securitypolicyviolation', event => {
      window.__ATLAS_V2_E2E_CSP__.push({
        effectiveDirective: event.effectiveDirective || '',
        blockedURI: event.blockedURI || '',
        sourceFile: event.sourceFile || '',
        lineNumber: event.lineNumber || 0,
        columnNumber: event.columnNumber || 0,
        sample: event.sample || '',
      });
    });
  });

  consoleErrors.length = 0;
  pageErrors.length = 0;
  captureConsole = true;

  const nav = page.locator('[data-view="public-spend"]').first();
  await nav.waitFor({ state: 'visible', timeout: 15000 });
  await nav.click();
  try {
    await page.locator('[data-gpv2-host]').waitFor({ state: 'visible', timeout: 5000 });
  } catch (_) {
    report.postRoute = await runtimeDiagnostics();
    throw new Error(`v2 route did not create host: ${JSON.stringify({ bridge: report.postRoute.bridge, adapter: report.postRoute.adapter, navigateWrapped: report.postRoute.navigateWrapped, scripts: report.postRoute.scripts })}`);
  }
  report.postRoute = await runtimeDiagnostics();
  assertNoCompetingAuthority(report.postRoute, 'post-route');
  await adapterReady('overview');
  await page.waitForFunction(() => window.__ATLAS_V2_SESSION__?.status === 'ready', null, { timeout: 15000 });

  const sessionState = await page.evaluate(() => ({ ...window.__ATLAS_V2_SESSION__ }));
  assert.equal(sessionState.status, 'ready');
  assert.ok(Date.parse(sessionState.grantExpiresAt) > Date.now(), 'federated grant must be active');
  report.v2Session = sessionState;

  const region = page.locator('[data-gpv2-filter="region"]');
  const regionValues = await region.locator('option').evaluateAll(options => options.map(o => o.value).filter(Boolean));
  const selectedRegion = regionValues.includes('13') ? '13' : regionValues[0];
  assert.ok(selectedRegion, 'at least one region filter option is required');
  await region.selectOption(selectedRegion);
  await page.waitForFunction(value => window.AtlasV2PublicSpendAdapter?.state?.filters?.region === value, selectedRegion, { timeout: 10000 });
  await adapterReady('overview');

  const month = page.locator('[data-gpv2-filter="month"]');
  const monthValues = await month.locator('option').evaluateAll(options => options.map(o => o.value).filter(Boolean));
  const selectedMonth = monthValues.includes('2026-07') ? '2026-07' : monthValues.at(-1);
  assert.ok(selectedMonth, 'at least one month filter option is required');
  await month.selectOption(selectedMonth);
  await page.waitForFunction(value => window.AtlasV2PublicSpendAdapter?.state?.filters?.month === value, selectedMonth, { timeout: 10000 });
  await adapterReady('overview');
  report.filters = { region: selectedRegion, month: selectedMonth };

  await page.locator('[data-gpv2-tab="services"]').click();
  await adapterReady('services');
  await openFirstDetail('service');
  await page.locator('[data-gpv2-tab="providers"]').click();
  await adapterReady('providers');
  await openFirstDetail('provider');
  await page.locator('[data-gpv2-tab="relations"]').click();
  await adapterReady('relations');
  await openFirstDetail('flow');
  await page.locator('[data-gpv2-tab="method"]').click();
  await adapterReady('method');
  await page.locator('[data-gpv2-methodology]').waitFor({ state: 'visible', timeout: 10000 });
  assert.match(await page.locator('[data-gpv2-methodology]').innerText(), /Ejecución vs\. flujo|HHI de proveedores|Drill-down contextual/);
  await page.locator('[data-gpv2-tab="overview"]').click();
  await adapterReady('overview');
  assert.ok(await page.locator('.gpv2-kpi').count() >= 4, 'overview KPI cards should render after drill-down round trip');

  report.programmaticNavigate = await page.evaluate(async () => {
    const result = await window.navigate('public-spend');
    return {
      result: result !== false,
      wrapped: window.navigate?.__atlasV2PublicSpendRouteBridge === true,
      facade: window.AtlasPublicSpendV2?.__atlasV2PublicSpendFacade === true,
    };
  });
  assert.equal(report.programmaticNavigate.result, true, 'programmatic window.navigate(public-spend) must open v2');
  assert.equal(report.programmaticNavigate.wrapped, true, 'programmatic navigate must remain wrapped after use');
  await adapterReady('overview');

  report.canonicalRouterFacade = await page.evaluate(async () => {
    const api = window.AtlasOperationalRecovery0805;
    if (!api?.open) return { available: false, result: false };
    const result = await api.open('public-spend', 'e2e-canonical-router');
    return { available: true, result: result !== false, facade: window.AtlasPublicSpendV2?.__atlasV2PublicSpendFacade === true };
  });
  assert.equal(report.canonicalRouterFacade.available, true, 'canonical route authority must be available');
  assert.equal(report.canonicalRouterFacade.result, true, 'canonical route authority must delegate public-spend to v2 facade');
  await adapterReady('overview');

  report.finalRuntime = await runtimeDiagnostics();
  assertNoCompetingAuthority(report.finalRuntime, 'final');

  const exchangeResponses = v2Responses.filter(x => x.url.includes('atlas-v2-session-exchange'));
  const readResponses = v2Responses.filter(x => x.url.includes('atlas-v2-read'));
  const failedAssets = v2AssetResponses.filter(x => x.status >= 400);
  const competingLegacyAssetResponses = legacyNamedAssetResponses.filter(x => isCompetingLegacyAsset(x.url));
  const supportAssetResponses = legacyNamedAssetResponses.filter(x => !isCompetingLegacyAsset(x.url));
  const failedSupportAssets = supportAssetResponses.filter(x => x.status >= 400);
  const v2ConsoleErrors = consoleErrors.filter(isV2OwnedSignal);
  const legacyConsoleErrors = consoleErrors.filter(entry => !isV2OwnedSignal(entry));
  const allCsp = await cspViolations();
  const v2CspViolations = allCsp.filter(entry => /\/v2\/|\/__atlas_v2\/|atlas[- ]v2|gpv2/i.test(`${entry.sourceFile} ${entry.blockedURI} ${entry.sample}`));
  const legacyCspViolations = allCsp.filter(entry => !v2CspViolations.includes(entry));

  assert.ok(exchangeResponses.some(x => x.status === 200), 'session exchange must succeed over HTTP');
  assert.ok(readResponses.length >= 6, 'E2E should exercise multiple real v2 reads');
  assert.equal(readResponses.filter(x => x.status >= 400).length, 0, 'v2 reads must not return HTTP errors');
  assert.equal(failedAssets.length, 0, `v2 assets must load cleanly: ${JSON.stringify(failedAssets)}`);
  assert.equal(competingLegacyAssetResponses.length, 0, `cutover must never request legacy GP route-owner/bootstrap assets: ${JSON.stringify(competingLegacyAssetResponses)}`);
  assert.equal(failedSupportAssets.length, 0, `retained shared public-spend support assets must remain available: ${JSON.stringify(failedSupportAssets)}`);
  assert.equal(v2ConsoleErrors.length, 0, `v2-owned console errors: ${JSON.stringify(v2ConsoleErrors)}`);
  assert.equal(v2CspViolations.length, 0, `v2-owned CSP violations: ${JSON.stringify(v2CspViolations)}`);
  assert.equal(pageErrors.length, 0, `page errors since v2 route activation: ${pageErrors.join(' | ')}`);

  report.v2Responses = v2Responses;
  report.v2AssetResponses = v2AssetResponses;
  report.competingLegacyAssetResponses = competingLegacyAssetResponses;
  report.supportAssetResponses = supportAssetResponses;
  report.failedSupportAssets = failedSupportAssets;
  report.v2ConsoleErrors = v2ConsoleErrors;
  report.legacyConsoleErrors = legacyConsoleErrors;
  report.v2CspViolations = v2CspViolations;
  report.legacyCspViolations = legacyCspViolations;
  report.pageErrors = pageErrors;
  report.completedAt = new Date().toISOString();
  report.status = 'PASS';
  await page.screenshot({ path: 'e2e-atlas-v2-public-spend.png', fullPage: true });
  fs.writeFileSync('e2e-atlas-v2-public-spend.json', JSON.stringify(report, null, 2));
  console.log('ATLAS v2 cutover artifact authenticated E2E PASS', JSON.stringify({
    filters: report.filters,
    reads: readResponses.length,
    exchange: exchangeResponses.length,
    navigateMode: report.finalRuntime.bridge?.navigateInstallMode,
    competingLegacyRequests: competingLegacyAssetResponses.length,
    supportAssetsObserved: supportAssetResponses.length,
    failedSupportAssets: failedSupportAssets.length,
    legacyConsoleErrors: legacyConsoleErrors.length,
    legacyCsp: legacyCspViolations.length,
  }));
} catch (error) {
  report.status = 'FAIL';
  report.error = error instanceof Error ? error.message : String(error);
  report.runtimeAtFailure = await runtimeDiagnostics().catch(() => null);
  report.v2Responses = v2Responses;
  report.v2AssetResponses = v2AssetResponses;
  report.legacyNamedAssetResponses = legacyNamedAssetResponses;
  report.consoleErrors = consoleErrors;
  report.pageErrors = pageErrors;
  report.cspViolations = await cspViolations().catch(() => []);
  report.completedAt = new Date().toISOString();
  fs.writeFileSync('e2e-atlas-v2-public-spend.json', JSON.stringify(report, null, 2));
  await page.screenshot({ path: 'e2e-atlas-v2-public-spend.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}