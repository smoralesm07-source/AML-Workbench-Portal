'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

if (!global.performance) global.performance = require('node:perf_hooks').performance;
global.window = global;
global.location = { hash: '#public-spend', pathname: '/' };

function response(status, body = {}, headers = {}) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([k, v]) => [String(k).toLowerCase(), String(v)]));
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get(name) { return normalized[String(name).toLowerCase()] ?? null; } },
    async json() { return body; },
  };
}

require('../src/v2/atlas-v2-data.js');
assert.equal(typeof global.AtlasV2Data?.create, 'function');

const client = global.AtlasV2Data.create({
  supabaseUrl: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_test',
  getAccessToken: async () => 'jwt-test',
});

async function testEtag304() {
  const calls = [];
  let n = 0;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    n += 1;
    if (n === 1) {
      return response(200, {
        schema: 'ATLAS_READ_API_V2', model: 'public_spend_monitor', scope: 'global', snapshot_id: 'snap-1',
        model_version: 'v1', generated_at: '2026-09-05T00:00:00Z', refreshed_at: '2026-09-05T00:00:00Z',
        source_versions: {}, payload_checksum: 'abc', data: { ok: true }, trace_id: 'trace-body-1',
      }, { etag: '"etag-1"', 'x-atlas-trace-id': 'trace-header-1', 'x-atlas-snapshot': 'snap-1', 'server-timing': 'db;dur=4.2' });
    }
    return response(304, {}, { 'x-atlas-trace-id': 'trace-304', 'x-atlas-snapshot': 'snap-1', 'server-timing': 'cache;dur=0.5' });
  };

  const first = await client.readModel('public_spend_monitor');
  assert.equal(first.meta.cacheStatus, 'network');
  assert.equal(first.snapshotId, 'snap-1');
  assert.equal(first.meta.etag, '"etag-1"');

  const second = await client.readModel('public_spend_monitor');
  assert.equal(second.meta.cacheStatus, 'validated');
  assert.equal(second.snapshotId, 'snap-1');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.headers['if-none-match'], '"etag-1"');
  assert.equal(calls[1].init.headers.authorization, 'Bearer jwt-test');
  assert.equal(calls[1].init.headers.apikey, 'sb_publishable_test');
}

async function testContractMismatch() {
  global.fetch = async () => response(200, {
    schema: 'WRONG_SCHEMA', model: 'public_spend_overview', scope: 'contract-test', data: {},
  });
  await assert.rejects(
    client.readModel('public_spend_overview', { scope: 'contract-test', force: true }),
    error => error?.code === 'CONTRACT_MISMATCH',
  );
}

async function testCancellation() {
  global.fetch = async (_url, init) => new Promise((resolve, reject) => {
    void resolve;
    init.signal.addEventListener('abort', () => reject(init.signal.reason || new Error('aborted')), { once: true });
  });
  const controller = new AbortController();
  const pending = client.readModel('public_spend_overview', {
    scope: 'cancel-test', force: true, signal: controller.signal, timeoutMs: 30000,
  });
  setTimeout(() => controller.abort(new Error('test-cancel')), 0);
  await assert.rejects(pending, error => error?.code === 'TIMEOUT_OR_CANCELLED');
}

async function testBudgetFilterPropagation() {
  const outbound = [];
  global.fetch = async (_url, init) => {
    const envelope = JSON.parse(init.body);
    outbound.push(envelope);
    const kind = envelope.query.kind;
    return response(200, {
      schema: 'ATLAS_PUBLIC_SPEND_QUERY_V2', domain: 'budget_execution', snapshot_id: 'budget-snap', kind,
      items: [], detail: kind.endsWith('_detail') ? {} : null, page: { offset: 0, limit: 40, returned: 0, has_more: false },
    }, { 'x-atlas-trace-id': 'budget-trace', 'x-atlas-snapshot': 'budget-snap' });
  };

  const filters = { region: '13', category: 'GASTOS EN PERSONAL', month: '2026-07', serviceId: 'ORG-1', providerId: 'PRV-1' };
  await client.publicSpend.budgetServices({ filters, query: { limit: 40 }, route: 'smoke:services' });
  await client.publicSpend.budgetFlowDetail('ORG-1', 'PRV-1', { filters, route: 'smoke:flow-detail' });

  const services = outbound[0];
  assert.equal(services.operation, 'public_spend_query');
  assert.deepEqual({
    domain: services.query.domain, kind: services.query.kind, region: services.query.region, category: services.query.category,
    month: services.query.month, service_id: services.query.service_id, provider_id: services.query.provider_id, limit: services.query.limit,
  }, {
    domain: 'budget_execution', kind: 'budget_services', region: '13', category: 'GASTOS EN PERSONAL', month: '2026-07',
    service_id: 'ORG-1', provider_id: 'PRV-1', limit: 40,
  });

  const detail = outbound[1];
  assert.equal(detail.query.kind, 'budget_flow_detail');
  assert.equal(detail.query.service_id, 'ORG-1');
  assert.equal(detail.query.provider_id, 'PRV-1');
  assert.equal(detail.query.region, '13');
  assert.equal(detail.query.month, '2026-07');
}

function testStaleResponseGuard() {
  const adapter = fs.readFileSync(path.join(__dirname, '../src/v2/public-spend-adapter.js'), 'utf8');
  assert.match(adapter, /const serial = \+\+contextSerial/);
  assert.match(adapter, /if \(serial !== contextSerial\) return false/);
  assert.match(adapter, /filters: S\.filters/);
  assert.match(adapter, /budgetFlowDetail/);
}

(async () => {
  await testEtag304();
  await testContractMismatch();
  await testCancellation();
  await testBudgetFilterPropagation();
  testStaleResponseGuard();
  console.log('ATLAS v2 data client smoke OK: ETag/304, contract, cancellation, contextual filters, stale-response guard');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
