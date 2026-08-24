import { getSandbox } from '@cloudflare/sandbox';
import { createRemoteJWKSet, jwtVerify } from 'jose';
export { Sandbox } from '@cloudflare/sandbox';

type Env = {
  Sandbox: any;
  SUPABASE_JWKS_URL: string;
  SUPABASE_ISSUER: string;
};

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });

async function authenticate(req: Request, env: Env) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new Error('MISSING_BEARER_TOKEN');
  const jwks = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL));
  const { payload } = await jwtVerify(token, jwks, { issuer: env.SUPABASE_ISSUER });
  if (!payload.sub) throw new Error('INVALID_SUBJECT');
  return String(payload.sub);
}

async function userSandboxId(subject: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(subject));
  return `atlas-maigret-${Array.from(new Uint8Array(digest)).slice(0, 10).map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/health') {
      return respond({ ok: true, service: 'atlas-maigret-osint', runtime: 'cloudflare-sandbox', version: '0526.1' });
    }
    if (req.method !== 'POST' || url.pathname !== '/v1/maigret') return respond({ error: 'NOT_FOUND' }, 404);

    let subject: string;
    try {
      subject = await authenticate(req, env);
    } catch (error) {
      return respond({ ok: false, error: String((error as Error)?.message || error) }, 401);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return respond({ ok: false, error: 'INVALID_JSON' }, 400);
    }

    const username = String(body?.username || '').trim();
    if (!/^[A-Za-z0-9._-]{2,80}$/.test(username)) return respond({ ok: false, error: 'INVALID_USERNAME' }, 400);

    const payload = {
      username,
      recursive: body?.recursive !== false,
      top_sites: Number(body?.top_sites || 180),
      site_timeout: Number(body?.site_timeout || 6),
      total_timeout: Number(body?.total_timeout || 105),
    };

    const sandbox = getSandbox(env.Sandbox, await userSandboxId(subject));
    const requestId = crypto.randomUUID();
    const requestPath = `/tmp/atlas-maigret-${requestId}.json`;

    try {
      await sandbox.writeFile(requestPath, JSON.stringify(payload));
      const result = await sandbox.exec(`python /opt/atlas/run_maigret.py ${requestPath}`);
      try { await sandbox.exec(`rm -f ${requestPath}`); } catch {}
      const stdout = String(result.stdout || '').trim();
      const parsed = JSON.parse(stdout || '{}');
      return respond({
        ...parsed,
        transport: { provider: 'cloudflare', sandbox: true, worker_version: '0526.1' },
      }, parsed?.ok === false ? 502 : 200);
    } catch (error) {
      try { await sandbox.exec(`rm -f ${requestPath}`); } catch {}
      return respond({ ok: false, error: 'MAIGRET_RUNTIME_FAILED', detail: String((error as Error)?.message || error) }, 502);
    }
  },
};
