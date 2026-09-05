import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const baseURL = process.env.ATLAS_E2E_URL || 'http://127.0.0.1:4173/';
const accessToken = process.env.ATLAS_E2E_ACCESS_TOKEN || '';
const refreshToken = process.env.ATLAS_E2E_REFRESH_TOKEN || '';
const expectedEmail = process.env.ATLAS_E2E_EMAIL || '';
if (!accessToken || !refreshToken || !expectedEmail) throw new Error('E2E session inputs are missing');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
const pageErrors = [];
const v2Responses = [];
let captureConsole = false;

page.on('console', message => {
  if (captureConsole && message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', error => {
  if (captureConsole) pageErrors.push(error.message);
});
page.on('response', response => {
  const url = response.url();
  if (url.includes('/__atlas_v2/functions/v1/')) v2Responses.push({ url: url.replace(baseURL.replace(/\/$/, ''), ''), status: response.status() });
});

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

const report = { authMode: 'SUPABASE_EPHEMERAL_CI', startedAt: new Date().toISOString() };
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
  captureConsole = true;
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

  const nav = page.locator('[data-view="public-spend"]').first();
  await nav.waitFor({ state: 'visible', timeout: 15000 });
  await nav.click();
  await page.locator('[data-gpv2-host]').waitFor({ state: 'visible', timeout: 15000 });
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

  const exchangeResponses = v2Responses.filter(x => x.url.includes('atlas-v2-session-exchange'));
  const readResponses = v2Responses.filter(x => x.url.includes('atlas-v2-read'));
  assert.ok(exchangeResponses.some(x => x.status === 200), 'session exchange must succeed over HTTP');
  assert.ok(readResponses.length >= 6, 'E2E should exercise multiple real v2 reads');
  assert.equal(readResponses.filter(x => x.status >= 400).length, 0, 'v2 reads must not return HTTP errors');
  assert.equal(consoleErrors.length, 0, `console errors: ${consoleErrors.join(' | ')}`);
  assert.equal(pageErrors.length, 0, `page errors: ${pageErrors.join(' | ')}`);

  report.v2Responses = v2Responses;
  report.consoleErrors = consoleErrors;
  report.pageErrors = pageErrors;
  report.completedAt = new Date().toISOString();
  report.status = 'PASS';
  await page.screenshot({ path: 'e2e-atlas-v2-public-spend.png', fullPage: true });
  fs.writeFileSync('e2e-atlas-v2-public-spend.json', JSON.stringify(report, null, 2));
  console.log('ATLAS v2 authenticated browser E2E PASS', JSON.stringify({ filters: report.filters, reads: readResponses.length, exchange: exchangeResponses.length }));
} catch (error) {
  report.status = 'FAIL';
  report.error = error instanceof Error ? error.message : String(error);
  report.v2Responses = v2Responses;
  report.consoleErrors = consoleErrors;
  report.pageErrors = pageErrors;
  report.completedAt = new Date().toISOString();
  fs.writeFileSync('e2e-atlas-v2-public-spend.json', JSON.stringify(report, null, 2));
  await page.screenshot({ path: 'e2e-atlas-v2-public-spend.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
