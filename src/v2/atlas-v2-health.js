'use strict';

(function installAtlasV2Health(global) {
  if (global.AtlasV2Health?.installed) return;

  const MAX_EVENTS = 80;
  const events = [];
  const counters = { read_ok: 0, read_error: 0, boot_error: 0, runtime_error: 0 };

  function clean(value, max = 120) {
    const text = String(value ?? '').trim();
    return text ? text.slice(0, max) : null;
  }

  function record(type, detail = {}) {
    const entry = Object.freeze({
      type: clean(type, 40) || 'unknown',
      outcome: clean(detail.outcome, 24),
      route: clean(detail.route, 120),
      operation: clean(detail.operation, 80),
      kind: clean(detail.kind, 80),
      code: clean(detail.code, 80),
      status: Number.isFinite(Number(detail.status)) ? Number(detail.status) : null,
      traceId: clean(detail.traceId, 120),
      snapshot: clean(detail.snapshot, 120),
      clientMs: Number.isFinite(Number(detail.clientMs)) ? Math.max(0, Math.round(Number(detail.clientMs))) : null,
      at: new Date().toISOString(),
    });
    events.push(entry);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    if (entry.type === 'read') counters[entry.outcome === 'ok' ? 'read_ok' : 'read_error'] += 1;
    else if (entry.type === 'boot' && entry.outcome === 'error') counters.boot_error += 1;
    else if (entry.type === 'runtime_error') counters.runtime_error += 1;
    return entry;
  }

  global.addEventListener('atlas:v2-read', event => record('read', event.detail || {}));
  global.addEventListener('atlas:v2-boot', event => record('boot', event.detail || {}));
  global.addEventListener('error', () => record('runtime_error', { outcome: 'error', code: 'WINDOW_ERROR' }));
  global.addEventListener('unhandledrejection', () => record('runtime_error', { outcome: 'error', code: 'UNHANDLED_REJECTION' }));

  global.AtlasV2Health = Object.freeze({
    installed: true,
    record,
    snapshot: () => ({
      schema: 'ATLAS_V2_RUNTIME_HEALTH_V1',
      counters: { ...counters },
      recent: events.slice(-20).map(item => ({ ...item })),
      capturedAt: new Date().toISOString(),
    }),
    clear: () => { events.length = 0; Object.keys(counters).forEach(key => { counters[key] = 0; }); },
  });
})(window);
