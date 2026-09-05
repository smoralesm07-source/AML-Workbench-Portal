'use strict';

const assert = require('node:assert/strict');
if (!global.performance) global.performance = require('node:perf_hooks').performance;
global.window = global;
global.location = { hash: '#public-spend', pathname: '/' };
global.__ATLAS_V2_CONFIG__ = {
  supabaseUrl: 'http://127.0.0.1:4173/__atlas_v2',
  publishableKey: 'sb_publishable_v2_test',
  sessionExchangeUrl: 'http://127.0.0.1:4173/__atlas_v2/functions/v1/atlas-v2-session-exchange',
};

function jwt(sub) {
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub, email: `${sub}@example.invalid` })}.x`;
}
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
require('../src/v2/atlas-v2-session.js');
assert.equal(global.AtlasV2Session?.installed, true);

async function testFederatedReadAndReuse() {
  const calls = [];
  let readCount = 0;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    if (String(url).endsWith('/atlas-v2-session-exchange')) {
      assert.equal(init.headers.authorization, 'Bearer ' + jwt('core-user-1'));
      assert.equal(init.headers.apikey, 'sb_publishable_v2_test');
      return response(200, {
        schema: 'ATLAS_V2_SESSION_EXCHANGE_V1',
        access_token: 'v2-access-1',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        grant_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        identity: { email: 'core-user-1@example.invalid', role: 'analyst' },
      });
    }
    readCount += 1;
    assert.equal(url, 'http://127.0.0.1:4173/__atlas_v2/functions/v1/atlas-v2-read');
    assert.equal(init.headers.authorization, 'Bearer v2-access-1');
    assert.equal(init.headers.apikey, 'sb_publishable_v2_test');
    return response(200, {
      schema: 'ATLAS_READ_API_V2', model: 'public_spend_overview', scope: 'global', snapshot_id: `snap-${readCount}`,
      model_version: 'v1', generated_at: '2026-09-05T00:00:00Z', refreshed_at: '2026-09-05T00:00:00Z',
      source_versions: {}, payload_checksum: 'abc', data: { ok: true },
    }, { 'x-atlas-snapshot': `snap-${readCount}` });
  };

  const core = jwt('core-user-1');
  const client = global.AtlasV2Data.create({ getAccessToken: async () => core });
  const first = await client.readModel('public_spend_overview', { force: true });
  const second = await client.readModel('public_spend_overview', { force: true });
  assert.equal(first.data.ok, true);
  assert.equal(second.data.ok, true);
  assert.equal(calls.filter(call => String(call.url).endsWith('/atlas-v2-session-exchange')).length, 1, 'active grant should be reused');
  assert.equal(global.AtlasV2Session.state().status, 'ready');
  assert.equal(global.AtlasV2Session.state().coreSubject, 'core-user-1');
}

async function testIdentityChangeForcesExchange() {
  global.AtlasV2Session.clear();
  const subjects = ['core-user-1', 'core-user-2'];
  let current = 0;
  let exchanges = 0;
  global.fetch = async (url, init) => {
    if (String(url).endsWith('/atlas-v2-session-exchange')) {
      exchanges += 1;
      const sub = subjects[current];
      assert.equal(init.headers.authorization, 'Bearer ' + jwt(sub));
      return response(200, {
        schema: 'ATLAS_V2_SESSION_EXCHANGE_V1', access_token: `v2-${sub}`,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        grant_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), identity: { role: 'analyst' },
      });
    }
    const expected = `Bearer v2-${subjects[current]}`;
    assert.equal(init.headers.authorization, expected);
    return response(200, {
      schema: 'ATLAS_READ_API_V2', model: 'public_spend_overview', scope: `user-${current}`, snapshot_id: 'snap',
      model_version: 'v1', generated_at: '2026-09-05T00:00:00Z', refreshed_at: '2026-09-05T00:00:00Z', source_versions: {}, data: {},
    });
  };
  const client = global.AtlasV2Data.create({ getAccessToken: async () => jwt(subjects[current]) });
  await client.readModel('public_spend_overview', { scope: 'user-0', force: true });
  current = 1;
  await client.readModel('public_spend_overview', { scope: 'user-1', force: true });
  assert.equal(exchanges, 2, 'a changed core subject must receive a new v2 grant');
}

async function testNoCoreSessionFailsClosed() {
  global.AtlasV2Session.clear();
  global.fetch = async () => { throw new Error('fetch must not run without core session'); };
  const client = global.AtlasV2Data.create({ getAccessToken: async () => null });
  await assert.rejects(client.readModel('public_spend_overview', { force: true }), error => error?.code === 'NO_SESSION');
  assert.equal(global.AtlasV2Session.state().status, 'empty');
}

(async () => {
  await testFederatedReadAndReuse();
  await testIdentityChangeForcesExchange();
  await testNoCoreSessionFailsClosed();
  console.log('ATLAS v2 federation smoke OK: exchange, grant reuse, identity isolation, fail-closed sign-out');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
